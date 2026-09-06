import { StudioPage } from "@/components/studio/studio-shell";
import { MailConsole } from "@/components/studio/mail-console";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { pick } from "@/content/locale";
import { getEmailOverview } from "@/lib/api/studio";
import { formatNumber, type Locale } from "@/lib/i18n";

export default async function StudioMailPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const overview = await getEmailOverview();

  return (
    <StudioPage
      title={pick(locale, "Письма", "Mail")}
      body={pick(
        locale,
        "Единый шаблон, welcome-серия и сервисные письма. Маркетинг можно отписать, код и пароль — нет.",
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
