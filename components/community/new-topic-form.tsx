"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Field, Input, Select, Textarea } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import { pick } from "@/content/locale";
import type { Dictionary } from "@/lib/i18n";
import { path, type Locale } from "@/lib/i18n/config";

export function NewTopicForm({
  locale,
  d,
  categories,
}: {
  locale: Locale;
  d: Dictionary;
  categories: { id: string; label: string }[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState(categories[0]?.id ?? "general");
  const [sending, setSending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      const response = await fetch("/api/forum/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), category }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        topic?: { slug: string };
        errorRu?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.errorRu ?? payload.error ?? "");
      push({ tone: "success", title: pick(locale, "Вопрос опубликован", "Question posted") });
      router.push(
        payload.topic?.slug
          ? path(`/community/forum/${encodeURIComponent(payload.topic.slug)}`, locale)
          : path("/community/forum", locale),
      );
      router.refresh();
    } catch (error) {
      push({ tone: "warning", title: (error as Error).message || d.errors.generic });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
      <Field label={pick(locale, "Заголовок", "Title")} htmlFor="topic-title" required>
        <Input
          id="topic-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={140}
          placeholder={pick(locale, "Например: как обработать 429 в n8n", "For example: handling 429 in n8n")}
          required
        />
      </Field>

      <Field label={pick(locale, "Категория", "Category")} htmlFor="topic-category">
        <Select id="topic-category" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={pick(locale, "Вопрос", "Question")}
        htmlFor="topic-body"
        hint={pick(locale, "Контекст, что пробовали, что получилось", "Context, what you tried, what happened")}
        required
      >
        <Textarea id="topic-body" value={body} onChange={(event) => setBody(event.target.value)} rows={8} required />
      </Field>

      <Button type="submit" size="lg" loading={sending} disabled={!title.trim() || !body.trim()} className="self-start">
        <Send className="h-4 w-4" aria-hidden />
        {d.community.askQuestion}
      </Button>
    </form>
  );
}
