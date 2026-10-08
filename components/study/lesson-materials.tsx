"use client";

import * as React from "react";
import { ArrowUpRight, Check, Copy, Download, FileSpreadsheet } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * What a lesson hands the learner to take away, already in their language.
 *
 *  - `copy` — a prompt, a snippet or a template, taken with one click;
 *  - `file` — something to download, like the spreadsheet a lesson promises;
 *  - `link` — a tool or a page the lesson sends them to.
 */
export type StudyMaterial =
  | { kind: "copy"; title: string; note: string; text: string; code: boolean }
  | { kind: "file"; title: string; note: string; href: string }
  | { kind: "link"; title: string; note: string; url: string };

/** `https://docs.n8n.io/a/b/` reads better as `docs.n8n.io` next to a title. */
function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function CopyBlock({ item, d }: { item: Extract<StudyMaterial, { kind: "copy" }>; d: Dictionary }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard?.writeText(item.text).then(
      () => setCopied(true),
      () => {},
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-ink">{item.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{item.note}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
            copied
              ? "border-success/40 bg-success-soft text-success"
              : "border-line-2 bg-surface-2 text-ink-2 hover:border-accent hover:text-ink",
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {/* Announced once, so a screen reader hears that the click did something. */}
          <span aria-live="polite">{copied ? d.common.copied : d.common.copy}</span>
        </button>
      </div>
      {/*
       * Prompts wrap, because a learner reads them; code keeps its lines and
       * scrolls sideways, because indentation is part of what it says.
       */}
      <pre
        className={cn(
          "scroll-x max-h-80 overflow-y-auto border-t border-line bg-surface-inset px-5 py-4 font-mono text-[12.5px] leading-relaxed text-ink-2",
          item.code ? "whitespace-pre" : "break-words whitespace-pre-wrap",
        )}
      >
        {item.text}
      </pre>
    </div>
  );
}

export function LessonMaterials({ items, d }: { items: StudyMaterial[]; d: Dictionary }) {
  const blocks = items.filter((item) => item.kind !== "link");
  const links = items.filter((item) => item.kind === "link");

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((item) =>
        item.kind === "copy" ? (
          <CopyBlock key={item.title} item={item} d={d} />
        ) : (
          <a
            key={item.title}
            href={item.href}
            download
            className="group flex items-center gap-4 rounded-lg border border-line bg-surface p-5 transition-colors hover:border-accent"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line-2 bg-surface-2 text-accent">
              <FileSpreadsheet className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold text-ink">{item.title}</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-ink-3">{item.note}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-line-2 bg-surface-2 px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors group-hover:border-accent group-hover:text-ink">
              <Download className="h-3.5 w-3.5" aria-hidden />
              {d.common.download}
            </span>
          </a>
        ),
      )}

      {links.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-line bg-surface">
          {links.map((item) => (
            <li key={item.url} className="border-t border-line first:border-t-0">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_5%,transparent)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2.5">
                    <span className="text-[14px] font-semibold text-ink">{item.title}</span>
                    <span className="font-mono text-[11.5px] text-faint">{host(item.url)}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-3">{item.note}</span>
                </span>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-faint transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
                  aria-hidden
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
