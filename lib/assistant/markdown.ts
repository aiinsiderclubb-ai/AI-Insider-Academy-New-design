/*
 * The small slice of Markdown the assistant writes, parsed into a tree the
 * chat renders as React elements. Nothing here ever becomes HTML: a reply is
 * model output, and model output steered by whoever is typing, so it is
 * treated as text with a few known shapes rather than as markup.
 *
 * Parsing is forgiving by design — a reply is re-parsed on every streamed
 * piece, so an unclosed ``` fence or a half-written **bold** has to render as
 * something sensible mid-sentence.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "paragraph"; lines: Inline[][] }
  | { type: "heading"; content: Inline[] }
  | { type: "list"; ordered: boolean; start: number; items: Inline[][] }
  | { type: "code"; lang: string; code: string };

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(\[[^\]\n]+\]\([^)\s]+\))/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ type: "text", text: text.slice(last, at) });
    const [token] = match;
    if (match[1]) out.push({ type: "code", text: token.slice(1, -1) });
    // Bold often wraps a link — **[Course](/learn/x)** — so its inside is
    // parsed too. It holds no `**` of its own, so this recurses once at most.
    else if (match[2]) out.push({ type: "strong", children: parseInline(token.slice(2, -2)) });
    else {
      const split = token.indexOf("](");
      out.push({ type: "link", text: token.slice(1, split), href: token.slice(split + 2, -1) });
    }
    last = at + token.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^#{1,4}\s+(.*)$/;
const FENCE = /^\s*```\s*([\w+-]*)\s*$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: Inline[][] = [];
  let list: Extract<Block, { type: "list" }> | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph });
    if (list) blocks.push(list);
    paragraph = [];
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) code.push(lines[i++]);
      blocks.push({ type: "code", lang: fence[1] ?? "", code: code.join("\n") });
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: "heading", content: parseInline(heading[1].replace(/\*\*/g, "")) });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { type: "list", ordered, start: numbered ? Number(numbered[1]) : 1, items: [] };
      }
      list.items.push(parseInline(bullet ? bullet[1] : numbered![2]));
      continue;
    }

    // A line under a list item that is not itself an item continues it.
    if (list && /^\s{2,}\S/.test(line)) {
      const items: Inline[][] = list.items;
      items[items.length - 1] = [...items[items.length - 1], { type: "text", text: " " }, ...parseInline(line.trim())];
      continue;
    }

    if (list) flush();
    paragraph.push(parseInline(line));
  }

  flush();
  return blocks;
}

/* ---------------------------------- links ---------------------------------- */

/** Hosts a reply may link out to. Anything else is shown as plain text. */
const EXTERNAL_HOSTS = ["t.me", "myinsideracademy.com", "insiderai.it.com", "syntx.ai"];

export type ResolvedLink = { kind: "internal"; path: string } | { kind: "external"; url: string } | null;

/**
 * Where a link in a reply may go. Paths on this site stay in the app; a few
 * known hosts open in a new tab; everything else — javascript:, data:, a
 * look-alike domain someone talked the model into — is not a link at all.
 */
export function resolveLink(href: string): ResolvedLink {
  const value = href.trim();
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return /^\/[\w\-/.?=&%#]*$/.test(value) ? { kind: "internal", path: value } : null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "myinsideracademy.com" || host === "www.myinsideracademy.com") {
    return { kind: "internal", path: `${url.pathname}${url.search}${url.hash}` || "/" };
  }
  const allowed = EXTERNAL_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
  return allowed ? { kind: "external", url: url.toString() } : null;
}

/** Paths the model writes without a locale; `/ru/learn` stays as it is. */
export function hasLocalePrefix(path: string) {
  return /^\/(ru|ukr|en)(?=[/?#]|$)/.test(path);
}
