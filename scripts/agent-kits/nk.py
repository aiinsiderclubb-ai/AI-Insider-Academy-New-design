"""
Builder for the agent kits' n8n workflows.

A kit's build.py describes its workflow with Flow, its tools with Tool, and
calls write_kit(). The shipped workflow carries placeholder credentials
(id REPLACE_ME); test_variant() rewrites it for the local stand: Google and
Telegram hosts point at mock.js, credentials point at the stand's test ones.

Not shipped to buyers — kept in the repo so the kits can be rebuilt.
"""
import json
import re
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRODUCTS = ROOT / "content" / "products"

SHEETS = "https://sheets.googleapis.com/v4/spreadsheets"
CALENDAR = "https://www.googleapis.com/calendar/v3"

CRED_NAMES = {
    "googleSheetsOAuth2Api": "Google Sheets account",
    "googleCalendarOAuth2Api": "Google Calendar account",
    "telegramApi": "Telegram account",
    "openAiApi": "OpenAI account",
    "anthropicApi": "Anthropic account",
    "httpHeaderAuth": "Header Auth account",
}

TEST_CREDS = {
    "googleSheetsOAuth2Api": "t-none",
    "googleCalendarOAuth2Api": "t-none",
    "telegramApi": "t-tg",
    "openAiApi": "t-oa",
    "anthropicApi": "t-an",
    "httpHeaderAuth": "t-hh",
}


def js(path):
    return Path(path).read_text(encoding="utf8").strip() + "\n"


def stable_id(*parts):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "insider-agent-kits/" + "/".join(parts)))


class Flow:
    def __init__(self, name, slug):
        self.name = name
        self.slug = slug
        self.nodes = []
        self.conns = {}

    # ---- generic ----
    def node(self, name, type_, version, pos, params=None, creds=None, **extra):
        n = {
            "id": stable_id(self.slug, self.name, name),
            "name": name,
            "type": type_,
            "typeVersion": version,
            "position": list(pos),
            "parameters": params or {},
        }
        if creds:
            n["credentials"] = {c: {"id": "REPLACE_ME", "name": CRED_NAMES[c]} for c in creds}
        n.update(extra)
        self.nodes.append(n)
        return name

    def connect(self, src, dst, out=0, kind="main", inp=0):
        lst = self.conns.setdefault(src, {}).setdefault(kind, [])
        while len(lst) <= out:
            lst.append([])
        lst[out].append({"node": dst, "type": kind, "index": inp})

    def chain(self, *names):
        for a, b in zip(names, names[1:]):
            self.connect(a, b)

    # ---- typed helpers ----
    def code(self, name, pos, code, each=False, **extra):
        params = {"jsCode": code}
        if each:
            params["mode"] = "runOnceForEachItem"
        return self.node(name, "n8n-nodes-base.code", 2, pos, params, **extra)

    def sticky(self, name, pos, content, w=420, h=300, color=None):
        p = {"content": content, "width": w, "height": h}
        if color:
            p["color"] = color
        return self.node(name, "n8n-nodes-base.stickyNote", 1, pos, p)

    def if_(self, name, pos, left, op="true", right=None, type_="boolean"):
        cond = {"id": stable_id(self.slug, name, "c"), "leftValue": left, "operator": {"type": type_, "operation": op}}
        if op in ("true", "false", "exists", "notExists", "empty", "notEmpty"):
            cond["operator"]["singleValue"] = True
        else:
            cond["rightValue"] = right
        return self.node(name, "n8n-nodes-base.if", 2.2, pos, {
            "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                           "conditions": [cond], "combinator": "and"},
            "looseTypeValidation": True, "options": {}})

    def switch(self, name, pos, value, cases, fallback=True):
        """Routes on an expression equal to one of `cases`; outputs follow the order of `cases`."""
        rules = []
        for c in cases:
            rules.append({"conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                "conditions": [{"id": stable_id(self.slug, name, c), "leftValue": value, "rightValue": c,
                                "operator": {"type": "string", "operation": "equals"}}],
                "combinator": "and"}, "renameOutput": True, "outputKey": c})
        opts = {"fallbackOutput": "extra", "renameFallbackOutput": "other"} if fallback else {}
        return self.node(name, "n8n-nodes-base.switch", 3.2, pos, {"rules": {"values": rules}, "options": opts})

    def http(self, name, pos, method, url, body=None, cred=None, query=None, headers=None, on_error=None, full=False):
        p = {"method": method, "url": url, "options": {}}
        if cred:
            p["authentication"] = "predefinedCredentialType"
            p["nodeCredentialType"] = cred
        if query:
            p["sendQuery"] = True
            p["queryParameters"] = {"parameters": [{"name": k, "value": v} for k, v in query]}
        if headers:
            p["sendHeaders"] = True
            p["headerParameters"] = {"parameters": [{"name": k, "value": v} for k, v in headers]}
        if body is not None:
            p["sendBody"] = True
            p["specifyBody"] = "json"
            p["jsonBody"] = body
        if full:
            p["options"] = {"response": {"response": {"fullResponse": True, "neverError": True}}}
        extra = {}
        if on_error:
            extra["onError"] = on_error
        return self.node(name, "n8n-nodes-base.httpRequest", 4.2, pos, p, creds=[cred] if cred else None, **extra)

    def telegram(self, name, pos, chat_id, text, on_error="continueRegularOutput", reply_markup=None):
        p = {"chatId": chat_id, "text": text, "additionalFields": {"appendAttribution": False, "parse_mode": "HTML", "disable_web_page_preview": True}}
        return self.node(name, "n8n-nodes-base.telegram", 1.2, pos, p, creds=["telegramApi"], onError=on_error)

    def render(self, extra_settings=None):
        settings = {"executionOrder": "v1", "saveManualExecutions": True, "callerPolicy": "workflowsFromSameOwner"}
        if extra_settings:
            settings.update(extra_settings)
        return {"name": self.name, "nodes": self.nodes, "connections": self.conns, "settings": settings,
                "pinData": {}, "meta": {"templateCredsSetupCompleted": False}}


