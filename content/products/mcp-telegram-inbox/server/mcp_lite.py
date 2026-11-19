"""
mcp_lite — минимальный MCP-сервер на стандартной библиотеке Python (3.8+).

Транспорты:
  stdio            — для Claude Desktop, Claude Code, Cursor: клиент сам запускает процесс;
  streamable HTTP  — для n8n (MCP Client Tool) и других клиентов по сети: POST /mcp,
                     ответ одним JSON (без SSE), без сессий.

Сервер описывает инструменты через Server.tool(...). Каждый инструмент получает
словарь аргументов и возвращает dict (уходит модели как JSON и как structuredContent)
или бросает ToolError — тогда модель видит текст ошибки с isError=true.

Этот файл одинаковый во всех наших MCP-наборах.
"""
import hmac
import json
import os
import sys
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]


class ToolError(Exception):
    """Ошибка, которую стоит показать модели: неверные аргументы, отказ правила, недоступный сервис."""


class Server:
    def __init__(self, name, version, instructions=""):
        self.name = name
        self.version = version
        self.instructions = instructions
        self.tools = {}
        self.lock = threading.Lock()

    # ---------- описание инструментов ----------
    def tool(self, name, description, properties, required=None, read_only=False, destructive=False,
             idempotent=False, open_world=True, title=None):
        def wrap(fn):
            self.tools[name] = {
                "fn": fn,
                "spec": {
                    "name": name,
                    "title": title or name,
                    "description": description,
                    "inputSchema": {"type": "object", "properties": properties,
                                    "required": required if required is not None else [],
                                    "additionalProperties": False},
                    "annotations": {"title": title or name, "readOnlyHint": read_only, "destructiveHint": destructive,
                                    "idempotentHint": idempotent, "openWorldHint": open_world},
                },
            }
            return fn
        return wrap

    # ---------- JSON-RPC ----------
    def handle(self, msg):
        """Один JSON-RPC запрос или уведомление → ответ (dict) или None."""
        if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0":
            return _error(None, -32600, "Invalid Request")
        mid = msg.get("id")
        method = msg.get("method")
        if method is None:  # ответ клиента на наш запрос — мы их не шлём
            return None
        params = msg.get("params") or {}
        if mid is None:  # уведомление
            return None
        try:
            if method == "initialize":
                asked = params.get("protocolVersion")
                version = asked if asked in PROTOCOL_VERSIONS else PROTOCOL_VERSIONS[0]
                result = {"protocolVersion": version,
                          "capabilities": {"tools": {"listChanged": False}},
                          "serverInfo": {"name": self.name, "version": self.version}}
                if self.instructions:
                    result["instructions"] = self.instructions
                return _result(mid, result)
            if method == "ping":
                return _result(mid, {})
            if method == "tools/list":
                return _result(mid, {"tools": [t["spec"] for t in self.tools.values()]})
            if method == "tools/call":
                return _result(mid, self.call(params.get("name"), params.get("arguments") or {}))
            if method in ("resources/list", "prompts/list"):
                return _result(mid, {method.split("/")[0]: []})
            return _error(mid, -32601, f"Method not found: {method}")
        except Exception as e:  # noqa: BLE001
            return _error(mid, -32603, f"Internal error: {e}")

    def call(self, name, args):
        tool = self.tools.get(name)
        if not tool:
            return _text(f"Unknown tool: {name}", error=True)
        problem = _validate(tool["spec"]["inputSchema"], args)
        if problem:
            return _text(problem, error=True)
        try:
            with self.lock:
                out = tool["fn"](args)
        except ToolError as e:
            return _text(str(e), error=True)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc(file=sys.stderr)
            return _text(f"Внутренняя ошибка сервера: {e}", error=True)
        text = json.dumps(out, ensure_ascii=False, indent=1)
        return {"content": [{"type": "text", "text": text}], "structuredContent": out, "isError": False}

    # ---------- транспорты ----------
    def run_stdio(self):
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except ValueError:
                _write(_error(None, -32700, "Parse error"))
                continue
            if isinstance(msg, list):  # батчи из старых версий протокола
                out = [r for r in (self.handle(m) for m in msg) if r]
                if out:
                    _write(out)
                continue
            reply = self.handle(msg)
            if reply is not None:
                _write(reply)

    def run_http(self, host, port, token, allowed_origins=()):
        server = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, fmt, *a):  # тише: только ошибки
                pass

            def _send(self, code, body=None):
                data = b"" if body is None else json.dumps(body, ensure_ascii=False).encode()
                self.send_response(code)
                if body is not None:
                    self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def _allowed(self):
                origin = self.headers.get("Origin")
                if origin and origin not in allowed_origins:
                    self._send(403, {"error": "origin not allowed"})
                    return False
                if token:
                    got = self.headers.get("Authorization", "")
                    if not hmac.compare_digest(got.encode(), f"Bearer {token}".encode()):
                        self._send(401, {"error": "unauthorized"})
                        return False
                return True

            def do_GET(self):  # noqa: N802
                if self.path.rstrip("/") == "/health":
                    return self._send(200, {"ok": True, "name": server.name})
                self._send(405, {"error": "this server answers POST /mcp only"})

            def do_DELETE(self):  # noqa: N802
                self._send(405, {"error": "no sessions"})

            def do_POST(self):  # noqa: N802
                if self.path.split("?")[0].rstrip("/") != "/mcp":
                    return self._send(404, {"error": "not found"})
                if not self._allowed():
                    return
                length = int(self.headers.get("Content-Length") or 0)
                if length > 1_000_000:
                    return self._send(413, {"error": "too large"})
                try:
                    msg = json.loads(self.rfile.read(length) or b"null")
                except ValueError:
                    return self._send(400, _error(None, -32700, "Parse error"))
                if isinstance(msg, list):
                    out = [r for r in (server.handle(m) for m in msg) if r]
                    return self._send(200, out) if out else self._send(202)
                reply = server.handle(msg)
                return self._send(202) if reply is None else self._send(200, reply)

        httpd = ThreadingHTTPServer((host, port), Handler)
        print(f"{self.name}: http://{host}:{port}/mcp", file=sys.stderr, flush=True)
        httpd.serve_forever()

    def main(self, argv=None):
        """--http [PORT] — HTTP; без флага — stdio. Токен HTTP — из MCP_HTTP_TOKEN."""
        argv = sys.argv[1:] if argv is None else argv
        if "--http" in argv:
            i = argv.index("--http")
            port = int(argv[i + 1]) if len(argv) > i + 1 and argv[i + 1].isdigit() else 8765
            host = os.environ.get("MCP_HTTP_HOST", "127.0.0.1")
            token = os.environ.get("MCP_HTTP_TOKEN", "")
            if not token and host not in ("127.0.0.1", "localhost", "::1"):
                sys.exit("MCP_HTTP_TOKEN обязателен, если сервер слушает не localhost")
            origins = tuple(o for o in os.environ.get("MCP_ALLOWED_ORIGINS", "").split(",") if o)
            self.run_http(host, port, token, origins)
        else:
            self.run_stdio()


