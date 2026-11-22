import Link from "next/link";
import { StudioPage } from "@/components/studio/studio-shell";
import { NoAccess } from "@/components/studio/no-access";
import { SupportReplyForm } from "@/components/studio/people-controls";
import { StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { pick } from "@/content/locale";
import { canOpen, getStudioDashboard, getSupportInbox } from "@/lib/api/studio";
import { replySupport } from "@/lib/api/studio-actions";
import { formatNumber, formatRelative, getDictionary, path, type Locale } from "@/lib/i18n";

export default async function StudioSupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);
  const title = pick(locale, "Поддержка", "Support");

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "support")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const { messages } = await getSupportInbox();
  const open = messages.filter((message) => message.status !== "answered");
  const ordered = [...open, ...messages.filter((message) => message.status === "answered")];

  async function handleReply(id: string, reply: string) {
    "use server";
    return replySupport(locale, id, reply);
  }

  return (
    <StudioPage
      title={title}
      body={pick(
        locale,
        "Сообщения из раздела «Поддержка» в кабинете. Ответ появляется у человека в кабинете и в уведомлениях.",
        "Messages from Support in the learner's account. A reply shows up in their account and notifications.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile label={pick(locale, "Ждут ответа", "Waiting")} value={formatNumber(open.length, locale)} tone={open.length ? "warning" : "good"} />
        <StatTile label={pick(locale, "Отвечено", "Answered")} value={formatNumber(messages.length - open.length, locale)} />
        <StatTile label={pick(locale, "Всего", "Total")} value={formatNumber(messages.length, locale)} />
      </section>

      {ordered.length ? (
        <ul className="flex flex-col gap-3">
          {ordered.map((message) => (
            <li key={message.id} className="rounded-lg border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="min-w-0 text-[13.5px]">
                  <span className="font-semibold text-ink">{message.name || message.email}</span>{" "}
                  {message.userId ? (
                    <Link href={path(`/studio/learners/${message.userId}`, locale)} className="font-mono text-[12px] text-muted underline-offset-4 hover:underline">
                      {message.email}
                    </Link>
                  ) : (
                    <span className="font-mono text-[12px] text-muted">{message.email}</span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={message.status === "answered" ? "success" : "warning"}>
                    {message.status === "answered" ? pick(locale, "отвечено", "answered") : pick(locale, "ждёт", "waiting")}
                  </Badge>
                  <span className="font-mono text-[12px] text-muted">{formatRelative(message.date, locale)}</span>
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-2">{message.message}</p>
              <SupportReplyForm locale={locale} d={d} existing={message.reply} onReply={handleReply.bind(null, message.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-muted">{pick(locale, "Сообщений пока нет", "No messages yet")}</p>
      )}
    </StudioPage>
  );
}
