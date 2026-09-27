"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, EyeOff, Lock, LockOpen, Pin, PinOff, Undo2 } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { useToast } from "@/components/primitives/toast";
import { pick } from "@/content/locale";
import { moderatePost, moderateTopic, type ModerationResult } from "@/lib/api/forum-actions";
import type { Dictionary } from "@/lib/i18n";
import { path, type Locale } from "@/lib/i18n/config";

/* ============================ the asker's mark ============================= */

/**
 * Shown only to the person who asked. Marking an answer is the single most
 * useful thing a thread can end with: the next student with the same problem
 * reads the accepted answer first instead of the whole thread.
 */
export function MarkSolution({
  topicId,
  postId,
  isSolution,
  locale,
  d,
}: {
  topicId: string;
  postId: string;
  isSolution: boolean;
  locale: Locale;
  d: Dictionary;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, setPending] = React.useState(false);

  async function toggle() {
    setPending(true);
    try {
      const response = await fetch(`/api/forum/topics/${encodeURIComponent(topicId)}/solution`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: isSolution ? null : postId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { errorRu?: string; error?: string };
      if (!response.ok) throw new Error(payload.errorRu ?? payload.error ?? "");
      router.refresh();
    } catch (error) {
      push({ tone: "warning", title: (error as Error).message || d.errors.generic });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant={isSolution ? "ghost" : "subtle"} size="sm" loading={pending} onClick={toggle}>
      {isSolution ? <Undo2 className="h-3.5 w-3.5" aria-hidden /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
      {isSolution ? pick(locale, "Снять отметку", "Unmark") : pick(locale, "Это решение", "This solved it")}
    </Button>
  );
}

/* =============================== moderation ================================ */

function useModeration(locale: Locale, d: Dictionary) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, setPending] = React.useState<string | null>(null);

  async function run(key: string, action: () => Promise<ModerationResult>, after?: () => void) {
    setPending(key);
    try {
      const result = await action();
      if (!result.ok) {
        push({
          tone: "warning",
          title: result.message === "network" ? d.errors.network : result.message || d.errors.generic,
        });
        return;
      }
      if (after) after();
      else router.refresh();
    } finally {
      setPending(null);
    }
  }

  return { pending, run, router };
}

/**
 * Pin, lock and hide for a whole topic. Rendered only for a Studio session;
 * the API refuses the same calls from anyone else regardless.
 */
export function TopicModeration({
  topicId,
  isPinned,
  isLocked,
  locale,
  d,
}: {
  topicId: string;
  isPinned: boolean;
  isLocked: boolean;
  locale: Locale;
  d: Dictionary;
}) {
  const { pending, run, router } = useModeration(locale, d);

  const hide = () => {
    const sure = window.confirm(
      pick(
        locale,
        "Скрыть тему? Её перестанут видеть все участники. Запись останется в журнале.",
        "Hide this topic? No member will see it any more. The record stays in the audit log.",
      ),
    );
    if (!sure) return;
    run("hide", () => moderateTopic(locale, topicId, { isHidden: true }), () =>
      router.push(path("/community/forum", locale)),
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line-2 bg-surface-2 px-3 py-2.5">
      <span className="eyebrow mr-1">{pick(locale, "Модерация", "Moderation")}</span>
      <Button
        variant="ghost"
        size="sm"
        loading={pending === "pin"}
        onClick={() => run("pin", () => moderateTopic(locale, topicId, { isPinned: !isPinned }))}
      >
        {isPinned ? <PinOff className="h-3.5 w-3.5" aria-hidden /> : <Pin className="h-3.5 w-3.5" aria-hidden />}
        {isPinned ? pick(locale, "Открепить", "Unpin") : pick(locale, "Закрепить", "Pin")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        loading={pending === "lock"}
        onClick={() => run("lock", () => moderateTopic(locale, topicId, { isLocked: !isLocked }))}
      >
        {isLocked ? <LockOpen className="h-3.5 w-3.5" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />}
        {isLocked ? pick(locale, "Открыть ответы", "Reopen") : pick(locale, "Закрыть ответы", "Lock")}
      </Button>
      <Button variant="ghost" size="sm" loading={pending === "hide"} onClick={hide} className="text-danger">
        <EyeOff className="h-3.5 w-3.5" aria-hidden />
        {pick(locale, "Скрыть тему", "Hide topic")}
      </Button>
    </div>
  );
}

export function PostModeration({ postId, locale, d }: { postId: string; locale: Locale; d: Dictionary }) {
  const { pending, run } = useModeration(locale, d);

  const hide = () => {
    const sure = window.confirm(pick(locale, "Скрыть этот ответ?", "Hide this answer?"));
    if (sure) run("hide", () => moderatePost(locale, postId, true));
  };

  return (
    <Button variant="ghost" size="sm" loading={pending === "hide"} onClick={hide} className="text-danger">
      <EyeOff className="h-3.5 w-3.5" aria-hidden />
      {pick(locale, "Скрыть", "Hide")}
    </Button>
  );
}
