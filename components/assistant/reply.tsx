"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasLocalePrefix, parseMarkdown, resolveLink, type Inline } from "@/lib/assistant/markdown";
import { path, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/** Copies text and says so for a moment. */
export function useCopy() {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = React.useCallback((text: string) => {
    void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {});
  }, []);
  return { copied, copy };
}

function Inlines({
  nodes,
  locale,
  onNavigate,
}: {
  nodes: Inline[];
  locale: Locale;
  onNavigate?: () => void;
}) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "text") return <React.Fragment key={index}>{node.text}</React.Fragment>;
        if (node.type === "strong")
          return (
            <strong key={index} className="font-semibold text-ink">
              <Inlines nodes={node.children} locale={locale} onNavigate={onNavigate} />
            </strong>
          );
        if (node.type === "code")
          return (
            <code
              key={index}
              className="rounded-[5px] border border-line bg-surface-inset px-1 py-px font-mono text-[0.86em] text-accent-ink"
            >
              {node.text}
            </code>
          );

        const target = resolveLink(node.href);
        if (!target) return <React.Fragment key={index}>{node.text}</React.Fragment>;
        const linkClass =
          "font-medium text-accent-ink underline decoration-[color-mix(in_oklab,var(--accent)_45%,transparent)] decoration-[1.5px] underline-offset-[3px] transition-colors hover:text-accent hover:decoration-accent";
        if (target.kind === "internal") {
          const href = hasLocalePrefix(target.path) ? target.path : path(target.path, locale);
          return (
            <Link key={index} href={href} onClick={onNavigate} className={linkClass}>
              {node.text}
            </Link>
          );
        }
        return (
          <a key={index} href={target.url} target="_blank" rel="noopener noreferrer nofollow" className={linkClass}>
            {node.text}
            <ArrowUpRight className="ml-0.5 inline h-3 w-3 -translate-y-px" aria-hidden />
          </a>
        );
      })}
    </>
  );
}

function CodeBlock({ code, lang, d }: { code: string; lang: string; d: Dictionary }) {
  const { copied, copy } = useCopy();
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-inset">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-2xs tracking-[0.12em] text-faint uppercase">{lang || "text"}</span>
        <button
          type="button"
          onClick={() => copy(code)}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11.5px] text-muted transition-colors hover:bg-surface-3 hover:text-ink"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? d.assistant.copied : d.assistant.copy}
        </button>
      </div>
      {/* Wrapped, not scrolled: most of what lands here is a prompt, which is prose. */}
      <pre className="px-3 py-2.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** A reply from the assistant, rendered from its Markdown. */
export function Reply({
  text,
  streaming,
  d,
  locale,
  onNavigate,
}: {
  text: string;
  streaming?: boolean;
  d: Dictionary;
  locale: Locale;
  onNavigate?: () => void;
}) {
  const blocks = React.useMemo(() => parseMarkdown(text), [text]);
  const caret = streaming ? <span className="assistant-caret" aria-hidden /> : null;

  return (
    <div className="space-y-2.5 text-[14px] leading-[1.6] text-ink-2 [overflow-wrap:anywhere]">
      {blocks.map((block, index) => {
        const last = index === blocks.length - 1;
        if (block.type === "code") return <CodeBlock key={index} code={block.code} lang={block.lang} d={d} />;
        if (block.type === "heading")
          return (
            <p key={index} className="pt-1 font-display text-[14.5px] font-bold tracking-tight text-ink">
              <Inlines nodes={block.content} locale={locale} onNavigate={onNavigate} />
              {last && caret}
            </p>
          );
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={index}
              start={block.ordered ? block.start : undefined}
              className={cn("space-y-1.5 pl-5", block.ordered ? "list-decimal marker:text-faint" : "list-disc marker:text-accent")}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="pl-0.5">
                  <Inlines nodes={item} locale={locale} onNavigate={onNavigate} />
                  {last && itemIndex === block.items.length - 1 && caret}
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <React.Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                <Inlines nodes={line} locale={locale} onNavigate={onNavigate} />
              </React.Fragment>
            ))}
            {last && caret}
          </p>
        );
      })}
      {blocks.length === 0 && caret}
    </div>
  );
}
