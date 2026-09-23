"""
Shardora Blockchain Query Tool
Connects to the sharding network on 192.168.25.129 via Python.

Usage:
    python3 shardora_query.py

Requires: requests (pip install requests)
"""
import json
import ssl
import sys
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import URLError

# ─── Configuration ──────────────────────────────────────────────────────────
VM_IP = "192.168.25.129"

# Explorer proxy ports (per shard)
SHARD_PROXY = {
    2: f"http://{VM_IP}:30302",   # root shard
    3: f"http://{VM_IP}:30303",
    4: f"http://{VM_IP}:30304",
    5: f"http://{VM_IP}:30305",
    6: f"http://{VM_IP}:30306",
}

# Direct HTTPS node endpoints (for tx send / account query)
SHARD_HTTPS = {
    2: f"https://{VM_IP}:22001",
    3: f"https://{VM_IP}:23001",
    4: f"https://{VM_IP}:24001",
    5: f"https://{VM_IP}:25001",
    6: f"https://{VM_IP}:26001",
}

DEFAULT_SHARD = 3

_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE


# ─── Low-level helpers ───────────────────────────────────────────────────────

def _http_get(url, params=None):
    if params:
        qs = urlencode(params)
        url = url + ("&" if "?" in url else "?") + qs
    req = Request(url, headers={"Accept": "application/json"})
    with urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())


def _https_post_form(base_url, path, data):
    body = urlencode(data).encode()
    req = Request(base_url + path, data=body,
                  headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urlopen(req, context=_ssl_ctx, timeout=10) as r:
        return json.loads(r.read().decode())


def _eth_rpc(shard_id, method, params=None):
    base = SHARD_HTTPS[shard_id]
    body = json.dumps({
        "jsonrpc": "2.0", "method": method,
        "params": params or [], "id": 1
    }).encode()
    req = Request(base + "/eth", data=body,
                  headers={"Content-Type": "application/json"})
    with urlopen(req, context=_ssl_ctx, timeout=10) as r:
        return json.loads(r.read().decode())


# ─── Explorer API (read-only) ────────────────────────────────────────────────

def get_chain_info(shard_id=DEFAULT_SHARD):
    """Overall chain statistics for a shard."""
    return _http_get(SHARD_PROXY[shard_id] + "/explorer/chain-info")


def get_blocks(shard_id=DEFAULT_SHARD, limit=10, cursor=None):
    """Latest blocks from a shard."""
    params = {"limit": limit}
    if cursor:
        params["cursor"] = cursor
    return _http_get(SHARD_PROXY[shard_id] + "/explorer/blocks", params)


def get_block(hash_hex, shard_id=DEFAULT_SHARD):
    """Block detail by hash."""
    return _http_get(SHARD_PROXY[shard_id] + "/explorer/block", {"hash": hash_hex})


def get_transactions(shard_id=DEFAULT_SHARD, limit=10, cursor=None, block_hash=None):
    """Latest transactions from a shard."""
    params = {"limit": limit}
    if cursor:
        params["cursor"] = cursor
    if block_hash:
        params["block_hash"] = block_hash
    return _http_get(SHARD_PROXY[shard_id] + "/explorer/transactions", params)


def get_transaction(tx_hash, shard_id=DEFAULT_SHARD):
    """Transaction detail by hash."""
    return _http_get(SHARD_PROXY[shard_id] + "/explorer/transaction", {"tx_hash": tx_hash})


def get_address(addr, shard_id=DEFAULT_SHARD):
    """Address / account detail."""
    return _http_get(SHARD_PROXY[shard_id] + "/explorer/address", {"addr": addr})


def get_address_txs(addr, shard_id=DEFAULT_SHARD, limit=10):
    """Transaction history for an address."""
    return _http_get(SHARD_PROXY[shard_id] + "/explorer/address_txs",
                     {"addr": addr, "limit": limit})


def get_contracts(shard_id=DEFAULT_SHARD, limit=20):
    """Deployed contracts list."""
    return _http_get(SHARD_PROXY[shard_id] + "/explorer/contracts", {"limit": limit})


def get_contract(addr, shard_id=DEFAULT_SHARD):
    """Contract detail by address."""
    return _http_get(SHARD_PROXY[shard_id] + "/explorer/contract", {"addr": addr})


# ─── Node API (eth RPC + account) ───────────────────────────────────────────

def get_block_number(shard_id=DEFAULT_SHARD):
    """Current block number on a shard."""
    r = _eth_rpc(shard_id, "eth_blockNumber")
    return int(r["result"], 16) if "result" in r else r


def get_balance_eth(address, shard_id=DEFAULT_SHARD):
    """Account balance (via eth_getBalance, returns hex wei)."""
    r = _eth_rpc(shard_id, "eth_getBalance", [address, "latest"])
    if "result" in r:
        return int(r["result"], 16)
    return r


def get_account(address, shard_id=DEFAULT_SHARD):
    """Full account info (balance, nonce, etc.) via /query_account."""
    return _https_post_form(SHARD_HTTPS[shard_id], "/query_account",
                            {"address": address.lstrip("0x")})


def get_receipt(tx_hash, shard_id=DEFAULT_SHARD):
    """Transaction receipt by hash."""
    return _https_post_form(SHARD_HTTPS[shard_id], "/transaction_receipt",
                            {"tx_hash": tx_hash.lstrip("0x")})


def query_contract_raw(from_addr, contract_addr, input_hex, shard_id=DEFAULT_SHARD):
    """Raw contract query (ABI-encoded input)."""
    return _https_post_form(SHARD_HTTPS[shard_id], "/abi_query_contract",
                            {"from": from_addr.lstrip("0x"),
                             "address": contract_addr.lstrip("0x"),
                             "input": input_hex})


# ─── Demo / CLI ──────────────────────────────────────────────────────────────

def _pp(label, data):
    print(f"\n{'─'*60}")
    print(f"  {label}")
    print(f"{'─'*60}")
    if isinstance(data, dict) and "data" in data:
        payload = data["data"]
    else:
        payload = data
    print(json.dumps(payload, indent=2, ensure_ascii=False)[:1200])


def demo():
    print("=" * 60)
    print("  Shardora Blockchain Query Demo")
    print(f"  VM: {VM_IP}")
    print("=" * 60)

    # 1. Chain overview
    for sid in [2, 3]:
        try:
            info = get_chain_info(sid)
            _pp(f"chain-info shard {sid}", info)
        except Exception as e:
            print(f"  [shard {sid}] chain-info error: {e}")

    # 2. Latest blocks (shard 3)
    try:
        blocks = get_blocks(shard_id=3, limit=3)
        _pp("latest 3 blocks (shard 3)", blocks)
    except Exception as e:
        print(f"  get_blocks error: {e}")

    # 3. Latest transactions (shard 3)
    try:
        txs = get_transactions(shard_id=3, limit=3)
        _pp("latest 3 transactions (shard 3)", txs)
    except Exception as e:
        print(f"  get_transactions error: {e}")

    # 4. Block number via eth RPC
    for sid in [2, 3, 4, 5, 6]:
        try:
            bn = get_block_number(sid)
            print(f"  shard {sid} block_number = {bn}")
        except Exception as e:
            print(f"  shard {sid} block_number error: {e}")

    # 5. Contracts
    try:
        contracts = get_contracts(shard_id=3, limit=5)
        _pp("contracts (shard 3)", contracts)
    except Exception as e:
        print(f"  get_contracts error: {e}")

    print("\n  Done.")


if __name__ == "__main__":
    demo()
