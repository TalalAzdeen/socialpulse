#!/usr/bin/env python3
"""SocialPulse local Python adapter. Python 3.10+, standard library only.
Production uses the equivalent Worker adapter in worker/index.js.
"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from pathlib import Path
from datetime import date, timedelta, datetime, timezone
from threading import Lock
import json
import os
import re
import time

ROOT = Path(__file__).resolve().parent
HOSTS = ('https://public.api.bsky.app', 'https://api.bsky.app')
PUBLIC_FILES = {'/': ('index.html', 'text/html'), '/app.js': ('app.js', 'text/javascript'), '/styles.css': ('styles.css', 'text/css'), '/core.js': ('src/core.js', 'text/javascript')}
SECURITY = {'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src https: data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}
RATE = {}
RATE_LOCK = Lock()

class SourceError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status

def validate_search(q):
    term = q.get('q', [''])[0].strip()
    if not term or len(term) > 180:
        raise ValueError('أدخل عبارة بحث من ١ إلى ١٨٠ حرفًا.')
    raw_limit = q.get('limit', ['40'])[0]
    if not re.fullmatch(r'\d+', raw_limit) or not 1 <= int(raw_limit) <= 100:
        raise ValueError('عدد النتائج يجب أن يكون بين ١ و١٠٠.')
    mode = q.get('sort', ['latest'])[0]
    if mode not in ('latest', 'top'):
        raise ValueError('ترتيب النتائج غير صالح.')
    params = {'q': term, 'sort': mode, 'limit': int(raw_limit)}
    lang = q.get('lang', [''])[0]
    if lang:
        if lang not in ('ar', 'en'):
            raise ValueError('اللغة غير صالحة.')
        params['lang'] = lang
    cursor = q.get('cursor', [''])[0]
    if len(cursor) > 2000 or re.search(r'[\x00-\x1f]', cursor):
        raise ValueError('مؤشر الصفحة غير صالح.')
    if cursor:
        params['cursor'] = cursor
    dates = {}
    for key in ('since', 'until'):
        value = q.get(key, [''])[0]
        if value:
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
                raise ValueError('التاريخ غير صالح.')
            dates[key] = date.fromisoformat(value)
    if dates.get('since') and dates.get('until') and dates['since'] > dates['until']:
        raise ValueError('تاريخ البداية يجب أن يسبق النهاية.')
    for key, value in dates.items():
        try:
            params[key] = (value + (timedelta(days=1) if key == 'until' else timedelta())).isoformat() + 'T00:00:00.000Z'
        except OverflowError as exc:
            raise ValueError('التاريخ خارج النطاق المدعوم.') from exc
    return params

def get_json(endpoint, params):
    for host in HOSTS:
        try:
            req = Request(f'{host}/xrpc/{endpoint}?{urlencode(params)}', headers={'User-Agent': 'SocialPulse/2.0', 'Accept': 'application/json'})
            with urlopen(req, timeout=10) as response:
                return json.load(response)
        except HTTPError as exc:
            if exc.code == 429:
                raise SourceError('Bluesky يقيّد الطلبات مؤقتًا. انتظر دقيقة ثم أعد المحاولة.', 429) from exc
        except (URLError, TimeoutError, ValueError, OSError):
            pass
    raise SourceError('تعذر جلب البيانات من Bluesky حاليًا. قد يكون البحث العام مقيّدًا أو المصدر غير متاح. لم تُنشأ نتائج بديلة.')

class Handler(BaseHTTPRequestHandler):
    def respond(self, status, data, mime='application/json', extra=None):
        if mime == 'application/json':
            data = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        for key, value in {**SECURITY, 'Content-Type': mime+'; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': str(len(data)), **(extra or {})}.items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)

    def do_POST(self):
        self.respond(405, {'error': 'الطريقة غير مدعومة.'}, extra={'Allow':'GET, HEAD'})
    do_PUT = do_DELETE = do_PATCH = do_POST

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in PUBLIC_FILES:
            path, mime = PUBLIC_FILES[parsed.path]
            return self.respond(200, (ROOT / path).read_bytes(), mime)
        if parsed.path == '/api/status':
            return self.respond(200, {'status':'ok', 'version':'2.0.0', 'source':'Bluesky public API', 'upstream':'not-checked', 'sentiment':'local-lexicon'})
        if parsed.path not in ('/api/search', '/api/thread'):
            return self.respond(404, {'error':'المسار غير موجود.'})
        q = parse_qs(parsed.query, keep_blank_values=True)
        try:
            if parsed.path == '/api/search':
                params = validate_search(q)
            else:
                uri = q.get('uri', [''])[0]
                if len(uri) > 500 or not re.fullmatch(r'at://[a-zA-Z0-9.:%_-]+/app\.bsky\.feed\.post/[a-zA-Z0-9_-]+', uri):
                    raise ValueError('رابط المنشور غير صالح.')
                params = {'uri':uri, 'depth':3, 'parentHeight':0}
        except ValueError as exc:
            return self.respond(400, {'error':str(exc)})
        now = time.monotonic()
        ip = self.client_address[0]
        with RATE_LOCK:
            if len(RATE) > 2000:
                expired = [key for key, entry in RATE.items() if entry[1] <= now]
                for key in expired:
                    del RATE[key]
            count, reset = RATE.get(ip, (0, now+60))
            if reset <= now:
                count, reset = 0, now+60
            RATE[ip] = (count+1, reset)
        if count >= 30:
            return self.respond(429, {'error':'طلبات كثيرة. انتظر دقيقة.'}, extra={'Retry-After':'60'})
        try:
            if parsed.path == '/api/search':
                result = get_json('app.bsky.feed.searchPosts', params)
                if not isinstance(result.get('posts'), list):
                    raise SourceError('استجابة غير متوقعة من المصدر.')
                return self.respond(200, {'posts':result['posts'], 'cursor':result.get('cursor'), 'source':'Bluesky', 'query':params['q'], 'collectedAt':datetime.now(timezone.utc).isoformat()})
            result = get_json('app.bsky.feed.getPostThread', params)
            if not result.get('thread'):
                raise SourceError('لا توجد سلسلة ردود متاحة.')
            return self.respond(200, result)
        except SourceError as exc:
            return self.respond(exc.status, {'error':str(exc)}, extra={'Retry-After':'60'} if exc.status == 429 else {})
        except Exception:
            return self.respond(502, {'error':'تعذر قراءة استجابة المصدر.'})

if __name__ == '__main__':
    port = int(os.getenv('PORT', '8787'))
    print(f'SocialPulse: http://localhost:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
