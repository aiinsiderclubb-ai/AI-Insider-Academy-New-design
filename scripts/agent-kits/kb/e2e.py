"""End-to-end run of the Knowledge Base Agent in a local n8n against mock.cjs and mock_web.cjs.

    python3 scripts/agent-kits/kb/e2e.py
"""
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import build  # noqa: E402  (patches nk's credential tables)
from nk import test_variant  # noqa: E402
from stand import Stand, _req  # noqa: E402

N8N, MOCK, WEB = 5740, 5741, 5743
WEB_URL = f"http://127.0.0.1:{WEB}"
TOKEN, DEBUG = "tok-kb-123456", "dbg-kb"
H = {"x-agent-token": TOKEN, "x-agent-debug": DEBUG}

FILES = [
    {"id": "g1", "name": "Регламент отпусков", "mimeType": "application/vnd.google-apps.document", "modifiedTime": "2026-10-01T10:00:00Z",
     "content": "Регламент отпусков.\n\nОтпуск оформляется заявлением в HR-портале не позднее чем за 14 дней до начала. "
                "Перенос отпуска согласует непосредственный руководитель. Отпуск можно делить на части, одна часть не короче 14 дней."},
    {"id": "p1", "name": "Travel policy.pdf", "mimeType": "application/pdf", "modifiedTime": "2026-09-15T10:00:00Z",
     "lines": ["Travel policy", "Business travel must be approved by the department head in advance.",
               "Daily allowance abroad is 40 EUR per day. Hotel limit is 120 EUR per night."]},
    {"id": "t1", "name": "Онбординг.md", "mimeType": "text/markdown", "modifiedTime": "2026-11-01T10:00:00Z",
     "content": "# Онбординг\n\nНовому сотруднику выдают ноутбук в первый рабочий день. Доступ к почте и чатам открывает служба поддержки IT."},
    {"id": "i1", "name": "logo.png", "mimeType": "image/png", "modifiedTime": "2026-11-01T10:00:00Z", "content": ""},
]
PAGES = {"security": "<html><head><title>Правила безопасности</title><script>var evilScript = 1;</script></head>"
                     "<body><nav>Меню</nav><h1>Пароли</h1><p>Пароль должен быть не короче 12 символов и меняться раз в 90 дней.</p>"
                     "<p>Двухфакторная аутентификация обязательна для почты.</p></body></html>"}


def variant(wf, wf_id, path, anthropic=False):
    t = test_variant(wf, f"http://127.0.0.1:{MOCK}", wf_id)
    for n in t["nodes"]:
        p = n["parameters"]
        if n["type"] == "n8n-nodes-base.httpRequest":
            p["url"] = p["url"].replace(build.DRIVE, f"{WEB_URL}/drive/v3")
        if n["name"] == "Config":
            c = p["jsCode"]
            c = c.replace("'ЗАМЕНИТЕ_НА_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ'", repr(TOKEN)).replace("debug_token: ''", f"debug_token: '{DEBUG}'")
            c = c.replace("'ВСТАВЬТЕ_ID_ТАБЛИЦЫ'", "'SHEET1'").replace("'ВСТАВЬТЕ_ID_ЧАТА'", "'-100777'").replace("'ВСТАВЬТЕ_ID_ПАПКИ'", "'FOLDER1'")
            c = c.replace("allowed_telegram_ids: []", "allowed_telegram_ids: [555]").replace("index_key: 'kb_main'", f"index_key: 'kb_{wf_id}'")
            p["jsCode"] = c
        if n["name"] == "Webhook":
            p["path"] = path
        if n["name"] == "Reindex Webhook":
            p["path"] = path + "-reindex"
        if n["name"] == "Embeddings":
            n["credentials"] = {"openAiApi": {"id": "t-emb", "name": "emb"}}
    if anthropic:
        t["connections"].pop("OpenAI Chat Model")
        t["connections"]["Anthropic Chat Model"] = {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]}
    return t


def web(path, body=None):
    return _req("POST", WEB_URL + path, body if body is not None else {})


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  → {str(detail)[:900]}"))
    if not cond:
        check.failed += 1


check.failed = 0


def wait_for(s, contains, before, seconds=60):
    for _ in range(seconds):
        msgs = [c for c in s.calls("/sendMessage")[before:] if contains in json.dumps(c["body"], ensure_ascii=False)]
        if msgs:
            return msgs
        time.sleep(1)
    return []


def ask(s, path, session, message, **extra):
    from stand import _req
    return _req("POST", s.base + f"/webhook/{path}", {"session_id": session, "message": message, **extra}, H, timeout=240)


