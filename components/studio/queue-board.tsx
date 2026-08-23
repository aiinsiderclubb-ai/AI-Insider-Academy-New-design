"use client";

import * as React from "react";
import { Check, FileText, Inbox, MessageSquareQuote, RotateCcw, Star, X } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Textarea } from "@/components/primitives/field";
import { Tabs } from "@/components/primitives/navigation";
import { EmptyState } from "@/components/primitives/states";
import { useToast } from "@/components/primitives/toast";
import type { ActionResult } from "@/lib/api/studio-actions";
import type { StudioApplication, StudioHomework, StudioReview } from "@/lib/api/studio";
import { pick } from "@/content/locale";
import { formatRelative, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Tab = "homework" | "applications" | "reviews";

export function QueueBoard({
  locale,
  d,
  initialTab,
  homework,
  applications,
  reviews,
  onReviewHomework,
  onDecideApplication,
  onModerateReview,
}: {
  locale: Locale;
  d: Dictionary;
  initialTab: Tab;
  homework: StudioHomework[];
  applications: StudioApplication[];
  reviews: StudioReview[];
  onReviewHomework: (id: string, status: "accepted" | "resubmit", comment?: string) => Promise<ActionResult>;
  onDecideApplication: (id: string, decision: "approve" | "reject") => Promise<ActionResult>;
  onModerateReview: (id: string, status: "approved" | "rejected") => Promise<ActionResult>;
}) {
  const [tab, setTab] = React.useState<Tab>(initialTab);

  const items = [
    { value: "homework" as const, label: pick(locale, "Домашние задания", "Assignments"), count: homework.length },
    { value: "applications" as const, label: pick(locale, "Заявки", "Applications"), count: applications.length },
    { value: "reviews" as const, label: pick(locale, "Отзывы", "Reviews"), count: reviews.length },
  ];

  return (
    <>
      <Tabs items={items} value={tab} onChange={setTab} label={pick(locale, "Очереди", "Queues")} className="mb-6" />

      {tab === "homework" && (
        <HomeworkQueue locale={locale} d={d} items={homework} onReview={onReviewHomework} />
      )}
      {tab === "applications" && (
        <ApplicationQueue locale={locale} d={d} items={applications} onDecide={onDecideApplication} />
      )}
      {tab === "reviews" && <ReviewQueue locale={locale} d={d} items={reviews} onModerate={onModerateReview} />}
    </>
  );
}

/* -------------------------------- homework -------------------------------- */

function HomeworkQueue({
  locale,
  d,
  items,
  onReview,
}: {
  locale: Locale;
  d: Dictionary;
  items: StudioHomework[];
  onReview: (id: string, status: "accepted" | "resubmit", comment?: string) => Promise<ActionResult>;
}) {
  const { push } = useToast();
  const [openId, setOpenId] = React.useState<string | null>(items[0]?.id ?? null);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  async function act(id: string, status: "accepted" | "resubmit") {
    setBusy(`${id}:${status}`);
    const result = await onReview(id, status, comment);
    setBusy(null);
    if (result.ok) {
      push({
        tone: "success",
        title: status === "accepted" ? pick(locale, "Принято", "Accepted") : pick(locale, "На доработку", "Sent back"),
      });
      setComment("");
    } else {
      push({ tone: "warning", title: result.message === "network" ? d.errors.network : (result.message ?? d.errors.generic) });
    }
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={<Inbox className="h-5 w-5" aria-hidden />}
        title={pick(locale, "Очередь пуста", "The queue is clear")}
        body={pick(locale, "Все домашние задания проверены.", "Every assignment has been reviewed.")}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <li key={item.id} className="overflow-hidden rounded-lg border border-line bg-surface">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : item.id)}
              aria-expanded={open}
              className="flex w-full flex-wrap items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-surface-2"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium text-ink">{item.courseTitle || item.courseId}</span>
                  <Badge tone="outline">
                    {pick(locale, "урок", "lesson")} {item.lessonIndex + 1}
                  </Badge>
                </span>
                <span className="mt-1 block truncate font-mono text-[12px] text-muted">
                  {item.email} · {formatRelative(item.updatedAt || item.date, locale)}
                </span>
              </span>
              <Badge tone={item.status === "pending" ? "warning" : item.status === "accepted" ? "success" : "neutral"}>
                {item.status}
              </Badge>
            </button>

            {open && (
              <div className="border-t border-line p-4">
                <p className="eyebrow mb-2">{pick(locale, "Ответ студента", "Submission")}</p>
                <p className="rounded-md border border-line bg-surface-2 p-4 text-[13.5px] leading-relaxed whitespace-pre-line text-ink-2">
                  {item.content || pick(locale, "Без текста", "No text")}
                </p>

                {item.fileName && (
                  <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[12px] text-muted">
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    {item.fileName}
                  </p>
                )}

                <div className="mt-4">
                  <Textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={3}
                    placeholder={pick(locale, "Комментарий куратора (придёт студенту)", "Curator comment (sent to the student)")}
                    aria-label={pick(locale, "Комментарий куратора", "Curator comment")}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" loading={busy === `${item.id}:accepted`} onClick={() => act(item.id, "accepted")}>
                    <Check className="h-4 w-4" aria-hidden />
                    {pick(locale, "Принять", "Accept")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === `${item.id}:resubmit`}
                    onClick={() => act(item.id, "resubmit")}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    {pick(locale, "На доработку", "Send back")}
                  </Button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------ applications ------------------------------- */

function ApplicationQueue({
  locale,
  d,
  items,
  onDecide,
}: {
  locale: Locale;
  d: Dictionary;
  items: StudioApplication[];
  onDecide: (id: string, decision: "approve" | "reject") => Promise<ActionResult>;
}) {
  const { push } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function act(id: string, decision: "approve" | "reject") {
    setBusy(`${id}:${decision}`);
    const result = await onDecide(id, decision);
    setBusy(null);
    push(
      result.ok
        ? { tone: "success", title: decision === "approve" ? pick(locale, "Одобрено", "Approved") : pick(locale, "Отклонено", "Rejected") }
        : { tone: "warning", title: result.message === "network" ? d.errors.network : (result.message ?? d.errors.generic) },
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={<Inbox className="h-5 w-5" aria-hidden />}
        title={pick(locale, "Заявок нет", "No applications")}
        body={pick(locale, "Новые заявки Accelerator появятся здесь.", "New Accelerator applications appear here.")}
      />
    );
  }

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-medium text-ink">{item.name || item.email}</p>
              <p className="mt-0.5 truncate font-mono text-[12px] text-muted">{item.email}</p>
            </div>
            <Badge tone={item.status === "pending" || item.status === "new" ? "warning" : "neutral"}>{item.status}</Badge>
          </div>

          {item.track && (
            <p className="mt-3 text-[13px] text-ink-3">
              {pick(locale, "Направление", "Track")}: {item.track}
            </p>
          )}
          <p className="mt-1.5 text-[12.5px] text-muted">{formatRelative(item.date, locale)}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" loading={busy === `${item.id}:approve`} onClick={() => act(item.id, "approve")}>
              <Check className="h-4 w-4" aria-hidden />
              {pick(locale, "Одобрить", "Approve")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={busy === `${item.id}:reject`}
              onClick={() => act(item.id, "reject")}
              className="text-danger hover:bg-danger-soft"
            >
              <X className="h-4 w-4" aria-hidden />
              {pick(locale, "Отклонить", "Reject")}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------- reviews --------------------------------- */

function ReviewQueue({
  locale,
  d,
  items,
  onModerate,
}: {
  locale: Locale;
  d: Dictionary;
  items: StudioReview[];
  onModerate: (id: string, status: "approved" | "rejected") => Promise<ActionResult>;
}) {
  const { push } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function act(id: string, status: "approved" | "rejected") {
    setBusy(`${id}:${status}`);
    const result = await onModerate(id, status);
    setBusy(null);
    push(
      result.ok
        ? { tone: "success", title: status === "approved" ? pick(locale, "Опубликован", "Published") : pick(locale, "Отклонён", "Rejected") }
        : { tone: "warning", title: result.message === "network" ? d.errors.network : (result.message ?? d.errors.generic) },
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={<MessageSquareQuote className="h-5 w-5" aria-hidden />}
        title={pick(locale, "Отзывов на модерации нет", "Nothing waiting on moderation")}
        body={pick(locale, "Новые отзывы студентов появятся здесь.", "New student reviews appear here.")}
      />
    );
  }

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-medium text-ink">{item.userName}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-muted">{item.courseTitle || item.courseId}</p>
            </div>
            <span className="flex items-center gap-1" aria-label={`${item.rating}/5`}>
              {[1, 2, 3, 4, 5].map((step) => (
                <Star
                  key={step}
                  className={cn("h-3.5 w-3.5", step <= item.rating ? "text-accent" : "text-line-3")}
                  fill={step <= item.rating ? "currentColor" : "none"}
                  strokeWidth={step <= item.rating ? 0 : 1.5}
                  aria-hidden
                />
              ))}
            </span>
          </div>

          <p className="mt-3.5 rounded-md border border-line bg-surface-2 p-3.5 text-[13.5px] leading-relaxed text-ink-2">
            {item.text || pick(locale, "Без текста", "No text")}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busy === `${item.id}:approved`}
              disabled={!item.text?.trim()}
              onClick={() => act(item.id, "approved")}
            >
              <Check className="h-4 w-4" aria-hidden />
              {pick(locale, "Опубликовать", "Publish")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={busy === `${item.id}:rejected`}
              onClick={() => act(item.id, "rejected")}
              className="text-danger hover:bg-danger-soft"
            >
              <X className="h-4 w-4" aria-hidden />
              {pick(locale, "Отклонить", "Reject")}
            </Button>
          </div>
          {!item.text?.trim() && (
            <p className="mt-2.5 text-[12px] text-warning">
              {pick(locale, "Пустой отзыв нельзя опубликовать", "An empty review cannot be published")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
