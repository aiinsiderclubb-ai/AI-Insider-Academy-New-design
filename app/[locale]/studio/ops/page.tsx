import { StudioPage } from "@/components/studio/studio-shell";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { FeatureFlagList } from "@/components/studio/ops-controls";
import { Badge } from "@/components/primitives/badge";
import { Note } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { API_ORIGIN } from "@/lib/api/http";
import { getAuditLog, getDataHealth, getFeatureFlagsAdmin, getStudioDashboard, type AuditEntry } from "@/lib/api/studio";
import { setFeatureFlag } from "@/lib/api/studio-actions";
import { formatRelative, getDictionary, type Locale } from "@/lib/i18n";

export default async function StudioOpsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [dashboard, flags, auditPayload, health] = await Promise.all([
    getStudioDashboard(),
    getFeatureFlagsAdmin(),
    getAuditLog(),
    getDataHealth(),
  ]);
  if (!dashboard) return null;

  const audit = (Array.isArray(auditPayload) ? auditPayload : (auditPayload.entries ?? [])) as AuditEntry[];
  const webhooks = dashboard.webhookLog ?? [];
  const failing = webhooks.filter((entry) => entry.status !== "ok").length;
  const healthRows = Object.entries(health ?? {});

  async function handleFlag(key: string, value: boolean) {
    "use server";
    return setFeatureFlag(locale, key, value);
  }

  return (
    <StudioPage
      title={pick(locale, "Инфраструктура", "Infrastructure")}
      body={pick(
        locale,
        "Флаги, журнал действий, здоровье данных и вебхуки платёжных провайдеров.",
        "Flags, the action log, data health and payment-provider webhooks.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="API" value={new URL(API_ORIGIN).host} hint={pick(locale, "источник данных", "data source")} />
        <StatTile label={pick(locale, "Флагов", "Flags")} value={Object.keys(flags).length} />
        <StatTile
          label={pick(locale, "Ошибки вебхуков", "Webhook failures")}
          value={failing}
          tone={failing > 0 ? "warning" : "good"}
        />
        <StatTile label={pick(locale, "Записей в журнале", "Audit entries")} value={audit.length} />
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-3">
          <Panel title={pick(locale, "Feature flags", "Feature flags")}>
            <FeatureFlagList locale={locale} d={d} flags={flags} onToggle={handleFlag} />
          </Panel>

          {healthRows.length > 0 && (
            <Panel title={pick(locale, "Здоровье данных", "Data health")}>
              <ul className="flex flex-col gap-2 text-[13px]">
                {healthRows.map(([key, value]) => (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[12px] text-ink-2">{key}</span>
                    <span className="font-mono text-[12.5px] tabular-nums text-ink">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {dashboard.settings && (
            <Panel title="Tribute">
              <ul className="flex flex-col gap-2 text-[13px]">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-ink-2">{pick(locale, "Подключён", "Enabled")}</span>
                  <Badge tone={dashboard.settings.tributeEnabled ? "success" : "neutral"}>
                    {String(dashboard.settings.tributeEnabled)}
                  </Badge>
                </li>
                <li className="flex flex-col gap-1">
                  <span className="text-ink-2">Webhook URL</span>
                  <code className="scroll-x rounded-md border border-line bg-surface-2 px-2.5 py-2 font-mono text-[11.5px] text-ink-3">
                    {dashboard.settings.tributeWebhookUrl}
                  </code>
                </li>
              </ul>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Panel title={pick(locale, "Журнал действий", "Audit log")}>
            <DataTable
              caption={pick(locale, "Журнал действий", "Audit log")}
              columns={[
                { key: "action", label: pick(locale, "Действие", "Action") },
                { key: "actor", label: pick(locale, "Кто", "Actor") },
                { key: "target", label: pick(locale, "Объект", "Target") },
                { key: "when", label: pick(locale, "Когда", "When"), align: "right" },
              ]}
              empty={pick(locale, "Записей нет", "No entries")}
            >
              {audit.slice(0, 30).map((entry) => (
                <Row key={entry.id}>
                  <Cell strong>{entry.action}</Cell>
                  <Cell mono>{entry.actor ?? "—"}</Cell>
                  <Cell mono>{entry.target ?? "—"}</Cell>
                  <Cell align="right" mono>
                    {entry.createdAt || entry.created_at
                      ? formatRelative((entry.createdAt ?? entry.created_at) as string, locale)
                      : "—"}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </Panel>

          <Panel title={pick(locale, "Вебхуки", "Webhooks")}>
            <DataTable
              caption={pick(locale, "Вебхуки", "Webhooks")}
              columns={[
                { key: "event", label: pick(locale, "Событие", "Event") },
                { key: "status", label: pick(locale, "Статус", "Status") },
                { key: "when", label: pick(locale, "Когда", "When"), align: "right" },
              ]}
              empty={pick(locale, "Событий нет", "No events")}
            >
              {webhooks.map((entry) => (
                <Row key={entry.id}>
                  <Cell mono strong>
                    {entry.event_name}
                  </Cell>
                  <Cell>
                    <Badge tone={entry.status === "ok" ? "success" : "danger"}>{entry.status}</Badge>
                  </Cell>
                  <Cell align="right" mono>
                    {formatRelative(entry.created_at, locale)}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </Panel>
        </div>
      </div>

      <Note tone="neutral" className="mt-6">
        {pick(
          locale,
          "Действия в Studio пишутся в audit log на стороне API — журнал доступен только роли admin.",
          "Studio actions are written to the API-side audit log, which only the admin role can read.",
        )}
      </Note>
    </StudioPage>
  );
}
