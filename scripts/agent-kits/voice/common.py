"""
Shared pieces for the voice kits built here (restaurant, delivery).

The four older voice kits share one booking backend; these two derive from it
(restaurant) or replace it (delivery). Provider files — Vapi tools, Retell LLM
tools, the ElevenLabs fill-in sheet — are generated from one tools.schema.json
so they cannot drift apart.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PRODUCTS = ROOT / "content" / "products"
SALON = PRODUCTS / "voice-agent-kit-beauty-salon"


def load(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def dump(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


def rep(text, old, new, count=1):
    """Replace exactly `count` occurrences (count=None: at least one) — a patch that no longer applies fails loudly."""
    found = text.count(old)
    if (count is None and found == 0) or (count is not None and found != count):
        raise AssertionError(f"expected {count} × {old[:80]!r}, found {found}")
    return text.replace(old, new)


def node(wf, name):
    for n in wf["nodes"]:
        if n["name"] == name:
            return n
    raise KeyError(name)


def config_code(cfg, comment):
    return f"{comment}\nreturn [{{ json: {json.dumps(cfg, ensure_ascii=False, indent=2)} }}];\n"


VOICE_URL = "https://REPLACE-N8N-HOST/webhook/voice-tools"


def write_providers(kit_dir, schema, retell_base, eleven_intro, eleven_tail):
    """vapi-tools.json, retell-llm.json (general_tools) and elevenlabs-tools.md from the schema."""
    kit_dir = Path(kit_dir)
    dump(kit_dir / "providers" / "vapi-tools.json", [
        {"type": "function", "function": t, "server": {"url": VOICE_URL, "credentialId": "REPLACE_WITH_VAPI_CREDENTIAL_ID"}}
        for t in schema])
    retell = dict(retell_base)
    builtin = [g for g in retell["general_tools"] if g["type"] != "custom"]
    retell["general_tools"] = builtin + [
        {"type": "custom", "name": t["name"], "description": t["description"], "url": VOICE_URL, "method": "POST",
         "headers": {"X-Voice-Secret": "REPLACE_WITH_SECRET"}, "parameters": t["parameters"],
         "speak_during_execution": True, "speak_after_execution": True, "timeout_ms": 15000}
        for t in schema]
    dump(kit_dir / "providers" / "retell-llm.json", retell)

    parts = [eleven_intro.rstrip() + "\n"]
    for t in schema:
        props = t["parameters"]["properties"]
        req = set(t["parameters"].get("required", []))
        rows = []
        for name, p in props.items():
            kind = p["type"] + (f" ({', '.join(p['enum'])})" if "enum" in p else "")
            rows.append(f"| `{name}` | {kind} | {'да' if name in req else 'нет'} | {p.get('description', '')} |")
        parts.append(
            f"## {t['name']}\n\n- **Name:** `{t['name']}`\n- **Description:** {t['description']}\n"
            f"- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool={t['name']}`\n\n"
            "| Свойство тела | Тип | Обязательное | Описание |\n|---|---|---|---|\n" + "\n".join(rows) + "\n")
    parts.append(eleven_tail.strip() + "\n")
    (kit_dir / "providers" / "elevenlabs-tools.md").write_text("\n".join(parts), encoding="utf8")


HTML_TEXT = "={{ String(%s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}"


def plain_telegram(wf):
    """Telegram nodes send HTML with the text escaped: a name or address with * or _ must not break the message."""
    for n in wf["nodes"]:
        if n["type"] == "n8n-nodes-base.telegram":
            text = n["parameters"]["text"]
            assert text.startswith("={{ ") and text.endswith(" }}"), text
            n["parameters"]["text"] = HTML_TEXT % text[4:-3]
            n["parameters"].setdefault("additionalFields", {})["parse_mode"] = "HTML"
    return wf
