"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/primitives/button";

/**
 * Asks the API for a short-lived link to one purchased file and starts the
 * download. The link is signed per request, so it can't be put in the page.
 */
export function DownloadFileButton({
  assetId,
  label,
  errorLabel,
}: {
  assetId: string;
  label: string;
  errorLabel: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/marketplace/assets/${encodeURIComponent(assetId)}/download`);
      const body = (await response.json().catch(() => null)) as { url?: string } | null;
      if (!response.ok || !body?.url) throw new Error("no url");
      window.location.assign(body.url);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" loading={busy} onClick={download}>
        <Download className="h-3.5 w-3.5" aria-hidden />
        {label}
      </Button>
      {failed && <span className="text-[11.5px] text-danger">{errorLabel}</span>}
    </span>
  );
}
