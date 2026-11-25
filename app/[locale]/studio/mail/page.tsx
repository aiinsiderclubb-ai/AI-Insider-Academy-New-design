import { StudioPage } from "@/components/studio/studio-shell";
import { MailConsole } from "@/components/studio/mail-console";
import { ComposeMail } from "@/components/studio/compose-mail";
import { Badge } from "@/components/primitives/badge";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { getEmailOverview, getSentLetters, getStudioDashboard } from "@/lib/api/studio";
import { formatDate, formatNumber, type Locale } from "@/lib/i18n";

export default async function StudioMailPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dashboard = await getStudioDashboard();
  const isAdmin = dashboard?.role === "admin";
  const [overview, sent, courses] = await Promise.all([
    getEmailOverview(),
    isAdmin ? getSentLetters() : Promise.resolve({ letters: [] }),
    isAdmin ? getCourses(locale, { preview: true }) : Promise.resolve([]),
  ]);
  const paidCourses = courses.filter((course) => course.priceEur > 0).map((course) => ({ id: course.id, title: course.title }));
  const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = { sent: "success", pending: "neutral", failed: "danger", skipped: "warning" };

  return (
    <StudioPage
      title={pick(locale, "Письма", "Mail")}
      body={pick(
        locale,
        "Написать письмо людям вручную, превью шаблонов и очередь. Маркетинг можно отписать, код и пароль — нет.",
        "One template, the welcome series, and transactional mail. Marketing can be opted out; codes and passwords cannot.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label={pick(locale, "В очереди", "Queued")} value={formatNumber(overview?.counts.pending ?? 0, locale)} />
        <StatTile label={pick(locale, "Отправлено", "Sent")} value={formatNumber(overview?.counts.sent ?? 0, locale)} tone="good" />
        <StatTile
          label={pick(locale, "Пропущено", "Skipped")}
          value={formatNumber(overview?.counts.skipped ?? 0, locale)}
          hint={pick(locale, "стоп-условия", "stop rules")}
        />
        <StatTile
          label={pick(locale, "Ошибки", "Failed")}
          value={formatNumber(overview?.counts.failed ?? 0, locale)}
          tone={(overview?.counts.failed ?? 0) > 0 ? "warning" : "neutral"}
        />
        <StatTile label={pick(locale, "Отписки", "Unsubscribed")} value={formatNumber(overview?.counts.unsubscribed ?? 0, locale)} />
      </section>

      {isAdmin && (
        <div className="mb-6 grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel title={pick(locale, "Написать письмо", "Write a letter")}>
            <ComposeMail locale={locale} courses={paidCourses} smtpOn={Boolean(overview?.enabled)} />
          </Panel>
          <Panel title={pick(locale, "Отправленные вручную", "Sent by hand")}>
            <DataTable
              caption={pick(locale, "Письма из Studio", "Letters from the Studio")}
              columns={[
                { key: "when", label: pick(locale, "Когда", "When") },
                { key: "to", label: pick(locale, "Кому", "To") },
                { key: "subject", label: pick(locale, "Тема", "Subject") },
                { key: "status", label: pick(locale, "Статус", "Status"), align: "right" },
              ]}
              empty={pick(locale, "Пока ничего не отправляли", "Nothing sent yet")}
            >
              {sent.letters.slice(0, 50).map((letter) => (
                <Row key={letter.id}>
                  <Cell mono>{formatDate(letter.createdAt, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Cell>
                  <Cell mono>{letter.email}</Cell>
                  <Cell>{letter.template === "personal_promo" ? `${pick(locale, "промокод", "promo code")} ${letter.subject}` : letter.subject}</Cell>
                  <Cell align="right">
                    <Badge tone={STATUS_TONE[letter.status] ?? "neutral"}>{letter.status}</Badge>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </Panel>
        </div>
      )}

      <div className="mb-6">
        <Panel title={pick(locale, "Превью и тест", "Preview and test")}>
          <MailConsole locale={locale} templates={overview?.templates ?? []} smtpOn={Boolean(overview?.enabled)} />
        </Panel>
      </div>

      <Panel title={pick(locale, "Последние письма", "Recent mail")}>
        <DataTable
          caption={pick(locale, "Очередь писем", "Mail queue")}
          empty={pick(locale, "Очередь пустая — письма появятся после регистрации.", "Queue is empty — mail appears after sign-up.")}
          columns={[
            { key: "template", label: pick(locale, "Шаблон", "Template") },
            { key: "email", label: "Email" },
            { key: "status", label: pick(locale, "Статус", "Status") },
            { key: "meta", label: pick(locale, "Детали", "Detail") },
          ]}
        >
          {(overview?.recent ?? []).map((row) => (
            <Row key={row.id}>
              <Cell mono>{row.template}</Cell>
              <Cell>{row.email}</Cell>
              <Cell>{row.status}</Cell>
              <Cell>{row.error || row.sent_at || row.send_after || "—"}</Cell>
            </Row>
          ))}
        </DataTable>
      </Panel>
    </StudioPage>
  );
}
