"use client";

import * as React from "react";
import { Send, Users } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import { pick } from "@/content/locale";
import { sendStudioMail, type MailInput } from "@/lib/api/studio-actions";
import type { Locale } from "@/lib/i18n/config";

type Segment = MailInput["segment"];

/**
 * A letter written by hand: to named people or to a segment. Counting first is
 * part of the flow — the send button shows how many letters will go out.
 */
export function ComposeMail({
  locale,
  courses,
  smtpOn,
}: {
  locale: Locale;
  courses: { id: string; title: string }[];
  smtpOn: boolean;
}) {
  const { push } = useToast();
  const [segment, setSegment] = React.useState<Segment>("list");
  const [recipients, setRecipients] = React.useState("");
  const [courseId, setCourseId] = React.useState("");
  const [news, setNews] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [ctaLabel, setCtaLabel] = React.useState("");
  const [ctaUrl, setCtaUrl] = React.useState("");
  const [lang, setLang] = React.useState<string>(locale);
  const [count, setCount] = React.useState<{ count: number; preview: string[]; unknown: string[] } | null>(null);
  const [busy, setBusy] = React.useState<"count" | "send" | null>(null);

  const segments: { value: Segment; label: string }[] = [
    { value: "list", label: pick(locale, "Конкретным людям", "Named people") },
    { value: "all", label: pick(locale, "Всем с подтверждённой почтой", "Everyone with a confirmed email") },
    { value: "buyers", label: pick(locale, "Всем, кто что-то купил", "Everyone who bought something") },
    { value: "course", label: pick(locale, "Ученикам курса", "Learners of a course") },
    { value: "mentor", label: pick(locale, "Тариф «С ментором»", "Mentor plan") },
    { value: "self", label: pick(locale, "Тариф «Самостоятельно»", "Self-study plan") },
    { value: "no_purchase", label: pick(locale, "Зарегистрировались, но не купили", "Signed up, never bought") },
  ];

  const audience = (): MailInput => ({
    segment,
    recipients: segment === "list" ? recipients : undefined,
    courseId: segment === "course" || segment === "mentor" || segment === "self" ? courseId || undefined : undefined,
  });

  React.useEffect(() => setCount(null), [segment, recipients, courseId]);

  async function countPeople() {
    setBusy("count");
    const result = await sendStudioMail(locale, { ...audience(), dryRun: true });
    setBusy(null);
    if (result.ok) setCount({ count: result.count ?? 0, preview: result.preview ?? [], unknown: result.unknown ?? [] });
    else push({ tone: "warning", title: result.message ?? pick(locale, "Не удалось посчитать", "Could not count") });
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const n = count?.count;
    const sure = window.confirm(
      n != null
        ? pick(locale, `Отправить письмо «${subject}»: ${n} получ.?`, `Send “${subject}” to ${n} people?`)
        : pick(locale, `Отправить письмо «${subject}»?`, `Send “${subject}”?`),
    );
    if (!sure) return;
    setBusy("send");
    const result = await sendStudioMail(locale, {
      ...audience(),
      subject,
      body,
      ctaLabel: ctaLabel || undefined,
      ctaUrl: ctaUrl || undefined,
      kind: news ? "news" : "personal",
      locale: lang,
    });
    setBusy(null);
    if (result.ok) {
      push({
        tone: "success",
        title: pick(locale, `В очереди: ${result.queued ?? 0} писем`, `Queued: ${result.queued ?? 0} letters`),
        body: result.smtp === false ? pick(locale, "SMTP не настроен — письма уйдут, когда его включат.", "SMTP is off — letters go out once it is on.") : undefined,
      });
      setSubject("");
      setBody("");
      setCount(null);
    } else {
      push({ tone: "warning", title: result.message ?? pick(locale, "Не удалось отправить", "Send failed") });
    }
  }

  const needsCourse = segment === "course";
  const allowsCourse = segment === "course" || segment === "mentor" || segment === "self";

  return (
    <form onSubmit={send} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={pick(locale, "Кому", "To")} htmlFor="mail-segment">
          <Select id="mail-segment" value={segment} onChange={(event) => setSegment(event.target.value as Segment)}>
            {segments.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
        {allowsCourse && (
          <Field label={needsCourse ? pick(locale, "Курс", "Course") : pick(locale, "Курс (необязательно)", "Course (optional)")} htmlFor="mail-course">
            <Select id="mail-course" value={courseId} onChange={(event) => setCourseId(event.target.value)} required={needsCourse}>
              <option value="">{needsCourse ? pick(locale, "Выберите курс", "Choose a course") : pick(locale, "Любой курс", "Any course")}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {segment === "list" && (
        <Field
          label={pick(locale, "Получатели", "Recipients")}
          htmlFor="mail-recipients"
          hint={pick(locale, "ID аккаунта, email или личный ID — через запятую или с новой строки.", "Account id, email or personal id — commas or new lines.")}
        >
          <Textarea id="mail-recipients" rows={3} value={recipients} onChange={(event) => setRecipients(event.target.value)} className="font-mono text-[13px]" placeholder="42, anna@example.com, AIA-7K2Q9X" required />
        </Field>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" loading={busy === "count"} onClick={countPeople}>
          <Users className="h-3.5 w-3.5" aria-hidden />
          {pick(locale, "Посчитать получателей", "Count recipients")}
        </Button>
        {count && (
          <span className="text-[13px] text-ink-2">
            {pick(locale, `Получат: ${count.count}`, `Recipients: ${count.count}`)}
            {count.preview.length ? <span className="ml-2 font-mono text-[12px] text-muted">{count.preview.slice(0, 5).join(", ")}{count.count > 5 ? "…" : ""}</span> : null}
            {count.unknown.length ? (
              <span className="ml-2 text-[12px] text-warning">{pick(locale, "не найдены:", "not found:")} {count.unknown.join(", ")}</span>
            ) : null}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field label={pick(locale, "Тема", "Subject")} htmlFor="mail-subject">
          <Input id="mail-subject" value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={200} />
        </Field>
        <Field label={pick(locale, "Язык подписи", "Letter language")} htmlFor="mail-lang">
          <Select id="mail-lang" value={lang} onChange={(event) => setLang(event.target.value)}>
            <option value="ru">RU</option>
            <option value="ukr">UKR</option>
            <option value="en">EN</option>
          </Select>
        </Field>
      </div>
      <Field
        label={pick(locale, "Текст", "Text")}
        htmlFor="mail-body"
        hint={pick(locale, "Обычный текст. Пустая строка — новый абзац. Обращение по имени добавим сами.", "Plain text. A blank line starts a paragraph. We add the greeting by name.")}
      >
        <Textarea id="mail-body" rows={8} value={body} onChange={(event) => setBody(event.target.value)} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={pick(locale, "Кнопка (необязательно)", "Button (optional)")} htmlFor="mail-cta">
          <Input id="mail-cta" value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} placeholder={pick(locale, "Открыть курс", "Open the course")} />
        </Field>
        <Field label={pick(locale, "Ссылка кнопки", "Button link")} htmlFor="mail-url">
          <Input id="mail-url" value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} placeholder="/learn/ai-productivity-master" />
        </Field>
      </div>
      <Checkbox
        id="mail-news"
        checked={news}
        onChange={(event) => setNews(event.target.checked)}
        label={
          <span className="text-[13px]">
            {pick(locale, "Это рассылка (новости, акции): учитывать отписку и добавить ссылку «Отписаться»", "This is a newsletter (news, offers): honour opt-outs and add an unsubscribe link")}
          </span>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-[12.5px] text-muted">
          {smtpOn
            ? pick(locale, "Письма уходят пачками по 20 каждые 2 минуты.", "Letters go out 20 every two minutes.")
            : pick(locale, "SMTP не настроен: письма встанут в очередь и уйдут после настройки.", "SMTP is off: letters queue and go out once it is set up.")}
        </p>
        <Button type="submit" loading={busy === "send"} disabled={!subject.trim() || !body.trim() || (segment === "list" && !recipients.trim()) || (needsCourse && !courseId)}>
          <Send className="h-4 w-4" aria-hidden />
          {count ? pick(locale, `Отправить (${count.count})`, `Send (${count.count})`) : pick(locale, "Отправить", "Send")}
        </Button>
      </div>
    </form>
  );
}
