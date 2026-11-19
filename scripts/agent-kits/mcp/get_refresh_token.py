#!/usr/bin/env python3
"""
Получение GOOGLE_REFRESH_TOKEN для calendar_mcp.py — один раз, на своём компьютере.

    GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... python3 get_refresh_token.py

Нужен OAuth-клиент Google типа «Desktop app» (см. docs/02-google-setup.md).
Скрипт откроет браузер, вы войдёте в аккаунт с календарём и разрешите доступ;
Google вернёт код на адрес 127.0.0.1 — скрипт обменяет его на refresh token
и напечатает его. Токен никуда не отправляется, кроме Google.

Доступ, который запрашивается:
  calendar.events   — читать и создавать события
  calendar.freebusy — видеть занятость
"""
import base64
import hashlib
import http.server
import json
import os
import secrets
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser

AUTH_URL = os.environ.get("GOOGLE_AUTH_URL", "https://accounts.google.com/o/oauth2/v2/auth")
TOKEN_URL = os.environ.get("GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com/token")
SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy"


def main():
    cid, secret = os.environ.get("GOOGLE_CLIENT_ID"), os.environ.get("GOOGLE_CLIENT_SECRET")
    if not cid or not secret:
        sys.exit("Задайте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET (OAuth-клиент типа Desktop app)")
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(16)
    got = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):  # noqa: N802
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if q.get("state", [""])[0] != state:
                self.send_response(400)
                self.end_headers()
                self.wfile.write("Неверный state — закройте вкладку и запустите скрипт заново.".encode())
                return
            got["code"] = q.get("code", [""])[0]
            got["error"] = q.get("error", [""])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("<p>Готово. Вернитесь в терминал — вкладку можно закрыть.</p>".encode())

    httpd = http.server.HTTPServer(("127.0.0.1", int(os.environ.get("OAUTH_PORT", "0"))), Handler)
    redirect = f"http://127.0.0.1:{httpd.server_address[1]}"
    url = AUTH_URL + "?" + urllib.parse.urlencode({
        "client_id": cid, "redirect_uri": redirect, "response_type": "code", "scope": SCOPES,
        "access_type": "offline", "prompt": "consent", "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256"})
    print("Откройте в браузере (если не открылся сам):\n" + url + "\n", flush=True)
    if not os.environ.get("NO_BROWSER"):
        webbrowser.open(url)
    t = threading.Thread(target=httpd.handle_request)
    t.start()
    t.join(timeout=600)
    if not got.get("code"):
        sys.exit(f"Код не получен: {got.get('error') or 'время вышло'}")
    body = urllib.parse.urlencode({"code": got["code"], "client_id": cid, "client_secret": secret,
                                   "redirect_uri": redirect, "grant_type": "authorization_code",
                                   "code_verifier": verifier}).encode()
    req = urllib.request.Request(TOKEN_URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            res = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit("Google отказал: " + e.read().decode()[:500])
    if "refresh_token" not in res:
        sys.exit("Google не вернул refresh_token. Отзовите доступ на myaccount.google.com/permissions и повторите.")
    print("GOOGLE_REFRESH_TOKEN=" + res["refresh_token"])
    print("\nСохраните его как переменную окружения сервера. Никому не пересылайте.")


if __name__ == "__main__":
    main()
