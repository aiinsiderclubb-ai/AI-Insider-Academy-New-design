"use client";

import * as React from "react";
import { readEvents } from "@/lib/assistant/stream";
import type { Locale } from "@/lib/i18n/config";

export type AssistantErrorCode =
  | "offline"
  | "rate_limited"
  | "daily_limit"
  | "guest_limit"
  | "busy"
  | "upstream"
  | "network";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Set while the reply is still arriving. */
  streaming?: boolean;
  /** The model stopped at its length limit. */
  truncated?: boolean;
  error?: AssistantErrorCode;
}

const MAX_STORED = 40;

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function load(key: string): AssistantMessage[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as AssistantMessage[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      : [];
  } catch {
    return [];
  }
}

function save(key: string, messages: AssistantMessage[]) {
  try {
    const settled = messages
      .filter((m) => !m.streaming && (m.content || m.error))
      .slice(-MAX_STORED)
      .map(({ streaming: _streaming, ...rest }) => rest);
    window.localStorage.setItem(key, JSON.stringify(settled));
  } catch {
    // Private mode or storage full: the conversation just will not survive a reload.
  }
}

function errorFor(status: number, payload: { code?: string; guest?: boolean }): AssistantErrorCode {
  if (status === 503) return "offline";
  if (status === 429) {
    if (payload.guest && (payload.code === "rate_limited" || payload.code === "daily_limit")) return "guest_limit";
    if (payload.code === "daily_limit") return "daily_limit";
    if (payload.code === "busy") return "busy";
    return "rate_limited";
  }
  return "upstream";
}

/**
 * One conversation with the site assistant: what has been said, sending,
 * stopping, starting over. The conversation is kept in localStorage under
 * `storageKey`, so it survives reloads and follows the visitor around the site.
 */
export function useAssistant({
  locale,
  storageKey,
  page,
  lesson,
}: {
  locale: Locale;
  storageKey: string;
  page?: string;
  lesson?: { courseId: string; lessonId: string };
}) {
  const [messages, setMessages] = React.useState<AssistantMessage[]>([]);
  const [busy, setBusy] = React.useState(false);
  const controllerRef = React.useRef<AbortController | null>(null);
  const messagesRef = React.useRef(messages);
  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Read after mount, not during render: the server has no localStorage, and
  // rendering the stored conversation there would not match the client.
  const [loadedKey, setLoadedKey] = React.useState<string | null>(null);
  React.useEffect(() => {
    setMessages(load(storageKey));
    setLoadedKey(storageKey);
  }, [storageKey]);

  // Nothing is written until the stored conversation has been read: the first
  // render's empty list would otherwise overwrite it.
  React.useEffect(() => {
    if (!busy && loadedKey === storageKey) save(storageKey, messages);
  }, [busy, messages, storageKey, loadedKey]);

  React.useEffect(() => () => controllerRef.current?.abort(), []);

  const patch = React.useCallback((id: string, change: Partial<AssistantMessage> | ((m: AssistantMessage) => Partial<AssistantMessage>)) => {
    setMessages((current) =>
      current.map((m) => (m.id === id ? { ...m, ...(typeof change === "function" ? change(m) : change) } : m)),
    );
  }, []);

  const run = React.useCallback(
    async (history: AssistantMessage[]) => {
      const reply: AssistantMessage = { id: newId(), role: "assistant", content: "", streaming: true };
      setMessages([...history, reply]);
      setBusy(true);

      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify({
            locale,
            page,
            lesson,
            // Failed turns are not part of the conversation the model sees.
            messages: history.filter((m) => !m.error && m.content).map(({ role, content }) => ({ role, content })),
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => ({}))) as { code?: string; guest?: boolean };
          patch(reply.id, { streaming: false, error: errorFor(response.status, payload) });
          return;
        }

        for await (const event of readEvents(response.body)) {
          if (event.type === "delta") patch(reply.id, (m) => ({ content: m.content + event.text }));
          else if (event.type === "done") patch(reply.id, { streaming: false, truncated: Boolean(event.truncated) });
          else if (event.type === "error") patch(reply.id, { streaming: false, error: "upstream" });
        }
        patch(reply.id, (m) => (m.streaming ? { streaming: false, error: m.content ? undefined : "upstream" } : {}));
      } catch {
        if (controller.signal.aborted) {
          // Stopped on purpose: keep whatever had arrived.
          patch(reply.id, { streaming: false });
        } else {
          patch(reply.id, (m) => ({ streaming: false, error: m.content ? undefined : "network" }));
        }
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
        setBusy(false);
      }
    },
    [lesson, locale, page, patch],
  );

  const send = React.useCallback(
    (text: string) => {
      const content = text.trim().slice(0, 2000);
      if (!content || controllerRef.current) return;
      void run([...messagesRef.current, { id: newId(), role: "user", content }]);
    },
    [run],
  );

  /** Asks again after a failed reply, without repeating the question. */
  const retry = React.useCallback(() => {
    if (controllerRef.current) return;
    const history = [...messagesRef.current];
    while (history.length && history[history.length - 1].role === "assistant") history.pop();
    if (history.length) void run(history);
  }, [run]);

  const stop = React.useCallback(() => controllerRef.current?.abort(), []);

  const reset = React.useCallback(() => {
    controllerRef.current?.abort();
    setMessages([]);
  }, []);

  return { messages, busy, send, retry, stop, reset };
}

export type AssistantChat = ReturnType<typeof useAssistant>;
