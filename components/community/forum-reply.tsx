"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Field, Textarea } from "@/components/primitives/field";
import { Note } from "@/components/primitives/states";
import { useToast } from "@/components/primitives/toast";
import { pick } from "@/content/locale";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export function ForumReply({
  topicId,
  locale,
  d,
  locked,
}: {
  topicId: string;
  locale: Locale;
  d: Dictionary;
  locked?: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);

  if (locked) {
    return <Note tone="warning">{pick(locale, "Тема закрыта для новых ответов.", "This topic is closed for new answers.")}</Note>;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      const response = await fetch(`/api/forum/topics/${encodeURIComponent(topicId)}/posts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const payload = (await response.json().catch(() => ({}))) as { errorRu?: string; error?: string };
      if (!response.ok) throw new Error(payload.errorRu ?? payload.error ?? "");
      setBody("");
      push({ tone: "success", title: pick(locale, "Ответ опубликован", "Answer posted") });
      router.refresh();
    } catch (error) {
      push({ tone: "warning", title: (error as Error).message || d.errors.generic });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-surface p-5">
      <Field label={d.community.answers} htmlFor="forum-reply">
        <Textarea
          id="forum-reply"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          placeholder={pick(locale, "Опишите решение так, чтобы его можно было повторить", "Describe the fix so someone can repeat it")}
          required
        />
      </Field>
      <Button type="submit" className="mt-4" loading={sending} disabled={!body.trim()}>
        <Send className="h-4 w-4" aria-hidden />
        {pick(locale, "Ответить", "Post answer")}
      </Button>
    </form>
  );
}
