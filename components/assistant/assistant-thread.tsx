"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ClipboardList,
  Compass,
  Copy,
  Layers,
  ListChecks,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Workflow,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { links } from "@/content/site";
import { path, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { AssistantChat, AssistantErrorCode, AssistantMessage } from "./use-assistant";
import { Reply, useCopy } from "./reply";

export type AssistantMode = "site" | "lesson";

/** The assistant's face: a warm tile with the spark in it. */
export function AssistantAvatar({ size = "md", online }: { size?: "sm" | "md" | "lg"; online?: boolean }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center bg-[linear-gradient(145deg,var(--accent-strong),var(--accent)_55%,color-mix(in_oklab,var(--accent)_70%,#7a2e00))] text-on-accent shadow-glow",
        size === "sm" && "h-7 w-7 rounded-lg",
        size === "md" && "h-10 w-10 rounded-xl",
        size === "lg" && "h-14 w-14 rounded-2xl",
      )}
      aria-hidden
    >
      <Sparkles className={cn(size === "sm" ? "h-3.5 w-3.5" : size === "md" ? "h-5 w-5" : "h-7 w-7")} strokeWidth={2.2} />
      {online && (
        <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success" />
      )}
    </span>
  );
}

function errorText(code: AssistantErrorCode, d: Dictionary) {
  const a = d.assistant;
  return {
    offline: a.errorOffline,
    rate_limited: a.errorRateLimited,
    daily_limit: a.errorDailyLimit,
    guest_limit: a.errorGuestLimit,
    busy: a.errorBusy,
    upstream: a.errorUpstream,
    network: a.errorNetwork,
  }[code];
}

function Typing({ d }: { d: Dictionary }) {
  return (
    <span className="flex h-6 items-center gap-1" role="status" aria-label={d.assistant.thinking}>
      <span className="assistant-dot" />
      <span className="assistant-dot [animation-delay:0.16s]" />
      <span className="assistant-dot [animation-delay:0.32s]" />
    </span>
  );
}

function ErrorNote({
  code,
  d,
  locale,
  onRetry,
}: {
  code: AssistantErrorCode;
  d: Dictionary;
  locale: Locale;
  onRetry: () => void;
}) {
  const pathname = usePathname();
  const action =
    code === "upstream" || code === "network" ? (
      <button type="button" onClick={onRetry} className="assistant-chip">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        {d.assistant.retry}
      </button>
    ) : code === "guest_limit" ? (
      <Link href={`${path("/login", locale)}?next=${encodeURIComponent(pathname)}`} className="assistant-chip">
        {d.assistant.signIn}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    ) : code === "offline" || code === "busy" ? (
      <a href={links.telegramManager} target="_blank" rel="noopener noreferrer" className="assistant-chip">
        <Send className="h-3.5 w-3.5" aria-hidden />
        {d.assistant.writeManager}
      </a>
    ) : null;

  return (
    <div className="rounded-2xl rounded-tl-md border border-[color-mix(in_oklab,var(--warning)_30%,var(--line))] bg-warning-soft px-3.5 py-2.5">
      <p className="text-[13.5px] leading-relaxed text-ink-2">{errorText(code, d)}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

function CopyReply({ text, d }: { text: string; d: Dictionary }) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-label={copied ? d.assistant.copied : d.assistant.copy}
      title={copied ? d.assistant.copied : d.assistant.copy}
      className="grid h-7 w-7 place-items-center rounded-md text-faint transition-colors hover:bg-surface-3 hover:text-ink"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}

function Message({
  message,
  last,
  d,
  locale,
  onRetry,
  onNavigate,
}: {
  message: AssistantMessage;
  last: boolean;
  d: Dictionary;
  locale: Locale;
  onRetry: () => void;
  onNavigate?: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-[assistant-in-right_0.28s_var(--ease-out-quart)_both]">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-[14px] leading-[1.55] whitespace-pre-wrap text-on-accent [overflow-wrap:anywhere]">
          {message.content}
        </p>
      </div>
    );
  }

  const waiting = message.streaming && !message.content;
  return (
    <div className="group flex gap-2.5 animate-[assistant-in-left_0.32s_var(--ease-out-quart)_both]">
      <AssistantAvatar size="sm" />
      <div className="min-w-0 flex-1">
        {message.error && !message.content ? (
          <ErrorNote code={message.error} d={d} locale={locale} onRetry={onRetry} />
        ) : (
          <div className="rounded-2xl rounded-tl-md border border-line bg-surface-2 px-3.5 py-2.5">
            {waiting ? (
              <Typing d={d} />
            ) : (
              <Reply text={message.content} streaming={message.streaming} d={d} locale={locale} onNavigate={onNavigate} />
            )}
            {message.truncated && <p className="mt-2 text-[12px] text-muted">{d.assistant.truncated}</p>}
          </div>
        )}
        {!message.streaming && message.content && (
          <div
            className={cn(
              "mt-1 flex items-center gap-0.5 transition-opacity",
              last ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
            )}
          >
            <CopyReply text={message.content} d={d} />
          </div>
        )}
      </div>
    </div>
  );
}

const SITE_ICONS = [Compass, Layers, Workflow, GraduationCap];
const LESSON_ICONS = [BookOpen, ClipboardList, ListChecks, Sparkles];

function Welcome({
  mode,
  userName,
  d,
  onPick,
}: {
  mode: AssistantMode;
  userName?: string | null;
  d: Dictionary;
  onPick: (text: string) => void;
}) {
  const a = d.assistant;
  const suggestions =
    mode === "lesson"
      ? [a.lessonSuggest1, a.lessonSuggest2, a.lessonSuggest3, a.lessonSuggest4]
      : [a.suggest1, a.suggest2, a.suggest3, a.suggest4];
  const icons = mode === "lesson" ? LESSON_ICONS : SITE_ICONS;
  const firstName = userName?.trim().split(/\s+/)[0];

  return (
    <div className="flex min-h-full flex-col justify-end gap-5 pt-4">
      <div className="animate-rise">
        <AssistantAvatar size="lg" />
        <h3 className="mt-4 font-display text-[1.35rem] leading-tight font-extrabold tracking-tight text-ink">
          {firstName ? a.greetingNamed.replace("{name}", firstName) : a.greeting}
        </h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">{mode === "lesson" ? a.lessonIntro : a.intro}</p>
      </div>

      <ul className="grid gap-2">
        {suggestions.map((text, index) => {
          const Icon = icons[index];
          return (
            <li key={text} className="animate-rise" style={{ animationDelay: `${80 + index * 55}ms` }}>
              <button
                type="button"
                onClick={() => onPick(text)}
                className="group flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-px hover:border-[color-mix(in_oklab,var(--accent)_45%,var(--line))] hover:bg-accent-soft focus-visible:border-accent"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-accent-ink transition-colors group-hover:bg-accent group-hover:text-on-accent">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink-2 group-hover:text-ink">{text}</span>
                <ArrowRight
                  className="h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent-ink"
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The conversation and the box to type in. Shared by the floating widget and
 * the study room's side panel; the container decides size and chrome.
 */
export function AssistantThread({
  chat,
  d,
  locale,
  mode = "site",
  userName,
  inputRef,
  onNavigate,
}: {
  chat: AssistantChat;
  d: Dictionary;
  locale: Locale;
  mode?: AssistantMode;
  userName?: string | null;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onNavigate?: () => void;
}) {
  const { messages, busy, send, stop, retry } = chat;
  const [draft, setDraft] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const pinnedRef = React.useRef(true);
  const ownInputRef = React.useRef<HTMLTextAreaElement>(null);
  const textarea = inputRef ?? ownInputRef;

  // Follow the reply as it is written, unless the reader has scrolled up.
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Screen readers hear a reply once, when it is complete — not token by token.
  const lastMessage = messages[messages.length - 1];
  const announcement =
    lastMessage?.role === "assistant" && !lastMessage.streaming
      ? lastMessage.error
        ? errorText(lastMessage.error, d)
        : lastMessage.content
      : "";

  // The box grows with what is typed, up to a few lines.
  React.useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft, textarea]);

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    pinnedRef.current = true;
    send(text);
    setDraft("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="assistant-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {messages.length === 0 ? (
          <Welcome mode={mode} userName={userName} d={d} onPick={submit} />
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <Message
                key={message.id}
                message={message}
                last={index === messages.length - 1}
                d={d}
                locale={locale}
                onRetry={retry}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
        className="shrink-0 border-t border-line bg-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-line-2 bg-surface-2 py-1.5 pr-1.5 pl-3.5 transition-[border-color,box-shadow] duration-200 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-ring)]">
          <textarea
            ref={textarea}
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 2000))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit(draft);
              }
            }}
            rows={1}
            placeholder={mode === "lesson" ? d.assistant.lessonPlaceholder : d.assistant.placeholder}
            aria-label={mode === "lesson" ? d.assistant.lessonPlaceholder : d.assistant.placeholder}
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-[7px] text-[14.5px] leading-[1.45] text-ink outline-none placeholder:text-faint"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label={d.assistant.stop}
              title={d.assistant.stop}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-ground transition-transform duration-150 hover:scale-105"
            >
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label={d.assistant.send}
              title={d.assistant.send}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-on-accent transition-[background-color,transform,color] duration-150 hover:scale-105 hover:bg-accent-strong disabled:scale-100 disabled:bg-surface-3 disabled:text-faint"
            >
              <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.4} aria-hidden />
            </button>
          )}
        </div>
        <p className="mt-2 px-1 text-center text-[11px] leading-snug text-faint">
          {d.assistant.disclaimer}{" "}
          <a
            href={links.telegramManager}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted underline decoration-line-3 underline-offset-2 hover:text-ink"
          >
            {d.assistant.manager}
          </a>
        </p>
      </form>
    </div>
  );
}
