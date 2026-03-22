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
        elif self.path == "/api/fetch-ics":
            self._fetch_ics()
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

    def _fetch_ics(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(body)
            url = payload.get("url", "")
        except (json.JSONDecodeError, AttributeError):
            self.send_error(400, "Invalid JSON")
            return

        # Only allow .ics URLs from known calendar providers
        if not url or not any(
            h in url.lower()
            for h in ["outlook.office365.com", "outlook.live.com", "calendar.google.com",
                       "calendar.yahoo.com", ".ics"]
        ):
            self.send_error(400, "URL must be an ICS calendar link")
            return

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MeetingMeter/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                # Basic sanity check
                if not data[:15].startswith(b"BEGIN:VCALENDAR"):
                    self.send_error(400, "Not a valid ICS file")
                    return
                self.send_response(200)
                self.send_header("Content-Type", "text/calendar")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

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
