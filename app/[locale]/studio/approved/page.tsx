import Link from "next/link";
import { StudioPage } from "@/components/studio/studio-shell";
import { NoAccess } from "@/components/studio/no-access";
import { SendMissingButton, SendWelcomeButton } from "@/components/studio/approved-controls";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { Note } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { canOpen, getApprovedPeople, getStudioDashboard, type LetterState } from "@/lib/api/studio";
import { formatDate, formatNumber, path, type Locale } from "@/lib/i18n";

const TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "accent"> = {
  sent: "success",
  pending: "accent",
  sending: "accent",
  failed: "danger",
  skipped: "neutral",
};

/** Everyone whose application was approved, and whether their letters reached them. */
export default async function StudioApprovedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const title = pick(locale, "Одобренные заявки", "Approved applications");

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "approved")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const { smtp, people } = await getApprovedPeople();
  const when = (value: string | null | undefined) =>
    value ? formatDate(value, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const label = (letter: LetterState | undefined) => {
    if (!letter) return pick(locale, "не создано", "none");
    switch (letter.status) {
      case "sent":
        return `${pick(locale, "ушло", "sent")} ${when(letter.sentAt)}`;
      case "pending":
      case "sending":
        return letter.sendAfter && Date.parse(letter.sendAfter) > Date.parse(new Date().toISOString())
          ? `${pick(locale, "уйдёт", "due")} ${when(letter.sendAfter)}`
          : pick(locale, "ждёт отправки", "waiting");
      case "failed":
        return pick(locale, "ошибка", "failed");
      case "skipped":
        return pick(locale, "не нужно", "skipped");
      default:
        return letter.status;
    }
  };
  const welcomeSent = people.filter((person) => person.letters.application_accepted?.status === "sent").length;
  const missing = people.length - welcomeSent;
  const giftSent = people.filter((person) => person.letters.todayfree_offer?.status === "sent").length;

  return (
    <StudioPage
      title={title}
      body={pick(
        locale,
        "Кого одобрили и дошли ли письма: об одобрении (сразу) и с подарком TODAYFREE (через 2 часа). Письмо можно отправить вручную.",
        "Who was approved and whether their letters arrived: the approval (at once) and the TODAYFREE gift (two hours later). A letter can be sent by hand.",
      )}
      action={<SendMissingButton locale={locale} count={missing} />}
    >
      {!smtp && (
        <Note tone="warning" className="mb-6">
          {pick(
            locale,
            "Почта (SMTP) на сервере не настроена: письма встают в очередь и не уходят. Настройте SMTP в окружении API.",
            "Mail (SMTP) is not configured on the server: letters queue and never leave. Set SMTP in the API environment.",
          )}
        </Note>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Одобрено", "Approved")} value={formatNumber(people.length, locale)} />
        <StatTile label={pick(locale, "Письмо об одобрении ушло", "Approval letter sent")} value={formatNumber(welcomeSent, locale)} tone={missing ? "warning" : "good"} />
        <StatTile label={pick(locale, "Не получили", "Not received")} value={formatNumber(missing, locale)} tone={missing ? "warning" : "good"} />
        <StatTile label={pick(locale, "Подарок TODAYFREE ушёл", "TODAYFREE gift sent")} value={formatNumber(giftSent, locale)} />
      </section>

      <Panel title={pick(locale, "Люди", "People")}>
        <DataTable
          caption={title}
          columns={[
            { key: "who", label: pick(locale, "Кто", "Who") },
            { key: "when", label: pick(locale, "Одобрен", "Approved") },
            { key: "welcome", label: pick(locale, "Письмо об одобрении", "Approval letter") },
            { key: "gift", label: pick(locale, "Письмо с подарком", "Gift letter") },
            { key: "actions", label: "", align: "right" },
          ]}
          empty={pick(locale, "Одобренных заявок пока нет", "No approved applications yet")}
        >
          {people.map((person) => {
            const welcome = person.letters.application_accepted;
            const gift = person.letters.todayfree_offer;
            const name = [person.firstName, person.lastName].filter(Boolean).join(" ") || person.name || "—";
            return (
              <Row key={person.id}>
                <Cell strong>
                  {person.userId ? (
                    <Link href={path(`/studio/learners/${person.userId}`, locale)} className="underline-offset-4 hover:underline">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                  <span className="block font-mono text-[12px] font-normal text-muted">{person.email}</span>
                </Cell>
                <Cell mono>{when(person.approvedAt) || "—"}</Cell>
                <Cell>
                  <Badge tone={welcome ? (TONE[welcome.status] ?? "neutral") : "warning"} title={welcome?.error ?? undefined}>
                    {label(welcome)}
                  </Badge>
                  {welcome?.error && welcome.status === "failed" && <span className="mt-1 block max-w-64 truncate text-[11.5px] text-danger">{welcome.error}</span>}
                </Cell>
                <Cell>
                  <Badge tone={gift ? (TONE[gift.status] ?? "neutral") : "neutral"} title={gift?.error ?? undefined}>
                    {label(gift)}
                  </Badge>
                </Cell>
                <Cell align="right">
                  <SendWelcomeButton locale={locale} id={person.id} again={welcome?.status === "sent"} />
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      </Panel>
    </StudioPage>
  );
}