def main():
    wf = build.build()
    oa = variant(wf, "kbOA", "kb-agent")
    an = variant(wf, "kbAN", "kb-agent-claude", anthropic=True)
    webproc = subprocess.Popen(["node", str(HERE / "mock_web.cjs"), str(WEB)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        with Stand("kb", N8N, MOCK) as s:
            extra = s.dir / "emb.json"
            extra.write_text(json.dumps([{"id": "t-emb", "name": "emb", "type": "openAiApi", "data": {"apiKey": "sk-test", "url": f"{WEB_URL}/v1"}}]))
            s.n8n("import:credentials", f"--input={extra}")
            s.load([oa, an])
            for p in ("/webhook/kb-agent", "/webhook/kb-agent-claude", "/webhook/kb-agent-reindex", "/webhook/kb-agent-claude-reindex", "/webhook/kbOA-telegram"):
                s.wait_webhook(p)
            for path, label in (("kb-agent", "openai"), ("kb-agent-claude", "anthropic")):
                s.reset()
                web("/__reset")
                web("/__files", FILES)
                web("/__pages", PAGES)
                s.sheet("Sources", [["url", "title", "enabled"], [f"{WEB_URL}/page/security", "", "да"],
                                    [f"{WEB_URL}/page/old", "Старая страница", "нет"]])
                s.sheet("Documents", [["code"]] + [["old"]] * 9)

                code, r = s.post(f"/webhook/{path}-reindex", {}, {"x-agent-token": "wrong"})
                check(f"{label}: reindex without token → 401", code == 401, (code, r))
                code, r = s.post(f"/webhook/{path}-reindex", {}, {"x-agent-token": TOKEN})
                check(f"{label}: reindex accepted → 202", code == 202 and r.get("status") == "started", (code, r))
                rep = wait_for(s, "Индекс обновлён", 0)
                check(f"{label}: reindex report reaches the team", rep and "Документов: 4" in rep[0]["body"]["text"]
                      and "logo" in rep[0]["body"]["text"], rep or s.last_error())
                docs = s.read_sheet("Documents")
                titles = [r[1] for r in docs[1:] if r and r[0]]
                check(f"{label}: registry lists the four documents with codes",
                      sorted(titles) == sorted(["Регламент отпусков", "Travel policy", "Онбординг", "Правила безопасности"])
                      and all(int(r[5]) >= 1 for r in docs[1:5]), docs)
                check(f"{label}: old registry rows are blanked", len(docs) == 10 and all(not any(r) for r in docs[6:]), docs)
                code_of = {r[1]: r[0] for r in docs[1:] if r and r[0]}

                s.script(
                    {"match": "как оформить отпуск", "steps": [
                        {"tool": "search_documents", "args": {"query": "отпуск оформляется заявлением"}},
                        {"final": "Через HR-портал за 14 дней {{result.passages.0.cite}}."}]},
                    {"match": "выдуманная ссылка", "steps": [
                        {"tool": "search_documents", "args": {"query": "отпуск перенос"}},
                        {"final": "Перенос согласует руководитель [d99] {{result.passages.0.cite}}."}]},
                    {"match": "зарплату криптовалютой", "steps": [
                        {"tool": "search_documents", "args": {"query": "зарплата криптовалюта биткоин"}},
                        {"final": "В документах этого нет. found={{result.found}}"}]},
                    {"match": "daily allowance", "steps": [
                        {"tool": "search_documents", "args": {"query": "daily allowance abroad travel"}},
                        {"final": "40 EUR per day {{result.passages.0.cite}}"}]},
                    {"match": "длина пароля", "steps": [
                        {"tool": "search_documents", "args": {"query": "пароль должен быть символов"}},
                        {"final": "{{result.passages.0.text}} {{result.passages.0.cite}}"}]},
                    {"match": "какие документы есть", "steps": [
                        {"tool": "list_documents", "args": {}},
                        {"final": "В базе {{result.count}} документа."}]},
                    {"match": "соедините с hr", "steps": [
                        {"tool": "handoff_to_human", "args": {"reason": "Нужен HR", "summary": "Вопрос о переносе отпуска", "urgency": "normal"}},
                        {"final": "Передал вопрос."}]},
                    {"match": "ноутбук в первый день", "steps": [
                        {"tool": "search_documents", "args": {"query": "ноутбук выдают первый рабочий день"}},
                        {"final": "found={{result.found}} {{result.passages.0.cite}}"}]},
                )

                code, r = ask(s, path, "kb-vacation", "Как оформить отпуск?")
                src = r.get("sources", [])
                check(f"{label}: answer cites the document and lists it", code == 200 and "[1]" in r.get("reply", "")
                      and "Источники:" in r.get("reply", "") and src and src[0]["title"] == "Регламент отпусков"
                      and "drive.google.com/file/d/g1" in src[0]["url"], r)
                code, r = ask(s, path, "kb-fake", "Выдуманная ссылка?")
                check(f"{label}: unknown citation removed", "d99" not in r.get("reply", "") and "bad_citation" in r.get("flags", [])
                      and r.get("sources"), r)
                code, r = ask(s, path, "kb-gap", "Можно получать зарплату криптовалютой?")
                gaps = s.read_sheet("Gaps")
                check(f"{label}: not in the documents → found=false, gap recorded", "found=false" in r.get("reply", "")
                      and "not_found" in r.get("flags", []) and gaps and "криптовалют" in gaps[-1][1], (r, gaps))
                code, r = ask(s, path, "kb-pdf", "What is the daily allowance abroad?")
                check(f"{label}: text from the PDF is searchable", r.get("sources") and r["sources"][0]["title"] == "Travel policy", r)
                code, r = ask(s, path, "kb-page", "Какая длина пароля?")
                check(f"{label}: web page indexed without scripts and menus", "12 символов" in r.get("reply", "")
                      and "evilScript" not in r.get("reply", "") and r.get("sources", [{}])[0].get("title") == "Правила безопасности", r)
                code, r = ask(s, path, "kb-list", "Какие документы есть в базе?")
                check(f"{label}: list_documents counts indexed documents", "4 документа" in r.get("reply", ""), r)
                before = len(s.calls("/sendMessage"))
                code, r = ask(s, path, "kb-hr-handoff", "Соедините с HR, пожалуйста")
                tg = s.calls("/sendMessage")[before:]
                check(f"{label}: handoff reaches the team", r.get("handoff") is True and len(tg) == 1, (r, tg))

                # the folder cannot be read: report says stopped, the old index stays
                web("/__fail", {"contains": "/drive/v3/files"})
                before = len(s.calls("/sendMessage"))
                s.post(f"/webhook/{path}-reindex", {}, {"x-agent-token": TOKEN})
                rep = wait_for(s, "остановлена", before)
                check(f"{label}: failed listing keeps the old index", bool(rep), s.last_error())
                web("/__fail", {})
                code, r = ask(s, path, "kb-vacation-2", "Как оформить отпуск? ещё раз")
                check(f"{label}: search still works after the failed reindex", r.get("sources") and r["sources"][0]["title"] == "Регламент отпусков", r)

                # a document removed from the folder disappears after the next reindex
                web("/__reset")
                web("/__files", [f for f in FILES if f["id"] != "t1"])
                web("/__pages", PAGES)
                before = len(s.calls("/sendMessage"))
                code, r = ask(s, path, "kb-laptop-1", "Когда выдают ноутбук в первый день?")
                check(f"{label}: onboarding found before removal", "found=true" in r.get("reply", ""), r)
                s.post(f"/webhook/{path}-reindex", {}, {"x-agent-token": TOKEN})
                rep = wait_for(s, "Индекс обновлён", before)
                code, r = ask(s, path, "kb-laptop-2", "Когда выдают ноутбук в первый день?")
                check(f"{label}: removed document is gone from the index", rep and "Документов: 3" in rep[0]["body"]["text"]
                      and "found=false" in r.get("reply", ""), (rep, r))

                code, r = s.post(f"/webhook/{path}", {"session_id": "kb-x1", "message": "hi"}, {"x-agent-token": "nope"})
                check(f"{label}: wrong token → 401", code == 401, (code, r))

            # Telegram: allow-list
            before = len(s.calls("/sendMessage"))
            s.script({"match": "привет из телеграма", "steps": [
                {"tool": "search_documents", "args": {"query": "отпуск заявление"}}, {"final": "Ответ {{result.passages.0.cite}} <b>"}]})

            def tg(uid, text):
                return s.post("/webhook/kbOA-telegram", {"update_id": 1, "message": {"message_id": 5, "date": int(time.time()), "chat": {"id": uid, "type": "private"},
                                                                                     "from": {"id": uid, "is_bot": False, "first_name": "U"}, "text": text}})
            tg(555, "Привет из телеграма, про отпуск")
            tg(777, "дай доступ")
            tg(777, "ну дай")
            time.sleep(3)
            sent = s.calls("/sendMessage")[before:]
            to555 = [c for c in sent if str(c["body"]["chat_id"]) == "555"]
            to777 = [c for c in sent if str(c["body"]["chat_id"]) == "777"]
            team = [c for c in sent if str(c["body"]["chat_id"]) == "-100777"]
            check("telegram: allowed user gets an HTML-escaped answer with source links",
                  len(to555) == 1 and "&lt;b&gt;" in to555[0]["body"]["text"] and "<a href=" in to555[0]["body"]["text"], to555)
            check("telegram: stranger is refused with their ID, team alerted once",
                  len(to777) == 2 and "777" in to777[0]["body"]["text"] and len(team) == 1, (to777, team))

            errors = [e for e in s.executions() if e[1] not in ("success",)]
            check("no failed executions", not errors, errors and s.last_error())
    finally:
        webproc.terminate()
    print("\nfailed:", check.failed)
    sys.exit(1 if check.failed else 0)


if __name__ == "__main__":
    main()
