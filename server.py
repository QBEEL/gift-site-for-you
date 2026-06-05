# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
"""
gift-site server.py
Run: python server.py
"""

import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
FRONT_DIR  = os.path.join(BASE_DIR, 'frontend')
BACK_DIR   = os.path.join(BASE_DIR, 'backend')

def load_json(filename):
    with open(os.path.join(BACK_DIR, filename), encoding='utf-8') as f:
        return json.load(f)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONT_DIR, **kwargs)

    # ── логирование ─────────────────────────────────────────
    def log_message(self, fmt, *args):
        print(f"  {self.address_string()} → {fmt % args}")

    # ── CORS-заголовки ───────────────────────────────────────
    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    # ── JSON-ответ ───────────────────────────────────────────
    def json_response(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_cors()
        self.end_headers()
        self.wfile.write(body)

    # ── GET ──────────────────────────────────────────────────
    def do_GET(self):
        path = urlparse(self.path).path

        if path == '/chapters':
            chapters = load_json('chapters.json')
            safe = {
                id_: {
                    'title':     ch['title'],
                    'subtitle':  ch['subtitle'],
                    'image':     ch.get('image', ''),
                    'reveal_at': ch.get('reveal_at', None)
                }
                for id_, ch in chapters.items()
            }
            self.json_response(200, safe)
            return

        # Всё остальное — статика frontend
        super().do_GET()

    # ── POST ─────────────────────────────────────────────────
    def do_POST(self):
        path = urlparse(self.path).path

        if path == '/unlock':
            length  = int(self.headers.get('Content-Length', 0))
            body    = json.loads(self.rfile.read(length))
            key     = body.get('key', '').strip().upper()

            keys     = load_json('keys.json')
            chapters = load_json('chapters.json')

            chapter_id = keys.get(key)
            if chapter_id and chapter_id in chapters:
                self.json_response(200, {
                    'success':   True,
                    'chapterId': chapter_id,
                    'chapter':   chapters[chapter_id]
                })
            else:
                self.json_response(403, {'success': False})
            return

        self.json_response(404, {'error': 'Not found'})


if __name__ == '__main__':
    PORT = 3000
    server = HTTPServer(('', PORT), Handler)
    print(f"\n  [*] Server started -> http://localhost:{PORT}\n")
    print(f"  Press Ctrl+C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