# ---------- helpers ----------

def _result(mid, result):
    return {"jsonrpc": "2.0", "id": mid, "result": result}


def _error(mid, code, message):
    return {"jsonrpc": "2.0", "id": mid, "error": {"code": code, "message": message}}


def _text(text, error=False):
    return {"content": [{"type": "text", "text": text}], "isError": error}


def _write(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


_TYPES = {"string": str, "integer": int, "number": (int, float), "boolean": bool, "object": dict, "array": list}


def _validate(schema, args):
    """Проверка аргументов по верхнему уровню схемы: обязательные поля, типы, лишние поля, enum."""
    if not isinstance(args, dict):
        return "Аргументы должны быть объектом"
    props = schema.get("properties", {})
    for key in schema.get("required", []):
        if key not in args or args[key] in (None, ""):
            return f"Не хватает аргумента {key}"
    for key, value in args.items():
        if key not in props:
            return f"Неизвестный аргумент {key}"
        spec = props[key]
        want = spec.get("type")
        if want and value is not None:
            ok = isinstance(value, _TYPES[want]) and not (want in ("integer", "number") and isinstance(value, bool))
            if not ok:
                return f"Аргумент {key} должен быть типа {want}"
        if "enum" in spec and value not in spec["enum"]:
            return f"Аргумент {key}: допустимо одно из {spec['enum']}"
    return None


def http_json(method, url, body=None, headers=None, timeout=30, form=False):
    """HTTP-запрос к внешнему API. Возвращает (status, json|text). Не бросает на 4xx/5xx."""
    import urllib.error
    import urllib.parse
    import urllib.request
    h = {"Accept": "application/json", "User-Agent": "insider-mcp/1.0"}
    h.update(headers or {})
    data = None
    if body is not None:
        if form:
            data = urllib.parse.urlencode(body).encode()
            h["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body, ensure_ascii=False).encode()
            h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
            status = r.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        status = e.code
    except Exception as e:  # noqa: BLE001  сеть, DNS, таймаут
        raise ToolError(f"Сервис недоступен: {e}")
    try:
        return status, json.loads(raw) if raw.strip() else {}
    except ValueError:
        return status, raw


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(path, data):
    tmp = path + ".tmp"
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)
