#!/usr/bin/env python3
"""
Проверка MCP-конфигов перед тем, как дать агенту доступ к рабочим системам.

    python3 check_mcp_config.py .mcp.json ~/.cursor/mcp.json "~/Library/Application Support/Claude/claude_desktop_config.json"

Находит:
  ОШИБКА  архивные серверы без обновлений безопасности (@modelcontextprotocol/server-postgres, -github, -slack…);
  ОШИБКА  токены и пароли, вписанные прямо в файл, а не взятые из переменных окружения;
  ОШИБКА  адреса http:// не на localhost — токен уйдёт открытым текстом;
  ВНИМАНИЕ DBHub с --dsn без --config — режим «только чтение» не включён;
  ВНИМАНИЕ GitHub с правом записи (адрес без /readonly, нет GITHUB_READ_ONLY=1).

Код выхода 1, если есть ошибки — можно вставить в CI. Только стандартная библиотека Python 3.8+.
"""
import json
import os
import re
import sys

ARCHIVED = {
    "@modelcontextprotocol/server-postgres": "DBHub (@bytebase/dbhub) — docs/03-postgres.md",
    "@modelcontextprotocol/server-github": "официальный github/github-mcp-server — docs/05-github.md",
    "@modelcontextprotocol/server-slack": "официальный https://mcp.slack.com/mcp — docs/04-slack.md",
    "@modelcontextprotocol/server-gitlab": "https://gitlab.com/api/v4/mcp",
    "@modelcontextprotocol/server-puppeteer": "microsoft/playwright-mcp",
    "@modelcontextprotocol/server-redis": "redis/mcp-redis",
    "@modelcontextprotocol/server-sentry": "https://mcp.sentry.dev/mcp",
    "@modelcontextprotocol/server-sqlite": "DBHub в режиме sqlite",
    "@modelcontextprotocol/server-gdrive": "официальные серверы Google Workspace",
    "@modelcontextprotocol/server-google-maps": "поддерживаемый сервер Google Maps",
    "@modelcontextprotocol/server-brave-search": "официальный сервер Brave Search",
    "@modelcontextprotocol/server-aws-kb-retrieval": "awslabs/mcp",
    "@modelcontextprotocol/server-everart": "—",
}
DOCKER_ARCHIVED = re.compile(r"^mcp/(github|postgres|slack|gitlab|puppeteer|redis|sentry|sqlite|gdrive)(:.*)?$")
SECRET = [
    (re.compile(r"\bghp_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}"), "токен GitHub"),
    (re.compile(r"\bxox[abpr]-[A-Za-z0-9-]{10,}"), "токен Slack"),
    (re.compile(r"\bsk-(ant-|proj-)?[A-Za-z0-9_-]{20,}"), "ключ OpenAI или Anthropic"),
    (re.compile(r"\bpat-(na|eu)\d?-[0-9a-f-]{20,}"), "токен HubSpot"),
    (re.compile(r"\bntn_[A-Za-z0-9]{20,}|\bsecret_[A-Za-z0-9]{30,}"), "токен Notion"),
    (re.compile(r"\b\d{8,10}:[A-Za-z0-9_-]{30,}"), "токен Telegram-бота"),
    (re.compile(r"\b(postgres(ql)?|mysql|mariadb|sqlserver)://[^:/@\s]+:(?!\$\{)[^@\s]+@"), "пароль базы в строке подключения"),
]
SENSITIVE_KEYS = re.compile(r"(token|secret|password|passwd|api[_-]?key|pat)$", re.I)
PLACEHOLDER = re.compile(r"^\$\{[^}]+\}$|^\$\{env:[^}]+\}$|ВСТАВЬТЕ|ВАШ|ЗАМЕНИТЕ|ПАРОЛЬ|YOUR|REPLACE|<.+>|^$")


def strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from strings(v)


def check_server(name, srv):
    errors, warns = [], []
    args = [str(a) for a in srv.get("args", [])]
    cmd = str(srv.get("command", ""))
    joined = " ".join([cmd] + args)
    for pkg, repl in ARCHIVED.items():
        if any(a == pkg or a.startswith(pkg + "@") for a in args):
            errors.append(f"архивный сервер {pkg} — без обновлений безопасности. Замена: {repl}")
    for a in args:
        if DOCKER_ARCHIVED.match(a):
            errors.append(f"архивный Docker-образ {a}")
    for s in strings(srv):
        for rx, what in SECRET:
            if rx.search(s):
                errors.append(f"{what} вписан прямо в файл — перенесите в переменную окружения")
    for key, value in list((srv.get("env") or {}).items()) + list((srv.get("headers") or {}).items()):
        v = str(value)
        if (SENSITIVE_KEYS.search(key) or key.lower() == "authorization") and not PLACEHOLDER.search(v.replace("Bearer ", "")):
            if "${" not in v:
                warns.append(f"{key}: значение задано прямо в файле. Лучше ${{ПЕРЕМЕННАЯ}}, если клиент это поддерживает")
    url = str(srv.get("url", ""))
    for u in [url] + [a for a in args if a.startswith("http")]:
        if u.startswith("http://") and not re.match(r"http://(localhost|127\.0\.0\.1|\[::1\])([:/]|$)", u):
            errors.append(f"{u}: http без шифрования — токен уйдёт открытым текстом")
    if "@bytebase/dbhub" in joined and "--dsn" in args and "--config" not in args:
        warns.append("DBHub с --dsn: execute_sql может писать в базу. Используйте --config с readonly = true (configs/dbhub.toml)")
    if "api.githubcopilot.com/mcp" in url and "readonly" not in url and "X-MCP-Readonly" not in json.dumps(srv):
        warns.append("GitHub с правом записи. Если агенту нужно только читать — адрес .../mcp/readonly")
    if "github-mcp-server" in joined and str((srv.get("env") or {}).get("GITHUB_READ_ONLY", "")) not in ("1", "true"):
        warns.append("локальный GitHub без GITHUB_READ_ONLY=1 — агент сможет писать")
    return errors, warns


def main(paths):
    if not paths:
        print(__doc__)
        return 2
    total_errors = 0
    for path in paths:
        path = os.path.expanduser(path)
        print(f"\n{path}")
        try:
            with open(path, encoding="utf-8") as f:
                cfg = json.load(f)
        except FileNotFoundError:
            print("  пропущен: файла нет")
            continue
        except ValueError as e:
            print(f"  ОШИБКА  файл не JSON: {e}")
            total_errors += 1
            continue
        servers = cfg.get("mcpServers") or cfg.get("servers") or {}
        if not servers:
            print("  серверов нет")
        for name, srv in servers.items():
            errors, warns = check_server(name, srv)
            total_errors += len(errors)
            status = "ОШИБКИ" if errors else ("есть замечания" if warns else "ок")
            print(f"  {name}: {status}")
            for e in errors:
                print(f"    ОШИБКА   {e}")
            for w in warns:
                print(f"    ВНИМАНИЕ {w}")
    print(f"\nОшибок: {total_errors}")
    return 1 if total_errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
