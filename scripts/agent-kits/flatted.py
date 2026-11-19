"""Decodes n8n's execution_data (flatted format) and summarises an execution."""
import json


def unflatten(text):
    arr = json.loads(text)
    seen = {}

    def rev(v, depth=0):
        if isinstance(v, str) and v.isdigit() and int(v) < len(arr):
            i = int(v)
            if i in seen:
                return seen[i]
            raw = arr[i]
            if isinstance(raw, dict):
                out = {}
                seen[i] = out
                for k, x in raw.items():
                    out[k] = rev(x)
                return out
            if isinstance(raw, list):
                out = []
                seen[i] = out
                out.extend(rev(x) for x in raw)
                return out
            return raw
        return v

    return rev("0")


def summary(text):
    d = unflatten(text)
    rd = d.get("resultData", {})
    err = rd.get("error") or {}
    runs = rd.get("runData", {})
    node_errors = {n: r[0].get("error", {}).get("message") for n, r in runs.items() if r and r[0].get("error")}
    return {"last": rd.get("lastNodeExecuted"), "error": err.get("message"), "description": err.get("description"),
            "node_errors": node_errors, "ran": list(runs)}
