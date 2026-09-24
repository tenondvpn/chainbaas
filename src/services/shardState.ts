import { ref } from 'vue'
import { SHARDS, queryAccountOnShard, ownerShardOf } from './shardora'

// The shard a contract operation runs against is not a user choice: it is wherever
// the signing account lives. A deploy computes its contract address from the
// sender's nonce on that shard, and a call must land on the shard holding the
// contract, so both are derived from the account rather than picked.
//
// `selectedShard` mirrors the value last resolved, purely so the status panel can
// display it. It is never written by the user.

export const selectedShard = ref(0)

// Probing is five parallel requests, so the result is cached per private key to
// keep a burst of operations (deploy, then call, then preset GAS) from re-probing
// each time. Keyed on the key rather than on the address so switching accounts
// naturally misses the cache.
const cache = new Map<string, number>()

/**
 * Find the shard that owns the account for `privateKeyHex`.
 *
 * Probes every consensus shard concurrently and takes the shard the answering
 * node reports as the account's owner, not the node we happened to reach.
 *
 * That distinction is load-bearing. A probe can succeed against a node holding a
 * stale or non-authoritative copy of the account — a stale row with a low nonce
 * was observed — and keying off the probed shard would aim a deploy at a shard
 * whose nonce does not match where the tx actually lands, producing a contract
 * address that never resolves.
 *
 * When several nodes answer with the same owner shard they agree by definition.
 * When they disagree, the lowest owner shard wins, which is arbitrary but
 * deterministic; a disagreement means the network itself is inconsistent.
 *
 * Returns null when the account exists on no shard. Callers treat that as fatal —
 * there is no sensible default shard to fall back to, because a wrong guess
 * produces a deploy whose contract address does not match where the tx lands.
 */
export async function resolveShardForAccount(privateKeyHex: string): Promise<number | null> {
    if (!privateKeyHex || privateKeyHex.length !== 64) return null

    const cached = cache.get(privateKeyHex)
    if (cached !== undefined) {
        selectedShard.value = cached
        return cached
    }

    const { getKeypair } = await import('./signing')
    let addr = ''
    try {
        addr = getKeypair(privateKeyHex).accountId.toLowerCase().replace(/^0x/, '')
    } catch (_) {
        return null
    }

    const results = await Promise.allSettled(
        SHARDS.map(async (s) => {
            const acc = await queryAccountOnShard(addr, s)
            return acc ? ownerShardOf(acc, s) : null
        })
    )

    const found = results
        .map(r => (r.status === 'fulfilled' ? r.value : null))
        .filter((s): s is number => s !== null)
        .sort((a, b) => a - b)

    if (found.length === 0) return null

    const shard = found[0]
    cache.set(privateKeyHex, shard)
    selectedShard.value = shard
    return shard
}

// A deployed contract's shard is not derivable from the contract address alone,
// so it is remembered once known — from the deploy result or from the tree, which
// sees each contract's shard_id in the list.
const contractShardCache = new Map<string, number>()

export function rememberContractShard(contractAddr: string, shard: number) {
    if (!contractAddr || !shard) return
    contractShardCache.set(contractAddr.toLowerCase().replace(/^0x/, ''), shard)
}

export function knownContractShard(contractAddr: string): number | null {
    if (!contractAddr) return null
    return contractShardCache.get(contractAddr.toLowerCase().replace(/^0x/, '')) ?? null
}

/** Drop cached probe results, e.g. after the account is first funded. */
export function clearShardCache() {
    cache.clear()
}
