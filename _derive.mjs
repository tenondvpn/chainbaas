import { secp256k1 } from 'ethereum-cryptography/secp256k1'
import { keccak256 } from 'ethereum-cryptography/keccak'
const pk = '2b44b32b3ec1bc932c6dab70bd12dc681f9b406404b31bd5036c2be62107f807'
const sk = Uint8Array.from(pk.match(/../g).map(h => parseInt(h, 16)))
const pub = secp256k1.getPublicKey(sk, false)
const body = pub.slice(1)
const h = keccak256(body)
const addr = Array.from(h).map(b => b.toString(16).padStart(2, '0')).join('').slice(-40)
console.log('addr:', addr)
