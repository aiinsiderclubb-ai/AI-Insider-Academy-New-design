"""
Local stand for end-to-end runs: mock.js plus a throwaway n8n with the kit's
test workflows imported and published.

    with Stand("support", n8n_port=5710, mock_port=5711) as s:
        s.load([variant_json, ...])
        s.post("/webhook/...", {...})

n8n needs Node 24; it is fetched with npx (`-p node@24 -p n8n@<version>`).
Set N8N_VERSION to pin another release. Port 5679 is n8n's task broker
default, so each stand sets its own broker port.
"""
import json
import os
import shutil
import signal
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

from nk import test_credentials

HERE = Path(__file__).resolve().parent
N8N_VERSION = os.environ.get("N8N_VERSION", "2.48.6")


def _req(method, url, body=None, headers=None, timeout=60):
    data = None if body is None else json.dumps(body).encode()
    h = {"content-type": "application/json", "connection": "close"}
    h.update(headers or {})
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw.strip().startswith(("{", "[")) else raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


class Stand:
    def __init__(self, name, n8n_port, mock_port):
        self.name = name
        self.port = n8n_port
        self.mock_port = mock_port
        self.mock = f"http://127.0.0.1:{mock_port}"
        self.base = f"http://127.0.0.1:{n8n_port}"
        self.dir = Path(tempfile.mkdtemp(prefix=f"stand-{name}-"))
        self.procs = []

    def env(self):
        e = dict(os.environ)
        e.update({
            "N8N_USER_FOLDER": str(self.dir),
            "N8N_PORT": str(self.port),
            "N8N_RUNNERS_BROKER_PORT": str(self.port + 50),
            "N8N_DIAGNOSTICS_ENABLED": "false",
            "N8N_PERSONALIZATION_ENABLED": "false",
            "N8N_SECURE_COOKIE": "false",
            "N8N_LOG_LEVEL": "warn",
            "WEBHOOK_URL": self.base + "/",
            "N8N_RESTRICT_FILE_ACCESS_TO": str(self.dir),
        })
        return e

    def n8n(self, *args):
        cmd = ["npx", "--yes", "-p", "node@24", "-p", f"n8n@{N8N_VERSION}", "n8n", *args]
        out = subprocess.run(cmd, env=self.env(), capture_output=True, text=True, timeout=600)
        if out.returncode != 0:
            raise RuntimeError(f"n8n {' '.join(args)} failed:\n{out.stdout[-2000:]}\n{out.stderr[-2000:]}")
        return out.stdout

    def __enter__(self):
        log = open(self.dir / "mock.log", "w")
        self.procs.append(subprocess.Popen(["node", str(HERE / "mock.cjs"), str(self.mock_port)], stdout=log, stderr=log))
        return self

    def load(self, workflows, publish=None):
        creds = self.dir / "creds.json"
        creds.write_text(json.dumps(test_credentials(self.mock)))
        self.n8n("import:credentials", f"--input={creds}")
        for wf in workflows:
            f = self.dir / f"{wf['id']}.json"
            f.write_text(json.dumps(wf, ensure_ascii=False))
            self.n8n("import:workflow", f"--input={f}")
        for wf in workflows:
            if publish is None or wf["id"] in publish:
                self.n8n("publish:workflow", f"--id={wf['id']}")
        log = open(self.dir / "n8n.log", "w")
        self.procs.append(subprocess.Popen(
            ["npx", "--yes", "-p", "node@24", "-p", f"n8n@{N8N_VERSION}", "n8n", "start"],
            env=self.env(), stdout=log, stderr=log, start_new_session=True))
        for _ in range(120):
            try:
                if _req("GET", self.base + "/healthz", timeout=2)[0] == 200:
                    break
            except Exception:
                pass
            time.sleep(1)
        else:
            raise RuntimeError("n8n did not start: " + (self.dir / "n8n.log").read_text()[-3000:])
        time.sleep(3)  # webhooks register just after healthz turns green

    # ---- mock control ----
    def reset(self):
        _req("POST", self.mock + "/__reset", {})

    def script(self, *items):
        _req("POST", self.mock + "/__script", list(items))

    def fail(self, contains):
        _req("POST", self.mock + "/__fail", {"contains": contains})

    def sheet(self, tab, rows):
        _req("POST", self.mock + "/__sheet", {"tab": tab, "rows": rows})

    def read_sheet(self, tab):
        return _req("GET", self.mock + f"/__sheet?tab={urllib.request.quote(tab)}")[1]

    def calls(self, contains=""):
        return [c for c in _req("GET", self.mock + "/__log")[1] if contains in c["path"]]

    # ---- n8n ----
    def wait_webhook(self, path, seconds=90):
        """Waits until n8n has registered a production webhook (any answer but 404); the probe is an empty POST."""
        for _ in range(seconds):
            code, res = _req("POST", self.base + path, {})
            if code != 404:
                return
            time.sleep(1)
        raise RuntimeError(f"webhook {path} never registered")

    def post(self, path, body, headers=None):
        return _req("POST", self.base + path, body, headers)

    def executions(self):
        import sqlite3
        db = sqlite3.connect(self.dir / ".n8n" / "database.sqlite")
        return db.execute("select id, status, workflowId from execution_entity order by id").fetchall()

    def last_error(self):
        import sqlite3
        db = sqlite3.connect(self.dir / ".n8n" / "database.sqlite")
        row = db.execute("select data from execution_data order by executionId desc limit 1").fetchone()
        if not row:
            return None
        text = row[0]
        i = text.find('"message"')
        return text[i:i + 600] if i >= 0 else text[:600]

    def __exit__(self, *exc):
        for p in self.procs:
            try:
                if p.args[0] == "npx":
                    os.killpg(p.pid, signal.SIGTERM)
                else:
                    p.terminate()
            except Exception:
                pass
        for p in self.procs:
            try:
                p.wait(timeout=20)
            except Exception:
                p.kill()
        if not os.environ.get("KEEP_STAND"):
            shutil.rmtree(self.dir, ignore_errors=True)
        else:
            print("stand kept at", self.dir)
