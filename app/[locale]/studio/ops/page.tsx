import { StudioPage } from "@/components/studio/studio-shell";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { FeatureFlagList } from "@/components/studio/ops-controls";
import { NoAccess } from "@/components/studio/no-access";
import { Badge } from "@/components/primitives/badge";
import { Note } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { API_ORIGIN } from "@/lib/api/http";
import { canOpen, getAuditLog, getDataHealth, getFeatureFlagsAdmin, getPaddleStatus, getStudioDashboard, type AuditEntry } from "@/lib/api/studio";
import { setFeatureFlag } from "@/lib/api/studio-actions";
import { formatRelative, getDictionary, type Locale } from "@/lib/i18n";

function healthValue(value: unknown) {
  return value && typeof value === "object"
    ? Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")
    : String(value);
}

export default async function StudioOpsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const title = pick(locale, "Инфраструктура", "Infrastructure");
  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "ops")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const [flags, auditPayload, health, paddle] = await Promise.all([
    getFeatureFlagsAdmin(),
    getAuditLog(),
    getDataHealth(),
    getPaddleStatus(),
  ]);

  const audit = (Array.isArray(auditPayload) ? auditPayload : (auditPayload.entries ?? [])) as AuditEntry[];
  const webhooks = dashboard.webhookLog ?? [];
  const failing = webhooks.filter((entry) => entry.status === "error").length;
  const healthLabels: Record<string, string> = {
    db: pick(locale, "База данных", "Database"),
    users: pick(locale, "Аккаунтов", "Accounts"),
    registrations: pick(locale, "Регистраций", "Registrations"),
    withPersonalId: pick(locale, "С личным ID", "With a personal ID"),
    telegramLinked: pick(locale, "Привязан Telegram", "Telegram linked"),
    homework: pick(locale, "Домашних заданий", "Assignments"),
    reviews: pick(locale, "Отзывы", "Reviews"),
    purchases: pick(locale, "Записей в старом логе покупок", "Legacy purchase log rows"),
    certificates: pick(locale, "Сертификатов", "Certificates"),
    referrals: pick(locale, "Рефералов", "Referrals"),
    applications: pick(locale, "Заявок", "Applications"),
    supportMessages: pick(locale, "Сообщений в поддержку", "Support messages"),
    passwordChanges: pick(locale, "Меняли пароль", "Changed password"),
  };
  const healthRows = Object.entries(health ?? {}).filter(([key]) => key !== "ok" && key !== "note");

  async function handleFlag(key: string, value: boolean) {
    "use server";
    return setFeatureFlag(locale, key, value);
  }

  return (
    <StudioPage
      title={title}
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
                    <span className="text-[13px] text-ink-2">{healthLabels[key] ?? key}</span>
                    <span className="font-mono text-[12.5px] tabular-nums text-ink">{healthValue(value)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {paddle && (
            <Panel title="Paddle">
              <ul className="flex flex-col gap-2 text-[13px]">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-ink-2">{pick(locale, "Ключ API", "API key")}</span>
                  <Badge tone={paddle.enabled ? "success" : "warning"}>
                    {paddle.enabled ? pick(locale, "задан", "set") : pick(locale, "не задан", "missing")}
                  </Badge>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-ink-2">{pick(locale, "Окружение", "Environment")}</span>
                  <Badge tone={paddle.environment === "production" ? "accent" : "neutral"}>{paddle.environment}</Badge>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-ink-2">{pick(locale, "Секрет вебхука", "Webhook secret")}</span>
                  <Badge tone={paddle.webhookSecretSet ? "success" : "warning"}>
                    {paddle.webhookSecretSet ? pick(locale, "задан", "set") : pick(locale, "не задан", "missing")}
                  </Badge>
                </li>
                <li className="flex flex-col gap-1">
                  <span className="text-ink-2">Webhook URL</span>
                  <code className="scroll-x rounded-md border border-line bg-surface-2 px-2.5 py-2 font-mono text-[11.5px] text-ink-3">
                    {paddle.webhookUrl}
                  </code>
                </li>
              </ul>
              <p className="mt-4 eyebrow">{pick(locale, "Последние события Paddle", "Latest Paddle events")}</p>
              {paddle.events.length ? (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {paddle.events.slice(0, 8).map((event) => (
                    <li key={event.id} className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="min-w-0 truncate font-mono text-ink-2">{event.event}</span>
                      <span className="flex items-center gap-2">
                        <Badge tone={event.status === "ok" ? "success" : event.status === "ignored" ? "neutral" : "danger"}>{event.status}</Badge>
                        <span className="font-mono text-muted">{formatRelative(event.createdAt, locale)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12.5px] text-muted">{pick(locale, "Событий пока не было", "No events yet")}</p>
              )}
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
                  <Cell mono>{entry.actorEmail ?? "—"}</Cell>
                  <Cell mono>{[entry.targetType, entry.targetId].filter(Boolean).join(" · ") || "—"}</Cell>
                  <Cell align="right" mono>
                    {entry.createdAt ? formatRelative(entry.createdAt, locale) : "—"}
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
                    <Badge tone={entry.status === "ok" ? "success" : entry.status === "ignored" ? "neutral" : "danger"}>{entry.status}</Badge>
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
