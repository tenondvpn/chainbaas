// Shardora blockchain node API service
// All data comes directly from shardora HTTPS nodes, proxied through nginx at /api/shardN/
import axios from 'axios'
import qs from 'qs'
import { buildAndSignTx, getKeypair, type SignTxInput } from './signing'
import { keccak256 } from 'ethereum-cryptography/keccak'

// Ethereum CREATE address formula: keccak256(RLP([sender, nonce]))[-20:]
// Matches Shardora's GetContractAddress(sender, nonce).
export function calcCreateAddress(senderHex: string, nonce: number): string {
    const senderBytes = hexToBytes(senderHex.replace(/^0x/, '').slice(-40).padStart(40, '0'))

    function rlpBytes(b: Uint8Array): Uint8Array {
        if (b.length === 0) return new Uint8Array([0x80])
        if (b.length === 1 && b[0] < 0x80) return b
        if (b.length <= 55) return concat([new Uint8Array([0x80 + b.length]), b])
        const lenBe = numToMinBytes(b.length)
        return concat([new Uint8Array([0xb7 + lenBe.length]), lenBe, b])
    }
    function rlpList(payload: Uint8Array): Uint8Array {
        if (payload.length <= 55) return concat([new Uint8Array([0xc0 + payload.length]), payload])
        const lenBe = numToMinBytes(payload.length)
        return concat([new Uint8Array([0xf7 + lenBe.length]), lenBe, payload])
    }
    function numToMinBytes(n: number): Uint8Array {
        if (n === 0) return new Uint8Array([])
        const bytes: number[] = []
        let x = n
        while (x > 0) { bytes.unshift(x & 0xff); x = x >>> 8 }
        return new Uint8Array(bytes)
    }
    function concat(parts: Uint8Array[]): Uint8Array {
        const total = parts.reduce((s, p) => s + p.length, 0)
        const out = new Uint8Array(total)
        let off = 0
        for (const p of parts) { out.set(p, off); off += p.length }
        return out
    }
    function hexToBytes(hex: string): Uint8Array {
        const arr = new Uint8Array(hex.length / 2)
        for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
        return arr
    }

    const nonceBytes = nonce === 0 ? new Uint8Array([]) : numToMinBytes(nonce)
    const payload = concat([rlpBytes(senderBytes), rlpBytes(nonceBytes)])
    const rlp = rlpList(payload)
    const hash = keccak256(rlp)
    return Array.from(hash.slice(-20)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Consensus shards, 3-6 (4 nodes each).
//
// Shard 2 is the root congress network (network_utils.h: kRootCongressNetworkId)
// and does not run transaction consensus, so no tx may ever be addressed to it.
// It answered `query_account` for at least one normal account, which is why it
// used to be probed — the node's address cache on the root shard is not
// authoritative for account ownership.
export const SHARDS = [3, 4, 5, 6]
export const DEFAULT_SHARD = 3
export const ROOT_SHARD = 2

function shardUrl(shardId: number): string {
    return `/api/shard${shardId}/`
}

async function post<T = any>(shardId: number, endpoint: string, params: Record<string, any>): Promise<T> {
    const url = shardUrl(shardId) + endpoint
    const resp = await axios.post(url, qs.stringify(params), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
        // shardora returns text/plain even for JSON — don't let axios parse it automatically
        responseType: 'text',
        transformResponse: [(data: any) => {
            if (typeof data === 'string') {
                try { return JSON.parse(data) } catch (_) { return data }
            }
            return data
        }],
    })
    return resp.data as T
}

async function get<T = any>(shardId: number, endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const url = shardUrl(shardId) + endpoint
    const resp = await axios.get(url, {
        params,
        timeout: 10000,
        responseType: 'text',
        transformResponse: [(data: any) => {
            if (typeof data === 'string') {
                try { return JSON.parse(data) } catch (_) { return data }
            }
            return data
        }],
    })
    return resp.data as T
}

// ─────────────────────────────────────────────────────────────────────────────
// Account queries
// ─────────────────────────────────────────────────────────────────────────────

export interface AccountInfo {
    balance: string
    nonce: string
    shard: number
    /** The shard the node says owns this account. Authoritative over `shard`,
     *  which is merely which node we happened to ask. */
    shardingId?: number
    [key: string]: any
}

/**
 * The shard that owns an account, as reported by the node itself.
 *
 * `query_account` returns a `shardingId` field naming the account's real shard,
 * and that is what deployment and calls must key off — not the shard we asked,
 * which can be a node holding a non-authoritative copy. Falls back to the probed
 * shard only when the node omits the field.
 *
 * The root shard is never returned: it does not run consensus and owns no
 * normal accounts.
 */
export function ownerShardOf(acc: AccountInfo | null | undefined, probedShard: number): number {
    const reported = Number(acc?.shardingId)
    if (Number.isFinite(reported) && reported >= 3) return reported
    return probedShard
}

/**
 * Query a single account. Tries every shard until one returns data.
 * Returns null if not found on any shard.
 */
export async function queryAccount(address: string): Promise<AccountInfo | null> {
    const hex = address.toLowerCase().replace(/^0x/, '')
    for (const shard of SHARDS) {
        try {
            const data = await post(shard, 'query_account', { address: hex })
            if (typeof data === 'object' && data !== null && data.balance !== undefined) {
                return { ...data, shard: ownerShardOf(data, shard) }
            }
            // Sometimes returns plain text on error — skip
        } catch (_) {
            // network error or shard offline — try next
        }
    }
    return null
}

/**
 * Query a single account on a specific shard (faster when shard is known).
 */
export async function queryAccountOnShard(address: string, shardId: number): Promise<AccountInfo | null> {
    const hex = address.toLowerCase().replace(/^0x/, '')
    try {
        const data = await post(shardId, 'query_account', { address: hex })
        if (typeof data === 'object' && data !== null && data.balance !== undefined) {
            return { ...data, shard: ownerShardOf(data, shardId) }
        }
    } catch (_) {}
    return null
}

/**
 * Wait for an account to show up with a credited balance.
 *
 * A freshly-created recipient has no row in the node's account table until the
 * tx that credits it is committed, so an immediate lookup after the receipt is
 * final can still miss.
 *
 * Defaults: 60s total, one attempt every 15s — 4 tries. The first attempt runs
 * immediately, so an already-credited account costs one round-trip.
 *
 * `maxAttempts` caps the probe count independently of the clock. The two limits
 * differ: N attempts at an interval of I occupy N-1 gaps, so 6 tries 5s apart is
 * 25s of wall-clock, not 30s. Callers that think in "how many times should we
 * look" (rather than "how long should we wait") should set the attempt count and
 * leave the timeout as a backstop. Default of 0 means unlimited, i.e. the
 * timeout alone bounds the loop.
 *
 * `minBalance` defaults to 1, i.e. "wait until credited". Pass 0 for cases where
 * mere existence is the interesting part (e.g. a contract address that was
 * deployed without an initial value), otherwise the full budget is spent on a
 * balance that is legitimately zero.
 *
 * `stopWhenCredited` (default true) short-circuits on the first reading at or
 * above `minBalance`. Pass false to run every attempt to completion — the caller
 * wants the final reading rather than the first good one — in which case
 * `minBalance` no longer decides anything, and `maxAttempts` is what bounds the
 * sweep.
 *
 * Returns the last AccountInfo seen, or null if the account never appeared.
 */
export async function waitForBalance(
    address: string,
    shardId: number,
    timeoutMs = 60000,
    intervalMs = 15000,
    onProgress?: (attempt: number, elapsedSec: number, balance: string | null) => void,
    minBalance = 1n,
    maxAttempts = 0,
    stopWhenCredited = true,
): Promise<AccountInfo | null> {
    const start = Date.now()
    let attempt = 0
    let last: AccountInfo | null = null
    while (true) {
        attempt++
        try {
            const acc = await queryAccountOnShard(address, shardId)
            if (acc) {
                last = acc
                const elapsed = Math.round((Date.now() - start) / 1000)
                onProgress?.(attempt, elapsed, acc.balance)
                if (stopWhenCredited && BigInt(acc.balance ?? '0') >= minBalance) return acc
            } else {
                onProgress?.(attempt, Math.round((Date.now() - start) / 1000), null)
            }
        } catch (_) {
            onProgress?.(attempt, Math.round((Date.now() - start) / 1000), null)
        }
        if (maxAttempts > 0 && attempt >= maxAttempts) break
        if (Date.now() - start + intervalMs > timeoutMs) break
        await new Promise(r => setTimeout(r, intervalMs))
    }
    return last
}

/**
 * Same as `waitForBalance`, but searches every consensus shard instead of one.
 *
 * A recipient's shard is independent of the sender's, so polling the sender's
 * shard for the recipient's balance reports "not found" for a transfer that
 * succeeded — the account simply lives elsewhere. Each attempt fans out across
 * all shards concurrently and takes the first that reports the account.
 *
 * `onProgress` receives the shard that answered, or null when no shard had the
 * account on that attempt.
 */
export async function waitForBalanceAnyShard(
    address: string,
    timeoutMs = 60000,
    intervalMs = 15000,
    onProgress?: (attempt: number, elapsedSec: number, balance: string | null, shard: number | null) => void,
    minBalance = 1n,
    maxAttempts = 0,
    stopWhenCredited = true,
): Promise<AccountInfo | null> {
    const start = Date.now()
    let attempt = 0
    let last: AccountInfo | null = null
    while (true) {
        attempt++
        const elapsed = () => Math.round((Date.now() - start) / 1000)
        try {
            const results = await Promise.allSettled(
                SHARDS.map(async (s) => {
                    const acc = await queryAccountOnShard(address, s)
                    return acc ? { ...acc, shard: ownerShardOf(acc, s) } : null
                })
            )
            const hit = results
                .map(r => (r.status === 'fulfilled' ? r.value : null))
                .find((a): a is AccountInfo => a !== null)
            if (hit) {
                last = hit
                onProgress?.(attempt, elapsed(), hit.balance, hit.shard)
                if (stopWhenCredited && BigInt(hit.balance ?? '0') >= minBalance) return hit
            } else {
                onProgress?.(attempt, elapsed(), null, null)
            }
        } catch (_) {
            onProgress?.(attempt, elapsed(), null, null)
        }
        if (maxAttempts > 0 && attempt >= maxAttempts) break
        if (Date.now() - start + intervalMs > timeoutMs) break
        await new Promise(r => setTimeout(r, intervalMs))
    }
    return last
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction history
// ─────────────────────────────────────────────────────────────────────────────

export interface TxItem {
    height: string
    txIndex: number
    nonce: string
    from: string
    to: string
    amount: string
    gasLimit: string
    gasUsed: string
    gasPrice: string
    balance: string
    step: number
    status: number
    txHash: string
    uniqueHash: string
    shard: number
}

export interface TxListResult {
    status: number
    msg: string
    address: string
    limit: number
    offset: number
    transactions: TxItem[]
    shard: number
}

/**
 * Query account transactions. Tries every shard and returns first successful hit.
 */
export async function queryAccountTxs(
    address: string,
    limit = 20,
    offset = 0,
): Promise<TxListResult | null> {
    const hex = address.toLowerCase().replace(/^0x/, '')
    for (const shard of SHARDS) {
        try {
            const data = await post<TxListResult>(shard, 'query_account_txs', {
                address: hex,
                limit,
                offset,
            })
            if (data.status === 0 && Array.isArray(data.transactions)) {
                data.transactions = data.transactions.map(tx => ({ ...tx, shard }))
                return { ...data, shard }
            }
        } catch (_) {}
    }
    return null
}

/**
 * Query transactions on a specific shard.
 */
export async function queryAccountTxsOnShard(
    address: string,
    shardId: number,
    limit = 20,
    offset = 0,
): Promise<TxListResult | null> {
    const hex = address.toLowerCase().replace(/^0x/, '')
    try {
        const data = await post<TxListResult>(shardId, 'query_account_txs', {
            address: hex,
            limit,
            offset,
        })
        if (data.status === 0) {
            data.transactions = (data.transactions || []).map(tx => ({ ...tx, shard: shardId }))
            return { ...data, shard: shardId }
        }
    } catch (_) {}
    return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction receipt
// ─────────────────────────────────────────────────────────────────────────────

// Pass shardId=null to search all shards; pass a specific shard number to query only that shard.
export async function queryTxReceipt(txHash: string, shardId: number | null = null): Promise<any | null> {
    const hex = txHash.toLowerCase().replace(/^0x/, '')
    for (const shard of shardId === null ? SHARDS : [shardId]) {
        try {
            const data = await post(shard, 'transaction_receipt', { tx_hash: hex })
            if (data && data.status !== undefined) return { ...data, shard }
        } catch (_) {}
    }
    return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Submit transaction
// ─────────────────────────────────────────────────────────────────────────────

export interface TransferOpts {
    privateKeyHex: string
    to: string
    amount: number
    shardId?: number
    step?: number
    contractBytes?: string
    input?: string
    prepay?: number
    key?: string
    val?: string
    nonce?: number  // optional: skip nonce query and use this value directly
    gasLimit?: number
}

export async function transfer(opts: TransferOpts): Promise<{ ok: boolean; msg: string; txHash?: string; raw?: any }> {
    const shardId = opts.shardId ?? DEFAULT_SHARD
    // Hard stop. The root congress shard runs no transaction consensus, so a tx
    // sent there is not merely misdirected — it can never be included. Guarding
    // here rather than at each caller means no future call site can regress it.
    if (shardId === ROOT_SHARD) {
        return { ok: false, msg: `分片 ${ROOT_SHARD} 是 root 分片，不处理交易共识，拒绝发送` }
    }
    const keypair = getKeypair(opts.privateKeyHex)
    const fromAddr = keypair.accountId

    let nonce: number
    if (opts.nonce !== undefined) {
        nonce = opts.nonce
    } else {
        // kContractExcute (step 8): nonce belongs to the prefund account (contract||user, 40 bytes).
        // All other steps: nonce belongs to the sender's own account.
        let nonceAddr: string
        if (opts.step === 8 && opts.to) {
            const contractHex = opts.to.toLowerCase().replace(/^0x/, '').slice(-40).padStart(40, '0')
            const userHex    = fromAddr.toLowerCase().replace(/^0x/, '').slice(-40).padStart(40, '0')
            nonceAddr = contractHex + userHex   // 80 hex chars = 40-byte prefund address
        } else {
            nonceAddr = fromAddr
        }

        const accInfo = await queryAccountOnShard(nonceAddr, shardId)
        if (!accInfo && opts.step !== 8) {
            // For non-contract-execute txs, account must exist
            const accAll = await queryAccount(fromAddr)
            if (!accAll) {
                return { ok: false, msg: `账户 ${fromAddr} 未找到，余额为0` }
            }
        }
        nonce = accInfo ? parseInt(accInfo.nonce) + 1 : 1
    }

    const signInput: SignTxInput = {
        privateKeyHex: opts.privateKeyHex,
        nonce,
        to: opts.to.toLowerCase().replace(/^0x/, ''),
        amount: opts.amount,
        shardId,
        step: opts.step,
        contractBytes: opts.contractBytes,
        input: opts.input,
        prepay: opts.prepay,
        key: opts.key,
        val: opts.val,
        gasLimit: opts.gasLimit,
    }

    const txParams = buildAndSignTx(signInput)

    try {
        const raw = await post(shardId, 'transaction', txParams)
        // Node returns plain-text: "ok" on success, error string on rejection.
        if (typeof raw === 'string' && raw.trim() !== 'ok') {
            return { ok: false, msg: raw.trim(), raw }
        }
        return { ok: true, msg: 'ok', txHash: txParams.txHash, raw }
    } catch (e: any) {
        const raw = e?.response?.data ?? undefined
        return { ok: false, msg: String(e?.message ?? e), raw }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool / block info
// ─────────────────────────────────────────────────────────────────────────────

export async function getLatestPoolInfo(shardId = DEFAULT_SHARD): Promise<{ pools: any[] } | null> {
    try {
        return await post(shardId, 'get_latest_pool_info', { network: shardId })
    } catch (_) {
        return null
    }
}

export async function getBlocks(
    shardId: number,
    poolIndex: number,
    height: number,
    count = 10,
): Promise<{ blocks: any[] } | null> {
    try {
        return await post(shardId, 'get_blocks', {
            network: shardId,
            pool_index: poolIndex,
            height,
            count,
        })
    } catch (_) {
        return null
    }
}

// addressArray can be at top level OR inside blockInfo depending on node version
function getBlockAddrs(block: any): any[] {
    return block.addressArray ?? block.blockInfo?.addressArray ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// All accounts (from /get_all_accounts — reads the node's DB directly)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChainAccount {
    address: string
    balance: string
    nonce: string
    sharding_id: number
    pool_index: number
    type: number
    latest_height: string
    _id?: number       // rowid cursor
    tx_count?: number
}

export interface AllAccountsResult {
    status: number
    msg: string
    total: number      // -1 means unknown (cursor-based)
    limit: number
    offset: number
    accounts: ChainAccount[]
    has_more?: boolean
    next_cursor?: number
}

export async function getAllAccounts(
    shardId?: number,
    poolIndex?: number,
    limit = 50,
    beforeId = 0,
): Promise<AllAccountsResult | null> {
    // Query via /explorer/addresses — served by the node's SQLite explorer DB
    const shard = shardId ?? DEFAULT_SHARD
    const params: Record<string, any> = { limit, before_id: beforeId }
    if (shardId !== undefined) params.shard_id = shardId
    if (poolIndex !== undefined) params.pool_index = poolIndex
    try {
        const data = await get<any>(shard, 'explorer/addresses', params)
        if (data && data.code === 0 && Array.isArray(data.data)) {
            // Normalise to AllAccountsResult shape
            return {
                status: 0,
                msg: 'ok',
                total: -1,   // cursor-based, no total count
                limit,
                offset: 0,
                accounts: (data.data as any[]).map(a => ({
                    address:      (a.addr as string).replace(/^0x/, ''),
                    balance:      String(a.balance ?? 0),
                    nonce:        String(a.nonce ?? 0),
                    sharding_id:  a.shard_id ?? shard,
                    pool_index:   a.pool_index ?? 0,
                    type:         a.addr_type ?? 0,
                    latest_height: String(a.last_seen ?? 0),
                    _id:          a.id,   // cursor for next page
                    tx_count:     a.tx_count ?? 0,
                })),
                has_more: data.has_more ?? false,
                next_cursor: data.next_cursor ?? 0,
            }
        }
    } catch (_) {}
    return null
}

export interface SearchHit {
    address: string
    balance: string
    nonce: string
    shard_id: number
    pool_index: number
    type: number
    is_contract: boolean
    tx_count: number
    last_seen: number
    exact: boolean
    _id: number
}

/**
 * Prefix search over the explorer's `addresses` table.
 *
 * The node matches on the full stored hex string, which is 40 chars for a normal
 * account/contract and 80 chars for a contract gas-prefund address. A prefix
 * shorter than 40 hex chars therefore needs no server round-trip — it can only
 * match within the 20-byte address space, so callers gate on that.
 *
 * `q` may carry a `0x` prefix and any case; the node normalises both.
 * Returns [] when no shard answers.
 */
export async function explorerSearch(
    q: string,
    limit = 50,
    shardId = DEFAULT_SHARD,
): Promise<SearchHit[]> {
    const hex = q.toLowerCase().replace(/^0x/, '')
    if (!hex) return []
    try {
        const data = await get<any>(shardId, 'explorer/search', { q: hex, limit })
        if (data && data.code === 0 && Array.isArray(data.data)) {
            return (data.data as any[]).map(a => ({
                address:     a.addr ?? '',
                balance:     String(a.balance ?? 0),
                nonce:       String(a.nonce ?? 0),
                shard_id:    a.shard_id ?? shardId,
                pool_index:  a.pool_index ?? 0,
                type:        a.addr_type ?? 0,
                is_contract: !!a.is_contract,
                tx_count:    a.tx_count ?? 0,
                last_seen:   a.last_seen ?? 0,
                exact:       !!a.exact,
                _id:         a.id,
            }))
        }
    } catch (_) {}
    return []
}

export async function explorerGetBlock(hash: string, shardId: number): Promise<any | null> {
    try {
        const data = await get<any>(shardId, 'explorer/block', { hash })
        if (data?.code === 0 && data.data) return data.data
    } catch (_) {}
    return null
}

export async function explorerGetTx(txHash: string, shardId: number): Promise<any | null> {
    try {
        const data = await get<any>(shardId, 'explorer/transaction', { tx_hash: txHash })
        if (data?.code === 0 && data.data) return data.data
    } catch (_) {}
    return null
}

export async function getLatestNetworkBlocks(shardId = DEFAULT_SHARD, maxTotal = 15): Promise<any[]> {
    const poolInfo = await getLatestPoolInfo(shardId)
    if (!poolInfo?.pools) return []

    const activePools = poolInfo.pools
        .map((p: any, idx: number) => ({ ...p, idx }))
        .filter((p: any) => parseInt(p.height) > 0)
        .sort((a: any, b: any) => parseInt(b.height) - parseInt(a.height))
        .slice(0, 5)

    if (!activePools.length) return []

    const perPool = 3
    const allBlocks = await Promise.all(
        activePools.map((pool: any) => {
            const h = parseInt(pool.height)
            const start = Math.max(1, h - perPool + 1)
            return getBlocks(shardId, pool.idx, start, perPool)
                .then(res => (res?.blocks ?? []).map((b: any) => ({
                    ...b,
                    poolIndex: pool.idx,
                    shardId,
                    _addrCount: getBlockAddrs(b).length,
                })))
                .catch(() => [] as any[])
        }),
    )

    return allBlocks
        .flat()
        .filter((b: any) => b.blockInfo)
        .sort((a: any, b: any) => parseInt(b.blockInfo.timestamp) - parseInt(a.blockInfo.timestamp))
        .slice(0, maxTotal)
}

function b64ToAddr(b64: string): string {
    try {
        const bin = atob(b64)
        const bytes = Array.from(bin, (c: string) => c.charCodeAt(0))
        return bytes.slice(-20).map((n: number) => n.toString(16).padStart(2, '0')).join('')
    } catch {
        return ''
    }
}

export interface NetworkActivityItem {
    height: string
    poolIndex: number
    timestamp: string
    address: string
    balance: string
    nonce: string
}

export interface NetworkTxItem {
    height: string
    poolIndex: number
    shardId: number
    timestamp: string
    txIndex: number
    addrCount: number
    addresses: any[]
    kvChanges: any[]
    blockRef: any
}

export async function getNetworkActivity(shardId = DEFAULT_SHARD, maxItems = 40): Promise<NetworkActivityItem[]> {
    const blocks = await getLatestNetworkBlocks(shardId, 15)
    const items: NetworkActivityItem[] = []
    for (const block of blocks) {
        const bi = block.blockInfo
        const addrs = getBlockAddrs(block)
        for (const a of addrs) {
            const addr = b64ToAddr(a.addr ?? '')
            if (!addr || addr === '0'.repeat(40)) continue
            items.push({
                height: bi?.height ?? '0',
                poolIndex: block.poolIndex,
                timestamp: bi?.timestamp ?? '0',
                address: addr,
                balance: a.balance ?? '0',
                nonce: a.nonce ?? '0',
            })
        }
    }
    return items.sort((a, b) => parseInt(b.height) - parseInt(a.height)).slice(0, maxItems)
}

export async function getNetworkTransactions(shardId = DEFAULT_SHARD, maxItems = 40): Promise<NetworkTxItem[]> {
    const blocks = await getLatestNetworkBlocks(shardId, 15)
    const items: NetworkTxItem[] = []

    for (const block of blocks) {
        const bi = block.blockInfo
        const addrs = getBlockAddrs(block)
        const kvs: any[] = block.keyValueArray ?? block.blockInfo?.keyValueArray ?? []
        const map = new Map<number, NetworkTxItem>()

        for (const a of addrs) {
            const addr = b64ToAddr(a.addr ?? '')
            if (!addr || addr === '0'.repeat(40)) continue
            const idx = typeof a.txIndex === 'number' ? a.txIndex : (parseInt(a.txIndex ?? '0') || 0)
            if (!map.has(idx)) {
                map.set(idx, {
                    height: bi?.height ?? '0',
                    poolIndex: block.poolIndex,
                    shardId: block.shardId ?? shardId,
                    timestamp: bi?.timestamp ?? '0',
                    txIndex: idx,
                    addrCount: 0,
                    addresses: [],
                    kvChanges: [],
                    blockRef: block,
                })
            }
            const item = map.get(idx)!
            item.addresses.push(a)
            item.addrCount++
        }

        for (const kv of kvs) {
            const kvAddr = b64ToAddr(kv.addr ?? '')
            for (const item of map.values()) {
                if (item.addresses.some((a: any) => b64ToAddr(a.addr) === kvAddr)) {
                    item.kvChanges.push(kv)
                    break
                }
            }
        }

        items.push(...map.values())
    }

    return items
        .sort((a, b) => parseInt(b.height) - parseInt(a.height) || b.txIndex - a.txIndex)
        .slice(0, maxItems)
}

export async function getLatestNetworkTxs(limit = 20): Promise<TxItem[]> {
    const results = await Promise.all(
        GENESIS_ACCOUNTS.map(g =>
            queryAccountTxsOnShard(g.address, g.shard, 10, 0).catch(() => null),
        ),
    )
    const allTxs = results.flatMap(r => r?.transactions ?? [])
    allTxs.sort((a, b) => {
        const hd = parseInt(b.height) - parseInt(a.height)
        return hd !== 0 ? hd : b.txIndex - a.txIndex
    })
    return allTxs.slice(0, limit)
}

// ─────────────────────────────────────────────────────────────────────────────
// Network status — check which shards are online
// ─────────────────────────────────────────────────────────────────────────────

export interface ShardStatus {
    shard: number
    online: boolean
    responseMs?: number
}

export async function checkNetworkStatus(): Promise<ShardStatus[]> {
    return Promise.all(SHARDS.map(async (shard) => {
        const t0 = Date.now()
        try {
            // Use batch_query with a dummy address to ping the shard
            const data = await post(shard, 'batch_query_accounts', { addresses: '0000000000000000000000000000000000000000' })
            if (data) return { shard, online: true, responseMs: Date.now() - t0 }
        } catch (_) {}
        return { shard, online: false }
    }))
}

// Known funded genesis accounts (from /data/nodes/s3_1/init_accounts3)
export const GENESIS_ACCOUNTS: { shard: number; address: string; label: string }[] = [
    { shard: 3, address: '8c98daf9a6969f5ac82ae6f09928529096585545', label: 'Shard3 Genesis-1 (Faucet)' },
    { shard: 3, address: '8cab84fc5124fc5bcbfbf367b0a308d33c2218bf', label: 'Shard3 Genesis-2' },
    { shard: 3, address: '2370a65bce56787bda7bd4c942158df687e1ab23', label: 'Shard3 Genesis-3' },
    { shard: 3, address: '01f47d73c3f206b49075e93c1d0f907be29627c7', label: 'Shard3 Genesis-4' },
    { shard: 3, address: '715f574da6c2da667f30dc61e44a060896b37dfe', label: 'Shard3 Genesis-5' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Faucet helper — hard-coded funder key for the test network
// ─────────────────────────────────────────────────────────────────────────────

const FAUCET_PRIKEY = '0376dc1b7bc5e943c5ff8f756487b1dacbcb233e23def9cd9f0ef75604eafa2d'
const FAUCET_SHARD = 3

export async function faucetSend(toAddress: string, amount: number): Promise<{ ok: boolean; msg: string }> {
    const to = toAddress.toLowerCase().replace(/^0x/, '')
    if (to.length !== 40) {
        return { ok: false, msg: '地址格式无效，应为40位十六进制字符串' }
    }
    if (amount <= 0 || amount > 1_000_000_000) {
        return { ok: false, msg: '金额超出范围 (1 ~ 1,000,000,000)' }
    }
    return transfer({
        privateKeyHex: FAUCET_PRIKEY,
        to,
        amount,
        shardId: FAUCET_SHARD,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart contract explorer (SQLite-backed)
// ─────────────────────────────────────────────────────────────────────────────

export async function explorerGetContracts(
    shardId: number,
    params: { before_id?: number; limit?: number; is_library?: number; is_clone?: number } = {}
): Promise<any> {
    try {
        return await get<any>(shardId, 'explorer/contracts', { limit: 20, ...params })
    } catch (_) {
        return null
    }
}

export async function explorerGetContract(shardId: number, addr: string): Promise<any | null> {
    try {
        const data = await get<any>(shardId, 'explorer/contract', { addr })
        if (data?.code === 0 && data.data) return data.data
    } catch (_) {}
    return null
}

export async function explorerGetContractTxs(
    shardId: number,
    addr: string,
    beforeId?: number,
    limit = 20
): Promise<any> {
    try {
        const params: Record<string, any> = { addr, limit }
        if (beforeId) params.before_id = beforeId
        return await get<any>(shardId, 'explorer/address_txs', params)
    } catch (_) {
        return null
    }
}

export interface DeployContractOpts {
    privateKeyHex: string
    shardId: number
    bytecode: string
    abiJson: string
    sourceCode: string
    constructorTypes?: string[]
    constructorArgs?: string[]
    prepay?: number
    amount?: number
}

export async function deployContractDirect(
    opts: DeployContractOpts
): Promise<{ ok: boolean; msg: string; contractAddress?: string; fromAddr?: string; txHash?: string; raw?: any }> {
    const shardId = opts.shardId ?? DEFAULT_SHARD
    const fromAddr = getKeypair(opts.privateKeyHex).accountId

    // Query nonce before submission so we can compute the deterministic contract address
    const accInfo = await queryAccountOnShard(fromAddr, shardId)
    const deployNonce = accInfo ? parseInt(accInfo.nonce) + 1 : 1
    const contractAddress = calcCreateAddress(fromAddr, deployNonce)

    // Build initCode = bytecode + ABI-encoded constructor args (standard EVM convention)
    let initCode = opts.bytecode.replace(/^0x/, '')
    if (opts.constructorTypes && opts.constructorTypes.length > 0 && opts.constructorArgs && opts.constructorArgs.length > 0) {
        try {
            const { Web3 } = await import('web3')
            const w3 = new Web3()
            const encoded = w3.eth.abi.encodeParameters(opts.constructorTypes, opts.constructorArgs)
            initCode += encoded.replace(/^0x/, '')
        } catch (e) {
            return { ok: false, msg: '构造函数参数编码失败: ' + String(e) }
        }
    }

    const result = await transfer({
        privateKeyHex: opts.privateKeyHex,
        to: contractAddress,
        amount: opts.amount ?? 0,
        shardId,
        step: 6,
        contractBytes: initCode,
        // Do NOT send input here — the node interprets non-empty contract_input as a
        // post-deploy call using the bytes as calldata, which would revert the tx.
        // Source code and ABI are saved separately via updateContract after polling confirms success.
        prepay: opts.prepay ?? 0,
        nonce: deployNonce,
    })

    if (!result.ok) return result
    return { ok: true, msg: 'submitted', contractAddress, fromAddr, txHash: result.txHash, raw: result.raw }
}

// Two-phase deployment confirmation:
// Phase 1 — poll transaction_receipt by txHash until the tx is committed (success or failure).
// Phase 2 — query contract address on-chain to confirm account exists.
// Status codes: 0=success, 10003=pending, 5031=revert, other 5xxx=failure.
export async function pollForDeployedContract(
    shardId: number,
    contractAddr: string,
    txHash: string,
    timeoutMs: number,
    onCheck: (attempt: number, elapsedSec: number, phase: string) => void,
): Promise<{ found: boolean; addr: string; failReason?: string }> {
    const start = Date.now()
    let attempt = 0

    // Phase 1: wait for tx receipt to confirm the transaction committed successfully
    while (Date.now() - start < timeoutMs) {
        await new Promise(r => setTimeout(r, 2000))
        attempt++
        const elapsed = Math.round((Date.now() - start) / 1000)
        onCheck(attempt, elapsed, 'tx')
        try {
            const receipt = await queryTxReceipt(txHash, shardId)
            if (receipt) {
                const s = typeof receipt.status === 'number' ? receipt.status : parseInt(receipt.status ?? '-1')
                if (s === 0) {
                    // kConsensusSuccess — tx committed, proceed to phase 2
                    break
                }
                if (s === 10003 || s === 100010) {
                    // pending / not found yet — keep polling
                    continue
                }
                // Any other status (5031 revert, other 5xxx errors) is a definitive failure
                return { found: false, addr: '', failReason: `tx failed: ${receipt.msg ?? s}` }
            }
        } catch (_) {}
        if (Date.now() - start >= timeoutMs) break
    }

    const elapsed0 = Math.round((Date.now() - start) / 1000)
    if (elapsed0 >= timeoutMs / 1000) {
        return { found: false, addr: '', failReason: 'timeout waiting for tx receipt' }
    }

    // Phase 2: confirm contract address is live on-chain
    for (let i = 0; i < 5; i++) {
        onCheck(attempt + i, Math.round((Date.now() - start) / 1000), 'confirm')
        try {
            const info = await queryAccountOnShard(contractAddr, shardId)
            if (info) return { found: true, addr: contractAddr }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 2000))
    }
    // Tx succeeded but address not yet queryable — still return success with address
    return { found: true, addr: contractAddr }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract management — new node-backed endpoints
// ─────────────────────────────────────────────────────────────────────────────

// ── Browser-side Solidity compiler via Web Worker ────────────────────────────
// Worker handles WebAssembly compilation (no 8 MB main-thread limit in workers)

let _solcWorker: Worker | null = null
const _pendingCompiles = new Map<number, {
    resolve: (v: { status: number; abi: string; bytecode: string; msg?: string }) => void
    reject: (e: Error) => void
}>()
let _reqId = 0

function getSolcWorker(): Worker {
    if (_solcWorker) return _solcWorker
    _solcWorker = new Worker(
        new URL('../workers/solc.worker.ts', import.meta.url),
        // classic worker (no type:'module') so importScripts is available inside
    )
    _solcWorker.onmessage = (e: MessageEvent) => {
        const { id, ...result } = e.data
        const pending = _pendingCompiles.get(id)
        if (!pending) return
        _pendingCompiles.delete(id)
        pending.resolve(result)
    }
    _solcWorker.onerror = (e: ErrorEvent) => {
        for (const { reject } of _pendingCompiles.values())
            reject(new Error(e.message ?? 'Solidity compiler worker crashed'))
        _pendingCompiles.clear()
        _solcWorker = null
    }
    return _solcWorker
}

// Compile Solidity source code in a Web Worker (avoids main-thread WASM limit).
// Returns { status: 0, abi: string, bytecode: string } on success.
export async function compileSolidity(
    _shardId: number,
    sourceCode: string,
): Promise<{ status: number; abi: string; bytecode: string; msg?: string }> {
    try {
        const worker = getSolcWorker()
        const id = ++_reqId
        const result = await new Promise<{ status: number; abi: string; bytecode: string; msg?: string }>(
            (resolve, reject) => {
                _pendingCompiles.set(id, { resolve, reject })
                worker.postMessage({ id, sourceCode })
            },
        )
        return result
    } catch (e: any) {
        return { status: 1, abi: '', bytecode: '', msg: String(e?.message ?? e) }
    }
}

// Call a view (read-only) contract function via /abi_query_contract.
// inputHex: ABI-encoded function call as a hex string (no 0x prefix).
// fromHex:  caller address hex (optional, uses zero address if omitted).
// Returns raw hex output from the EVM.
export async function abiQueryContract(
    shardId: number,
    contractAddr: string,
    inputHex: string,
    fromHex = '0000000000000000000000000000000000000000',
): Promise<{ ok: boolean; outputHex: string; msg?: string }> {
    try {
        const addr = contractAddr.toLowerCase().replace(/^0x/, '')
        const from = fromHex.toLowerCase().replace(/^0x/, '')
        const resp = await post<any>(shardId, 'abi_query_contract', {
            address: addr,
            input: inputHex,
            from,
        })
        // Node returns plain hex text on success, or JSON error
        if (typeof resp === 'string' && !resp.startsWith('{')) {
            return { ok: true, outputHex: resp }
        }
        if (resp?.status === 0 || resp?.code === 0) {
            return { ok: true, outputHex: resp.output ?? resp.data ?? '' }
        }
        return { ok: false, outputHex: '', msg: resp?.msg ?? String(resp) }
    } catch (e: any) {
        return { ok: false, outputHex: '', msg: String(e?.message ?? e) }
    }
}

// Call a state-changing contract function (submit transaction, step=8).
export interface CallContractOpts {
    privateKeyHex: string
    shardId: number
    contractAddr: string
    inputHex: string   // ABI-encoded function call, no 0x prefix
    amount?: number
    prepay?: number
    gasLimit?: number
}

export async function callContractWrite(
    opts: CallContractOpts,
): Promise<{ ok: boolean; msg: string; txHash?: string; raw?: any }> {
    return transfer({
        privateKeyHex: opts.privateKeyHex,
        to: opts.contractAddr.toLowerCase().replace(/^0x/, ''),
        amount: opts.amount ?? 0,
        shardId: opts.shardId,
        step: 8,   // kContractExcute
        input: opts.inputHex,
        prepay: opts.prepay ?? opts.gasLimit ?? 999999,  // prepay drives actual execution gas from prefund
        gasLimit: opts.gasLimit,
    })
}

// Poll transaction receipt until committed or timeout.
// Status codes: 0=success, 10003=pending, anything else=failure.
export async function pollTxResult(
    shardId: number,
    txHash: string,
    timeoutMs: number,
    onProgress: (attempt: number, elapsedSec: number) => void,
): Promise<{ ok: boolean; reason?: string }> {
    const start = Date.now()
    let attempt = 0
    while (Date.now() - start < timeoutMs) {
        await new Promise(r => setTimeout(r, 2000))
        attempt++
        const elapsed = Math.round((Date.now() - start) / 1000)
        onProgress(attempt, elapsed)
        try {
            const receipt = await queryTxReceipt(txHash, shardId)
            if (receipt) {
                const s = typeof receipt.status === 'number' ? receipt.status : parseInt(receipt.status ?? '-1')
                if (s === 0) return { ok: true }
                if (s === 10003 || s === 100010) continue  // pending / not found yet
                return { ok: false, reason: receipt.msg ?? `status ${s}` }
            }
        } catch (_) {}
    }
    return { ok: false, reason: 'timeout' }
}

// Set gas prefund for a contract (step=7, kContractGasPrefund).
export async function setGasPrefund(
    privateKeyHex: string,
    shardId: number,
    contractAddr: string,
    amount: number,
): Promise<{ ok: boolean; msg: string; txHash?: string }> {
    return transfer({
        privateKeyHex,
        to: contractAddr.toLowerCase().replace(/^0x/, ''),
        amount,
        shardId,
        step: 7,   // kContractGasPrefund
        prepay: amount,
    })
}

// Update contract metadata in the explorer DB.
export async function updateContract(
    shardId: number,
    addr: string,
    sourceCode: string,
    abi: string,
    bytecode: string,
): Promise<{ ok: boolean; msg: string }> {
    try {
        const data = await post<any>(shardId, 'explorer/contract/update', {
            addr: addr.toLowerCase().replace(/^0x/, ''),
            source_code: sourceCode,
            abi,
            bytecode,
        })
        if (data?.code === 0) return { ok: true, msg: 'ok' }
        return { ok: false, msg: data?.msg ?? 'update failed' }
    } catch (e: any) {
        return { ok: false, msg: String(e?.message ?? e) }
    }
}

// Delete contract from the explorer DB.
export async function deleteContractFromExplorer(
    shardId: number,
    addr: string,
): Promise<{ ok: boolean; msg: string }> {
    try {
        const data = await post<any>(shardId, 'explorer/contract/delete', {
            addr: addr.toLowerCase().replace(/^0x/, ''),
        })
        if (data?.code === 0) return { ok: true, msg: 'ok' }
        return { ok: false, msg: data?.msg ?? 'delete failed' }
    } catch (e: any) {
        return { ok: false, msg: String(e?.message ?? e) }
    }
}
