// Shardora blockchain node API service
// All data comes directly from shardora HTTPS nodes, proxied through nginx at /api/shardN/
import axios from 'axios'
import qs from 'qs'
import { buildAndSignTx, getKeypair, type SignTxInput } from './signing'

// Shard IDs on the network (2-6, i.e. 5 shards × 4 nodes each)
export const SHARDS = [2, 3, 4, 5, 6]
const DEFAULT_SHARD = 3

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
    [key: string]: any
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
                return { ...data, shard }
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
            return { ...data, shard: shardId }
        }
    } catch (_) {}
    return null
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

export async function queryTxReceipt(txHash: string, shardId = DEFAULT_SHARD): Promise<any | null> {
    const hex = txHash.toLowerCase().replace(/^0x/, '')
    for (const shard of shardId === DEFAULT_SHARD ? SHARDS : [shardId]) {
        try {
            const data = await post(shard, 'transaction_receipt', { tx_hash: hex })
            if (data && (data.status === 0 || data.receipt)) return { ...data, shard }
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
}

export async function transfer(opts: TransferOpts): Promise<{ ok: boolean; msg: string; raw?: any }> {
    const shardId = opts.shardId ?? DEFAULT_SHARD
    const keypair = getKeypair(opts.privateKeyHex)
    const fromAddr = keypair.accountId

    // 1. Get current nonce from the node
    const accInfo = await queryAccountOnShard(fromAddr, shardId)
    if (!accInfo) {
        // Account might not exist yet — try all shards
        const accAll = await queryAccount(fromAddr)
        if (!accAll) {
            return { ok: false, msg: `账户 ${fromAddr} 未找到，余额为0` }
        }
    }
    const nonce = accInfo ? parseInt(accInfo.nonce) + 1 : 1

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
    }

    const txParams = buildAndSignTx(signInput)

    try {
        const raw = await post(shardId, 'transaction', txParams)
        return { ok: true, msg: 'ok', raw }
    } catch (e: any) {
        return { ok: false, msg: String(e?.message ?? e) }
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
        return await get<any>(shardId, 'explorer/address/txs', params)
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
): Promise<{ ok: boolean; msg: string; contractAddress?: string; raw?: any }> {
    // Encode source code + ABI as JSON payload in contract_input
    const srcPayload = JSON.stringify({
        __type: 'SHRDORA_CONTRACT_SRC',
        source: opts.sourceCode,
        abi: opts.abiJson,
    })
    const inputHex = Array.from(new TextEncoder().encode(srcPayload))
        .map(b => b.toString(16).padStart(2, '0')).join('')

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
        to: '',
        amount: opts.amount ?? 0,
        shardId: opts.shardId,
        step: 6,
        contractBytes: initCode,
        input: inputHex,
        prepay: opts.prepay ?? 0,
    })

    if (!result.ok) return result

    // Poll for the new contract address (block processing takes a few seconds)
    const { getKeypair } = await import('./signing')
    const fromAddr = getKeypair(opts.privateKeyHex).accountId
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500))
        try {
            const resp = await explorerGetContracts(opts.shardId, { limit: 10 })
            const items: any[] = resp?.items ?? resp?.data?.items ?? []
            const found = items.find((c: any) => {
                const creator = (c.creator_addr ?? '').replace(/^0x/, '').toLowerCase()
                return creator === fromAddr.toLowerCase()
            })
            if (found) {
                return { ok: true, msg: 'ok', contractAddress: found.addr, raw: result.raw }
            }
        } catch (_) {}
    }

    return { ok: true, msg: 'ok', contractAddress: '', raw: result.raw }
}
