#!/usr/bin/env python3
"""MeetingMeter dev server — static files + Microsoft auth proxy (CORS bypass).
Proxies /api/devicecode and /api/token to Microsoft endpoints.
Stores nothing. Logs nothing. Pure pass-through."""

import http.server
import urllib.request
import urllib.parse
import json
import os
import sys

PORT = 8989
MS_AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0"
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_POST(self):
        if self.path == "/api/devicecode":
            self._proxy(f"{MS_AUTHORITY}/devicecode")
        elif self.path == "/api/token":
            self._proxy(f"{MS_AUTHORITY}/token")
        else:
            self.send_error(404)

    def _proxy(self, url):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""

        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        # Minimal logging
        if "/api/" in (args[0] if args else ""):
            sys.stderr.write(f"[proxy] {args[0]}\n")

if __name__ == "__main__":
    print(f"MeetingMeter server on http://0.0.0.0:{PORT}")
    http.server.HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
