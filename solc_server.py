#!/usr/bin/env python3
"""Lightweight Solidity compilation HTTP server.
Listens on 127.0.0.1:18080, proxied by nginx at /pipeline/compile_solidity/
"""
import json
import subprocess
import tempfile
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # suppress access logs

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')

        # Parse form-encoded or JSON body
        source_code = ''
        try:
            params = parse_qs(body)
            source_code = params.get('source_code', [''])[0]
        except Exception:
            pass
        if not source_code:
            try:
                j = json.loads(body)
                source_code = j.get('source_code', '')
            except Exception:
                pass

        if not source_code:
            self._reply(400, {'status': 1, 'msg': 'Missing source_code'})
            return

        # Write source to temp file and compile
        with tempfile.NamedTemporaryFile(suffix='.sol', mode='w',
                                         delete=False, encoding='utf-8') as f:
            f.write(source_code)
            tmp = f.name

        try:
            # --evm-version shanghai: node runs evmone 0.11.0 (Shanghai max); solc 0.8.24+
            # defaults to cancun which generates opcodes evmone 0.11.0 doesn't support.
            result = subprocess.run(
                ['solc', '--combined-json', 'abi,bin', '--optimize',
                 '--evm-version', 'shanghai', tmp],
                capture_output=True, text=True, timeout=30
            )
        except subprocess.TimeoutExpired:
            os.unlink(tmp)
            self._reply(200, {'status': 1, 'msg': 'Compilation timed out'})
            return
        finally:
            try:
                os.unlink(tmp)
            except Exception:
                pass

        if result.returncode != 0:
            self._reply(200, {'status': 1, 'msg': result.stderr.strip()})
            return

        try:
            combined = json.loads(result.stdout)
        except Exception as e:
            self._reply(200, {'status': 1, 'msg': 'Failed to parse compiler output: ' + str(e)})
            return

        contracts = combined.get('contracts', {})
        if not contracts:
            self._reply(200, {'status': 1, 'msg': 'No contracts found'})
            return

        # Return the last (main) contract — key format is "file.sol:ContractName"
        main_key = list(contracts.keys())[-1]
        contract = contracts[main_key]
        contract_name = main_key.split(':')[-1]

        abi_raw = contract.get('abi', '[]')
        abi = json.loads(abi_raw) if isinstance(abi_raw, str) else abi_raw
        bytecode = contract.get('bin', '')

        self._reply(200, {
            'status': 0,
            'contract_name': contract_name,
            'abi': json.dumps(abi),
            'bytecode': bytecode,
        })

    def _reply(self, code, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', 18080), Handler)
    print('solc_server listening on 127.0.0.1:18080')
    server.serve_forever()
