import { describe, expect, it } from "vitest";
import { hasLocalePrefix, parseInline, parseMarkdown, resolveLink } from "@/lib/assistant/markdown";
import { readEvents, takeEvents } from "@/lib/assistant/stream";

describe("assistant markdown", () => {
  it("reads bold, code and links inside a line", () => {
    expect(parseInline("Start with **AI Starter Week** — `free` — [open](/learn/ai-start).")).toEqual([
      { type: "text", text: "Start with " },
      { type: "strong", children: [{ type: "text", text: "AI Starter Week" }] },
      { type: "text", text: " — " },
      { type: "code", text: "free" },
      { type: "text", text: " — " },
      { type: "link", text: "open", href: "/learn/ai-start" },
      { type: "text", text: "." },
    ]);
  });

  it("reads a link inside bold", () => {
    expect(parseInline("**[Pro](/plans)** fits")).toEqual([
      { type: "strong", children: [{ type: "link", text: "Pro", href: "/plans" }] },
      { type: "text", text: " fits" },
    ]);
  });

  it("leaves half-written markup as text while a reply streams in", () => {
    expect(parseInline("This is **bol")).toEqual([{ type: "text", text: "This is **bol" }]);
    expect(parseInline("[link](/lea")).toEqual([{ type: "text", text: "[link](/lea" }]);
  });

  it("splits a reply into paragraphs, lists, headings and code", () => {
    const blocks = parseMarkdown(
      [
        "### Your options",
        "Two good fits:",
        "",
        "1. **Club** — €59",
        "2. **Pro** — €99",
        "   includes every course",
        "- a bullet after numbers starts a new list",
        "",
        "```text",
        "You are an expert…",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list", "code"]);
    const numbered = blocks[2] as Extract<(typeof blocks)[number], { type: "list" }>;
    expect(numbered.ordered).toBe(true);
    expect(numbered.items).toHaveLength(2);
    expect(numbered.items[1].at(-1)).toEqual({ type: "text", text: "includes every course" });
    expect(blocks[4]).toEqual({ type: "code", lang: "text", code: "You are an expert…" });
  });

  it("keeps line breaks inside a paragraph", () => {
    const [paragraph] = parseMarkdown("first line\nsecond line");
    expect(paragraph).toEqual({
      type: "paragraph",
      lines: [[{ type: "text", text: "first line" }], [{ type: "text", text: "second line" }]],
    });
  });
});

describe("assistant links", () => {
  it("keeps site paths inside the app", () => {
    expect(resolveLink("/learn/ai-start")).toEqual({ kind: "internal", path: "/learn/ai-start" });
    expect(resolveLink("https://myinsideracademy.com/plans?billing=annual")).toEqual({
      kind: "internal",
      path: "/plans?billing=annual",
    });
  });

  it("opens only known hosts in a new tab", () => {
    expect(resolveLink("https://t.me/vladyslavarcher")).toEqual({ kind: "external", url: "https://t.me/vladyslavarcher" });
    expect(resolveLink("https://syntx.ai/welcome/V8sre2aW")?.kind).toBe("external");
  });

  it("drops anything that could hurt the reader", () => {
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "//evil.example/learn",
      "/\\evil.example",
      "http://t.me/plain-http",
      "https://t.me.evil.example/",
      "https://myinsideracademy.com.evil.example/",
      "/learn/<script>",
    ]) {
      expect(resolveLink(href), href).toBeNull();
    }
  });

  it("recognises a path that already carries a locale", () => {
    expect(hasLocalePrefix("/en/learn")).toBe(true);
    expect(hasLocalePrefix("/ukr")).toBe(true);
    expect(hasLocalePrefix("/english-course")).toBe(false);
    expect(hasLocalePrefix("/learn")).toBe(false);
  });
});

describe("assistant stream", () => {
  it("returns complete events and holds back the unfinished one", () => {
    const { events, rest } = takeEvents('data: {"type":"delta","text":"Hi"}\n\ndata: {"type":"del');
    expect(events).toEqual([{ type: "delta", text: "Hi" }]);
    expect(rest).toBe('data: {"type":"del');
  });

  it("skips malformed lines instead of failing the reply", () => {
    const { events } = takeEvents('data: not json\n\ndata: {"type":"done","truncated":false}\n\n');
    expect(events).toEqual([{ type: "done", truncated: false }]);
  });

  it("reassembles events split across network chunks, even mid-character", async () => {
    const bytes = new TextEncoder().encode(
      'data: {"type":"delta","text":"Привет"}\n\ndata: {"type":"delta","text":"!"}\n\ndata: {"type":"done"}\n\n',
    );
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // Cut inside the two-byte "р" as well as between events.
        for (const [from, to] of [
          [0, 33],
          [33, 60],
          [60, bytes.length],
        ]) {
          controller.enqueue(bytes.slice(from, to));
        }
        controller.close();
      },
    });
    const events = [];
    for await (const event of readEvents(body)) events.push(event);
    expect(events).toEqual([
      { type: "delta", text: "Привет" },
      { type: "delta", text: "!" },
      { type: "done" },
    ]);
  });
});