class Tool:
    """One agent tool: the same definition feeds the n8n Workflow Tool node and the OpenAI / Anthropic schemas."""

    def __init__(self, name, description, params, required=None):
        self.name = name
        self.description = description
        self.params = params  # [(name, type, description)]
        self.required = required if required is not None else [p[0] for p in params]

    def json_schema(self):
        props = {}
        for n, t, d in self.params:
            props[n] = {"type": t, "description": d}
        return {"type": "object", "properties": props, "required": self.required, "additionalProperties": False}

    def openai(self):
        return {"type": "function", "function": {"name": self.name, "description": self.description, "parameters": self.json_schema()}}

    def anthropic(self):
        return {"name": self.name, "description": self.description, "input_schema": self.json_schema()}


def tool_node(flow, tool, pos, all_inputs):
    """A Workflow Tool that calls this same workflow; the tool name travels in the `tool` input."""
    value = {"tool": tool.name}
    for n, t, d in tool.params:
        kind = {"string": "string", "number": "number", "integer": "number", "boolean": "boolean"}[t]
        value[n] = "={{ $fromAI('%s', %s, '%s') }}" % (n, json.dumps(d, ensure_ascii=False).replace("'", "\\'"), kind)
    for n in all_inputs:
        value.setdefault(n, "")
    schema = [{"id": n, "displayName": n, "required": False, "defaultMatch": False, "display": True,
               "canBeUsedToMatch": True, "type": "string", "removed": False} for n in all_inputs]
    return flow.node(tool.name, "@n8n/n8n-nodes-langchain.toolWorkflow", 2.2, pos, {
        "description": tool.description,
        "workflowId": {"__rl": True, "mode": "id", "value": "={{ $workflow.id }}"},
        "workflowInputs": {"mappingMode": "defineBelow", "value": value, "matchingColumns": [], "schema": schema,
                           "attemptToConvertTypes": False, "convertFieldsToString": True},
    })


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


# ---------- test variant ----------

def test_variant(wf, mock, wf_id):
    """Points every outside call at the mock and swaps credentials for the stand's test ones."""
    t = json.loads(json.dumps(wf))
    t["id"] = wf_id
    t["active"] = False
    for n in t["nodes"]:
        for c in list(n.get("credentials", {})):
            n["credentials"][c] = {"id": TEST_CREDS[c], "name": c}
        p = n["parameters"]
        if n["type"] == "n8n-nodes-base.httpRequest":
            p["url"] = p["url"].replace(SHEETS, f"{mock}/sheets/v4/spreadsheets").replace(CALENDAR, f"{mock}/calendar/v3")
            if p.get("authentication") == "predefinedCredentialType" and p.get("nodeCredentialType", "").startswith("google"):
                p["authentication"] = "none"
                p.pop("nodeCredentialType", None)
                n.pop("credentials", None)
        if n["type"] == "n8n-nodes-base.telegramTrigger":
            # Telegram cannot reach a local stand; a webhook receives the same update instead.
            n["type"] = "n8n-nodes-base.webhook"
            n["typeVersion"] = 2.1
            n["parameters"] = {"httpMethod": "POST", "path": f"{wf_id}-telegram", "responseMode": "responseNode", "options": {}}
            n["webhookId"] = stable_id(wf_id, "tg")
            n.pop("credentials", None)
        if n["type"] == "n8n-nodes-base.webhook" and "webhookId" in n:
            n["webhookId"] = stable_id(wf_id, n["name"])
    # A webhook wraps the update in `body`; the real trigger hands over the update itself.
    for n in [n for n in t["nodes"] if n["parameters"].get("path", "").endswith("-telegram")]:
        unwrap = n["name"] + " Body"
        t["nodes"].append({"id": stable_id(wf_id, unwrap), "name": unwrap, "type": "n8n-nodes-base.code", "typeVersion": 2,
                           "position": [n["position"][0], n["position"][1] + 90],
                           "parameters": {"jsCode": "return [{ json: $input.first().json.body }];"}})
        t["connections"][unwrap] = t["connections"].pop(n["name"], {})
        t["connections"][n["name"]] = {"main": [[{"node": unwrap, "type": "main", "index": 0}]]}
    return t


def test_credentials(mock):
    return [
        {"id": "t-tg", "name": "tg", "type": "telegramApi", "data": {"accessToken": "123:abc", "baseUrl": mock}},
        {"id": "t-oa", "name": "oa", "type": "openAiApi", "data": {"apiKey": "sk-test", "url": f"{mock}/v1"}},
        {"id": "t-an", "name": "an", "type": "anthropicApi", "data": {"apiKey": "sk-ant-test", "url": mock}},
        {"id": "t-hh", "name": "hh", "type": "httpHeaderAuth", "data": {"name": "x-test", "value": "1"}},
    ]


def placeholders_only(wf):
    for n in wf["nodes"]:
        for c in n.get("credentials", {}).values():
            assert c["id"] == "REPLACE_ME", n["name"]


def no_secrets(text):
    assert not re.search(r"sk-[A-Za-z0-9]{20,}|xox[bp]-\d", text), "secret-looking string in output"
