"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, SquarePen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { AssistantAvatar, AssistantThread } from "./assistant-thread";
import { useAssistant } from "./use-assistant";

const TEASED_KEY = "insider-assistant:teased";
const TEASER_DELAY_MS = 12_000;

function isPhone() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
}

/**
 * The assistant on every page: a launcher in the corner and a chat panel that
 * opens from it — a floating card on desktop, the whole screen on a phone.
 *
 * `lift` raises the launcher above a bar docked to the bottom of the page,
 * such as the cabinet's tab bar on phones.
 */
export function AssistantWidget({
  locale,
  d,
  userName,
  lift,
}: {
  locale: Locale;
  d: Dictionary;
  userName?: string | null;
  lift?: string;
}) {
  const pathname = usePathname();
  const chat = useAssistant({ locale, storageKey: "insider-assistant:site:v1", page: pathname });
  const [open, setOpen] = React.useState(false);
  const [teaser, setTeaser] = React.useState(false);
  const launcherRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const titleId = React.useId();

  // A one-time hello, for visitors who have not found the launcher by then.
  React.useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(TEASED_KEY) === "1";
    } catch {}
    if (seen) return;
    const timer = window.setTimeout(() => setTeaser(true), TEASER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const dismissTeaser = React.useCallback(() => {
    setTeaser(false);
    try {
      window.localStorage.setItem(TEASED_KEY, "1");
    } catch {}
  }, []);

  const openPanel = () => {
    dismissTeaser();
    setOpen(true);
  };

  const close = React.useCallback(() => {
    setOpen(false);
    window.setTimeout(() => launcherRef.current?.focus(), 0);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);

    // Full screen on a phone: the page behind must not scroll under the chat.
    const root = document.documentElement;
    const previous = root.style.overflow;
    if (isPhone()) root.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panelRef.current?.contains(document.activeElement)) close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Following a link on a phone should show the page, not the chat over it.
  const onNavigate = React.useCallback(() => {
    if (isPhone()) setOpen(false);
  }, []);

  const hasConversation = chat.messages.length > 0;

  return (
    <>
      {/* ------------------------------- launcher ------------------------------- */}
      <div
        className={cn(
          "fixed right-4 z-50 flex flex-col items-end gap-3 sm:right-6",
          "bottom-[calc(1rem+var(--assistant-lift,0px)+env(safe-area-inset-bottom))] sm:bottom-[calc(1.5rem+var(--assistant-lift,0px))]",
          "transition-[bottom,opacity,transform] duration-300 ease-[var(--ease-out-quart)]",
          open && "pointer-events-none translate-y-2 scale-95 opacity-0",
          lift,
        )}
      >
        {teaser && !open && (
          <div className="relative w-[min(17rem,calc(100vw-2rem))] animate-[assistant-teaser_0.45s_var(--ease-spring)_both] rounded-2xl rounded-br-md border border-line-2 bg-surface p-3.5 pr-9 shadow-pop">
            <button
              type="button"
              onClick={openPanel}
              className="flex items-center gap-3 text-left after:absolute after:inset-0 after:content-['']"
            >
              <AssistantAvatar size="sm" online />
              <span className="text-[13.5px] leading-snug font-medium text-ink">{d.assistant.teaser}</span>
            </button>
            <button
              type="button"
              onClick={dismissTeaser}
              aria-label={d.assistant.dismiss}
              className="absolute top-2 right-2 z-10 rounded-md p-1 text-faint transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}

        <button
          ref={launcherRef}
          type="button"
          onClick={openPanel}
          aria-label={d.assistant.open}
          aria-expanded={open}
          aria-haspopup="dialog"
          tabIndex={open ? -1 : 0}
          className={cn(
            "assistant-launcher group relative flex h-14 items-center gap-2.5 rounded-full bg-accent text-on-accent shadow-glow",
            "w-14 justify-center sm:w-auto sm:justify-start sm:pr-5 sm:pl-2",
            "transition-[background-color,transform,box-shadow] duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:bg-accent-strong active:translate-y-0 active:scale-[0.97]",
          )}
        >
          <span className="relative grid h-10 w-10 place-items-center rounded-full bg-[color-mix(in_oklab,var(--on-accent)_14%,transparent)] transition-transform duration-300 group-hover:rotate-12">
            <SparkIcon />
            {hasConversation && (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-accent bg-on-accent" aria-hidden />
            )}
          </span>
          <span className="hidden text-[14.5px] font-semibold tracking-tight sm:inline">{d.assistant.launcher}</span>
        </button>
      </div>

      {/* --------------------------------- panel -------------------------------- */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className={cn(
            "fixed z-[60] flex flex-col overflow-hidden bg-surface text-ink",
            "inset-0 h-dvh animate-[assistant-sheet_0.32s_var(--ease-out-quart)_both]",
            "sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(42rem,calc(100dvh-3rem))] sm:w-[26rem] sm:origin-bottom-right sm:animate-[assistant-panel_0.3s_var(--ease-out-quart)_both] sm:rounded-[22px] sm:border sm:border-line-2 sm:shadow-pop",
          )}
        >
          <header className="relative shrink-0 overflow-hidden border-b border-line px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3.5">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_160%_at_0%_0%,color-mix(in_oklab,var(--accent)_18%,transparent),transparent_58%)]"
              aria-hidden
            />
            <div className="relative flex items-center gap-3">
              <AssistantAvatar online />
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="font-display text-[15.5px] leading-tight font-extrabold tracking-tight">
                  {d.assistant.name}
                </h2>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-muted">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                  {d.assistant.status}
                </p>
              </div>
              {hasConversation && (
                <button
                  type="button"
                  onClick={() => {
                    chat.reset();
                    inputRef.current?.focus();
                  }}
                  aria-label={d.assistant.newChat}
                  title={d.assistant.newChat}
                  className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-ink"
                >
                  <SquarePen className="h-4.5 w-4.5" aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={close}
                aria-label={d.assistant.minimize}
                title={d.assistant.minimize}
                className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <ChevronDown className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1">
            <AssistantThread
              chat={chat}
              d={d}
              locale={locale}
              userName={userName}
              inputRef={inputRef}
              onNavigate={onNavigate}
            />
          </div>
        </div>
      )}
    </>
  );
}

/** The spark, drawn to sit optically centred in the round launcher. */
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5.5 w-5.5" fill="currentColor" aria-hidden>
      <path d="M12 2.5c.4 0 .75.27.85.66l1.1 4.2a4 4 0 0 0 2.69 2.7l4.2 1.09a.88.88 0 0 1 0 1.7l-4.2 1.1a4 4 0 0 0-2.7 2.69l-1.09 4.2a.88.88 0 0 1-1.7 0l-1.1-4.2a4 4 0 0 0-2.69-2.7l-4.2-1.09a.88.88 0 0 1 0-1.7l4.2-1.1a4 4 0 0 0 2.7-2.69l1.09-4.2A.88.88 0 0 1 12 2.5Z" />
      <path d="M19 2.25c.2 0 .37.13.42.32l.3 1.14c.1.38.4.68.78.78l1.14.3a.44.44 0 0 1 0 .85l-1.14.3a1.1 1.1 0 0 0-.78.78l-.3 1.14a.44.44 0 0 1-.84 0l-.3-1.14a1.1 1.1 0 0 0-.79-.78l-1.13-.3a.44.44 0 0 1 0-.85l1.13-.3c.39-.1.69-.4.79-.78l.3-1.14a.44.44 0 0 1 .42-.32Z" opacity=".75" />
    </svg>
  );
}
