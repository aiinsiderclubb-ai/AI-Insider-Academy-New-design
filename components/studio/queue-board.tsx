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
import { ACTIVITY, DIRECTIONS, EXPERIENCE, SOURCES, optionLabel } from "@/content/application-options";

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

export function HomeworkQueue({
  locale,
  d,
  items,
  onReview,
  learnerBase,
  emptyTitle,
  emptyBody,
}: {
  locale: Locale;
  d: Dictionary;
  items: StudioHomework[];
  onReview: (id: string, status: "accepted" | "resubmit", comment?: string) => Promise<ActionResult>;
  /** Path prefix of a learner's Studio card; the user id is appended. */
  learnerBase?: string;
  emptyTitle?: string;
  emptyBody?: string;
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
        title={emptyTitle ?? pick(locale, "Очередь пуста", "The queue is clear")}
        body={emptyBody ?? pick(locale, "Все домашние задания проверены.", "Every assignment has been reviewed.")}
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
                  {item.plan === "mentor" && <Badge tone="accent">{pick(locale, "с ментором", "mentor plan")}</Badge>}
                  {item.plan === "self" && <Badge tone="warning">{pick(locale, "самостоятельно", "self-study")}</Badge>}
                  {item.plan == null && <Badge tone="neutral">{pick(locale, "подписка / выдан", "plan / granted")}</Badge>}
                </span>
                <span className="mt-1 block truncate font-mono text-[12px] text-muted">
                  {item.email} · {formatRelative(item.updatedAt || item.date, locale)}
                </span>
              </span>
              <Badge tone={item.status === "pending" ? "warning" : item.status === "accepted" ? "success" : "neutral"}>
                {item.status === "pending"
                  ? pick(locale, "ждёт проверки", "waiting")
                  : item.status === "accepted"
                    ? pick(locale, "принято", "accepted")
                    : item.status === "resubmit"
                      ? pick(locale, "на доработке", "sent back")
                      : item.status}
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
                    {item.fileUrl ? (
                      <a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-accent-ink underline-offset-4 hover:underline">
                        {item.fileName}
                      </a>
                    ) : (
                      item.fileName
                    )}
                  </p>
                )}

                {item.adminComment && (
                  <div className="mt-3 rounded-md border border-line bg-surface p-3">
                    <p className="eyebrow mb-1">{pick(locale, "Прошлый комментарий", "Previous comment")}</p>
                    <p className="text-[13px] whitespace-pre-line text-ink-2">{item.adminComment}</p>
                  </div>
                )}

                {learnerBase && item.userId ? (
                  <a href={`${learnerBase}${item.userId}`} className="mt-3 inline-block text-[12.5px] text-accent-ink underline-offset-4 hover:underline">
                    {pick(locale, "Карточка ученика →", "Learner card →")}
                  </a>
                ) : null}

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
        body={pick(locale, "Новые заявки на «Найди своё в AI» появятся здесь.", "New Find Your Path in AI applications appear here.")}
      />
    );
  }

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => {
        const fullName = [item.firstName, item.lastName].filter(Boolean).join(" ") || item.name || item.email;
        const facts = [item.age ? pick(locale, `${item.age} лет`, `${item.age} y.o.`) : null, item.country, formatRelative(item.date, locale)]
          .filter(Boolean)
          .join(" · ");
        const answers = [
          { label: pick(locale, "Чем занимается", "Currently"), value: optionLabel(ACTIVITY, item.currentActivity, locale) },
          { label: pick(locale, "Опыт с AI", "AI experience"), value: optionLabel(EXPERIENCE, item.aiExperience, locale) },
          { label: pick(locale, "Откуда узнал(а)", "Heard from"), value: optionLabel(SOURCES, item.source, locale) },
        ].filter((answer) => answer.value);
        return (
          <li
            key={item.id}
            id={`app-${item.id}`}
            className="scroll-mt-24 rounded-lg border border-line bg-surface p-5 target:border-accent target:ring-2 target:ring-accent/25"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-medium text-ink">{fullName}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[12px] text-muted">
                  <span className="truncate">{item.email}</span>
                  {item.telegram && <TelegramHandle handle={item.telegram} />}
                </p>
              </div>
              <Badge tone={item.status === "pending" || item.status === "new" ? "warning" : "neutral"}>
                {statusLabel(item.status, locale)}
              </Badge>
            </div>

            {facts && <p className="mt-1.5 text-[12.5px] text-muted">{facts}</p>}

            {answers.length > 0 && (
              <dl className="mt-4 grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-[auto_1fr]">
                {answers.map((answer) => (
                  <React.Fragment key={answer.label}>
                    <dt className="text-muted">{answer.label}</dt>
                    <dd className="text-ink-2">{answer.value}</dd>
                  </React.Fragment>
                ))}
              </dl>
            )}

            {item.interests && item.interests.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={pick(locale, "Интересы", "Interests")}>
                {item.interests.map((id) => (
                  <li key={id}>
                    <Badge tone="neutral">{optionLabel(DIRECTIONS, id, locale)}</Badge>
                  </li>
                ))}
              </ul>
            )}

            <LongAnswer locale={locale} label={pick(locale, "Почему хочет на курс", "Why this course")} text={item.motivation} />
            <LongAnswer locale={locale} label={pick(locale, "Цель после курса", "Goal after the course")} text={item.futureGoal} />

            {item.track && (
              <p className="mt-3 text-[13px] text-ink-3">
                {pick(locale, "Направление", "Track")}: {item.track}
              </p>
            )}

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
        );
      })}
    </ul>
  );
}

function statusLabel(status: string, locale: Locale) {
  const labels: Record<string, [string, string]> = {
    new: ["Новая", "New"],
    pending: ["Ждёт решения", "Pending"],
    approved: ["Одобрена", "Approved"],
    accepted: ["Одобрена", "Approved"],
    rejected: ["Отклонена", "Rejected"],
  };
  const label = labels[status];
  return label ? pick(locale, label[0], label[1]) : status;
}

/** '@name', 'name' or a t.me link, shown as a link that opens the chat. */
function TelegramHandle({ handle }: { handle: string }) {
  const name = handle.trim().replace(/^https?:\/\/(www\.)?t\.me\//i, "").replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{4,32}$/.test(name)) return <span>{handle}</span>;
  return (
    <a href={`https://t.me/${name}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
      @{name}
    </a>
  );
}

/** A free-text answer: a few lines at first, the rest on request. */
function LongAnswer({ locale, label, text }: { locale: Locale; label: string; text?: string }) {
  const [open, setOpen] = React.useState(false);
  const value = text?.trim();
  if (!value) return null;
  const long = value.length > 220;
  return (
    <div className="mt-4">
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2", long && !open && "line-clamp-4")}>
        {value}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="mt-1 text-[12.5px] font-medium text-accent hover:underline"
        >
          {open ? pick(locale, "Свернуть", "Show less") : pick(locale, "Показать полностью", "Show all")}
        </button>
      )}
    </div>
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
