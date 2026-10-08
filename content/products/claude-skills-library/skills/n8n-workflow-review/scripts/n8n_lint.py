#!/usr/bin/env python3
"""Find the problems in an exported n8n workflow that break it in production.

    python3 n8n_lint.py workflow.json

Reads the JSON that n8n produces with "Download" or "Copy to clipboard".
Reports findings with a severity: critical, high, medium, low, info.
Secrets are masked in the output. Exit code 1 when anything is critical or
high. Standard library only.
"""
import json
import re
import sys

SECRET_PATTERNS = [
    ("OpenAI-style key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}")),
    ("Anthropic key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}")),
    ("Bearer token", re.compile(r"\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*")),
    ("Slack token", re.compile(r"\bxox[abpors]-[A-Za-z0-9-]{10,}")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}")),
    ("Telegram bot token", re.compile(r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b")),
    ("Stripe key", re.compile(r"\b[sr]k_(?:live|test)_[A-Za-z0-9]{20,}")),
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
]
SECRET_NAME = re.compile(r"(api[_-]?key|apikey|token|secret|password|passwd|authorization|access[_-]?key)", re.I)
DEFAULT_NAME = re.compile(
    r"^(HTTP Request|Code|Set|Edit Fields|If|Switch|Merge|Webhook|Function|Function Item|Wait|"
    r"Respond to Webhook|AI Agent|Basic LLM Chain|OpenAI|Gmail|Google Sheets|Telegram|Slack|"
    r"Schedule Trigger|Filter|Loop Over Items|Split Out|Aggregate|Execute Workflow)\d*$"
)
TRIGGER = re.compile(r"trigger|webhook$|\.cron$|\.start$|formTrigger|chatTrigger", re.I)
ORDER = ["critical", "high", "medium", "low", "info"]


def mask(value):
    value = str(value)
    return value[:6] + "…" + value[-2:] if len(value) > 12 else "…"


def strings(node, path=""):
    if isinstance(node, dict):
        for key, value in node.items():
            for item in strings(value, "%s.%s" % (path, key) if path else key):
                yield item
    elif isinstance(node, list):
        for index, value in enumerate(node):
            for item in strings(value, "%s[%d]" % (path, index)):
                yield item
    elif isinstance(node, str):
        yield path, node


def is_expression(value):
    return value.startswith("=") or "{{" in value or "$env" in value or "$credentials" in value or "$secrets" in value


def main():
    if len(sys.argv) != 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return 2
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    if isinstance(data, list):
        data = data[0]
    nodes = data.get("nodes") or []
    connections = data.get("connections") or {}
    settings = data.get("settings") or {}
    findings = []

    def add(severity, rule, node, detail, fix):
        findings.append({"severity": severity, "rule": rule, "node": node, "detail": detail, "fix": fix})

    if not nodes:
        raise SystemExit("В файле нет узлов: это не экспорт воркфлоу n8n.")

    incoming, outgoing = set(), set()
    for source, outputs in connections.items():
        for branches in outputs.values():
            for branch in branches or []:
                for link in branch or []:
                    outgoing.add(source)
                    incoming.add(link.get("node"))

    has_error_trigger = any("errorTrigger" in (n.get("type") or "") for n in nodes)
    sticky = [n for n in nodes if "stickyNote" in (n.get("type") or "")]
    work_nodes = [n for n in nodes if n not in sticky]

    for node in work_nodes:
        name, kind = node.get("name", "?"), node.get("type", "")
        params = node.get("parameters") or {}

        for path, value in strings(params):
            for label, pattern in SECRET_PATTERNS:
                hit = pattern.search(value)
                if hit:
                    add("critical", "secret_in_node", name,
                        "%s в параметре `%s`: %s" % (label, path, mask(hit.group(0))),
                        "Перенесите в учётные данные n8n (Credentials) и перевыпустите ключ: он уже попал в экспорт.")
                    break
            else:
                leaf = re.split(r"[.\[]", path)[-1] if path else ""
                if SECRET_NAME.search(leaf) and len(value) >= 12 and not is_expression(value) and " " not in value:
                    add("high", "possible_secret", name,
                        "Параметр `%s` похож на секрет, записанный текстом: %s" % (path, mask(value)),
                        "Проверьте. Если это ключ — перенесите в Credentials и перевыпустите.")

        if kind.endswith(".webhook") or kind.endswith("formTrigger"):
            if (params.get("authentication") or "none") == "none":
                add("high", "webhook_without_auth", name,
                    "Webhook принимает запросы от кого угодно.",
                    "Включите Header Auth или проверку подписи; адрес вебхука не является секретом.")
            if params.get("responseMode") in (None, "onReceived"):
                add("info", "webhook_responds_immediately", name,
                    "Отвечает сразу, не дожидаясь результата.",
                    "Если вызывающей системе нужен результат — режим «Using Respond to Webhook node».")

        calls_out = kind.endswith(".httpRequest") or bool(node.get("credentials"))
        if calls_out and not TRIGGER.search(kind):
            if not node.get("retryOnFail"):
                add("medium", "no_retry", name,
                    "Обращается к внешней системе без повторов при сбое.",
                    "Settings → Retry On Fail: 3 попытки с паузой 2–5 секунд.")
            on_error = node.get("onError") or ("continueRegularOutput" if node.get("continueOnFail") else "stopWorkflow")
            if on_error == "continueRegularOutput":
                add("medium", "error_swallowed", name,
                    "При ошибке продолжает работу как ни в чём не бывало: сбой никто не увидит.",
                    "On Error → Continue (using error output) и ветка, которая сообщает о сбое.")
        if kind.endswith(".httpRequest"):
            options = params.get("options") or {}
            if "timeout" not in options:
                add("low", "no_timeout", name, "Не задан таймаут запроса.", "Options → Timeout, например 15000 мс.")
            url = str(params.get("url", ""))
            if url.startswith("http://") and "localhost" not in url and "127.0.0.1" not in url:
                add("medium", "plain_http", name, "Запрос по незашифрованному http.", "Используйте https.")

        if kind.endswith(".code") or kind.endswith(".function"):
            code = str(params.get("jsCode") or params.get("functionCode") or params.get("pythonCode") or "")
            for needle, why in (("process.env", "читает переменные окружения сервера"),
                                ("child_process", "запускает команды на сервере"),
                                ("eval(", "выполняет строку как код")):
                if needle in code:
                    add("medium", "risky_code", name, "Code-узел %s (`%s`)." % (why, needle),
                        "Убедитесь, что это необходимо и входные данные не приходят извне.")

        if DEFAULT_NAME.match(name):
            add("low", "default_name", name, "Имя узла по умолчанию.",
                "Назовите по действию: «Создать сделку в CRM», а не «HTTP Request1».")
        if node.get("disabled"):
            add("info", "disabled_node", name, "Узел выключен.", "Удалите или опишите в заметке, зачем он оставлен.")
        if not TRIGGER.search(kind) and name not in incoming and name not in outgoing:
            add("low", "disconnected", name, "Узел ни с чем не соединён.", "Удалите или подключите.")

    agents = [n for n in work_nodes if "langchain.agent" in (n.get("type") or "")]
    tools = [n for n in work_nodes if re.search(r"langchain\.tool|Tool$", n.get("type") or "")]
    if agents and tools:
        add("info", "agent_with_tools", agents[0].get("name", "?"),
            "AI-агент с %d инструментами. Если он читает письма, сайты или документы, в них могут быть чужие инструкции." % len(tools),
            "Оставьте агенту только нужные инструменты; действия с деньгами, удалением и отправкой наружу — через подтверждение человеком.")

    triggers = [n for n in work_nodes if TRIGGER.search(n.get("type") or "")]
    if not triggers:
        add("info", "no_trigger", "-", "В воркфлоу нет триггера.", "Нормально для подворкфлоу; иначе добавьте триггер.")
    if not settings.get("errorWorkflow") and not has_error_trigger:
        add("medium", "no_error_workflow", "-",
            "Не назначен воркфлоу для ошибок: о падении вы узнаете от клиента.",
            "Settings → Error Workflow: отдельный воркфлоу с Error Trigger, который пишет в Telegram или почту.")
    if data.get("pinData"):
        add("medium", "pinned_data", "-",
            "В экспорте остались закреплённые тестовые данные (%d узлов). В них могут быть данные клиентов." % len(data["pinData"]),
            "Открепите данные перед экспортом и передачей файла.")
    if not sticky and not any(n.get("notes") for n in work_nodes):
        add("low", "no_documentation", "-", "Нет ни одной заметки.",
            "Добавьте заметку в начале: что делает воркфлоу, кто владелец, дата.")
    if settings.get("saveDataSuccessExecution") == "all" and any("personal" in json.dumps(n, ensure_ascii=False).lower() for n in work_nodes):
        add("info", "execution_data", "-", "Сохраняются данные всех успешных запусков.",
            "Если в них персональные данные — ограничьте срок хранения.")

    findings.sort(key=lambda f: ORDER.index(f["severity"]))
    counts = {level: sum(1 for f in findings if f["severity"] == level) for level in ORDER}
    credentials = sorted({key for n in work_nodes for key in (n.get("credentials") or {})})
    print(json.dumps({
        "workflow": data.get("name", ""),
        "nodes": len(work_nodes),
        "triggers": [n.get("name") for n in triggers],
        "credential_types": credentials,
        "has_error_handling": bool(settings.get("errorWorkflow") or has_error_trigger),
        "counts": counts,
        "findings": findings,
    }, ensure_ascii=False, indent=1))
    return 1 if counts["critical"] or counts["high"] else 0


if __name__ == "__main__":
    sys.exit(main())
