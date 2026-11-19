"""Stand with a longer start-up wait, for a busy machine. Same as stand.Stand otherwise."""
import subprocess
import time

from stand import Stand, _req, N8N_VERSION
from nk import test_credentials
import json


class PatientStand(Stand):
    START_SECONDS = 600

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
        for _ in range(self.START_SECONDS):
            try:
                if _req("GET", self.base + "/healthz", timeout=2)[0] == 200:
                    break
            except Exception:
                pass
            time.sleep(1)
        else:
            raise RuntimeError("n8n did not start: " + (self.dir / "n8n.log").read_text()[-3000:])
        time.sleep(3)

    def post(self, path, body, headers=None):
        return _req("POST", self.base + path, body, headers, timeout=600)
