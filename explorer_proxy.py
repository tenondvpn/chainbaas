"""
Shardora Explorer HTTP Proxy
Listens on port 30301 and proxies /explorer/* requests to shardora HTTPS nodes.
Each shard is identified by the ?shard_id=N query parameter or by endpoint parameter.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import urlopen, Request
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from urllib.error import URLError
import ssl
import json
import sys

# Shard ID → HTTPS node URL mapping
SHARD_NODES = {
    2: "https://127.0.0.1:22001",  # root shard
    3: "https://127.0.0.1:23001",
    4: "https://127.0.0.1:24001",
    5: "https://127.0.0.1:25001",
    6: "https://127.0.0.1:26001",
}

DEFAULT_SHARD = 3

# SSL context that skips certificate verification (self-signed certs)
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE


class ProxyHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # suppress default access log

    def _resolve_shard(self, qs):
        """Pick the target node URL from query params."""
        # Support ?shard_id=N or ?endpoint=URL
        endpoint = qs.get("endpoint", [None])[0]
        if endpoint:
            return endpoint.rstrip("/")
        shard_id = qs.get("shard_id", [str(DEFAULT_SHARD)])[0]
        try:
            return SHARD_NODES.get(int(shard_id), SHARD_NODES[DEFAULT_SHARD])
        except (ValueError, KeyError):
            return SHARD_NODES[DEFAULT_SHARD]

    def do_GET(self):
        self._handle()

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _handle(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        # Only proxy /explorer/* paths
        if not parsed.path.startswith("/explorer"):
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"code":-1,"msg":"not found"}')
            return

        target_base = self._resolve_shard(qs)

        # Rebuild query string without our internal params
        fwd_qs = {k: v for k, v in qs.items() if k not in ("shard_id", "endpoint")}
        fwd_query = urlencode({k: v[0] for k, v in fwd_qs.items()}, doseq=False) if fwd_qs else ""
        fwd_url = target_base + parsed.path + ("?" + fwd_query if fwd_query else "")

        try:
            req = Request(fwd_url, headers={"Accept": "application/json"})
            with urlopen(req, context=_ssl_ctx, timeout=10) as resp:
                body = resp.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._cors_headers()
                self.end_headers()
                self.wfile.write(body)
        except URLError as e:
            err = json.dumps({"code": -1, "msg": str(e)}).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self._cors_headers()
            self.end_headers()
            self.wfile.write(err)


if __name__ == "__main__":
    import threading

    # Start one listener per shard on its own port
    # port 30302 → shard 2, port 30303 → shard 3, …
    servers = []
    for shard_id, node_url in SHARD_NODES.items():
        listen_port = 30300 + shard_id

        # Bind default shard for this listener
        class _Handler(ProxyHandler):
            _fixed_shard = shard_id
            def _resolve_shard(self, qs):
                ep = qs.get("endpoint", [None])[0]
                if ep:
                    return ep.rstrip("/")
                return SHARD_NODES[self.__class__._fixed_shard]

        _Handler.__name__ = f"ShardHandler{shard_id}"
        srv = HTTPServer(("0.0.0.0", listen_port), _Handler)
        t = threading.Thread(target=srv.serve_forever, daemon=True)
        t.start()
        servers.append(srv)
        print(f"  shard {shard_id} → http://0.0.0.0:{listen_port}  ({node_url})")

    print("All shard proxies running. Ctrl-C to stop.")
    try:
        import time
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        for srv in servers:
            srv.shutdown()
        print("Stopped.")
