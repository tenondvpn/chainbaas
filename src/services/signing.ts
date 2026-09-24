// Shardora transaction signing — replicates shardora_api.py _sign_message / _get_tx_params
import { secp256k1 } from 'ethereum-cryptography/secp256k1'
import { keccak256 } from 'ethereum-cryptography/keccak'

function longToBytes(n: bigint): Uint8Array {
    const buf = new Uint8Array(8)
    let val = n
    for (let i = 0; i < 8; i++) {
        buf[i] = Number(val & 0xffn)
        val >>= 8n
    }
    return buf
}

function hexToBytes(hex: string): Uint8Array {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex
    const bytes = new Uint8Array(h.length / 2)
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export interface Keypair {
    skBytes: Uint8Array
    pkBytes: Uint8Array  // 65 bytes: 04 + x(32) + y(32)
    accountId: string    // last 20 bytes of keccak256(pkBytes without 04), hex
}

export interface TxSign {
    signR: string
    signS: string
    signV: number
}

export interface TxParams {
    nonce: number
    pubkey: string      // hex, no 0x
    to: string
    type: number        // step
    amount: number
    gas_limit: number
    gas_price: number
    shard_id: number
    key?: string
    val?: string
    prefund?: number
    sign_r: string
    sign_s: string
    sign_v: number
    bytes_code?: string
    input?: string
    txHash: string      // keccak256 of signing message, used to poll receipt
}

export function getKeypair(privateKeyHex: string): Keypair {
    const skBytes = hexToBytes(privateKeyHex)
    // uncompressed public key: 65 bytes (04 + x + y)
    const pubKeyUncompressed = secp256k1.getPublicKey(skBytes, false)
    // account ID: keccak256 of the 64-byte pubkey (without 04 prefix), last 20 bytes
    const pubKeyBody = pubKeyUncompressed.slice(1) // drop the 04 prefix byte
    const hash = keccak256(pubKeyBody)
    const accountId = bytesToHex(hash).slice(-40)
    return {
        skBytes,
        pkBytes: pubKeyUncompressed,
        accountId,
    }
}

export interface SignTxInput {
    privateKeyHex: string
    nonce: number
    to: string
    amount: number
    gasLimit?: number
    gasPrice?: number
    step?: number
    contractBytes?: string
    input?: string
    prepay?: number
    key?: string
    val?: string
    shardId?: number
}

export function buildAndSignTx(opts: SignTxInput): TxParams {
    const keypair = getKeypair(opts.privateKeyHex)
    const nonce = BigInt(opts.nonce)
    const amount = BigInt(opts.amount)
    const gasLimit = BigInt(opts.gasLimit ?? 999999)
    const gasPrice = BigInt(opts.gasPrice ?? 1)
    const step = BigInt(opts.step ?? 0)
    const prepay = BigInt(opts.prepay ?? 0)

    // Build signing message (mirrors _sign_message in Python)
    const parts: Uint8Array[] = [
        longToBytes(nonce),
        keypair.pkBytes,             // 65 bytes (with 04 prefix)
        hexToBytes(opts.to),         // 20 bytes
        longToBytes(amount),
        longToBytes(gasLimit),
        longToBytes(gasPrice),
        longToBytes(step),
    ]

    if (opts.contractBytes) {
        parts.push(hexToBytes(opts.contractBytes))
    }
    if (opts.input) {
        parts.push(hexToBytes(opts.input))
    }
    parts.push(longToBytes(prepay))
    if (opts.key) {
        parts.push(new TextEncoder().encode(opts.key))
        if (opts.val) {
            parts.push(new TextEncoder().encode(opts.val))
        }
    }

    // Concatenate
    const totalLen = parts.reduce((sum, p) => sum + p.length, 0)
    const msg = new Uint8Array(totalLen)
    let offset = 0
    for (const p of parts) {
        msg.set(p, offset)
        offset += p.length
    }

    const msgHash = keccak256(msg)
    // sign recoverable (coincurve default: lowS=true canonical form)
    const sig = secp256k1.sign(msgHash, keypair.skBytes)

    const signR = sig.r.toString(16).padStart(64, '0')
    const signS = sig.s.toString(16).padStart(64, '0')
    const signV = sig.recovery ?? 0

    const params: TxParams = {
        nonce: opts.nonce,
        pubkey: bytesToHex(keypair.pkBytes), // 130-char hex, no 0x
        to: opts.to,
        type: opts.step ?? 0,
        amount: opts.amount,
        gas_limit: Number(gasLimit),
        gas_price: Number(gasPrice),
        shard_id: opts.shardId ?? 3,
        prefund: opts.prepay ?? 0,
        sign_r: signR,
        sign_s: signS,
        sign_v: signV,
    }
    if (opts.key !== undefined) params.key = opts.key
    if (opts.val !== undefined) params.val = opts.val
    if (opts.contractBytes) params.bytes_code = opts.contractBytes
    if (opts.input) params.input = opts.input
    return { ...params, txHash: bytesToHex(msgHash) }
}
