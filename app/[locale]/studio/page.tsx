import Link from "next/link";
import { StudioPage } from "@/components/studio/studio-shell";
import { Bars, RankedBars, Sparkline } from "@/components/studio/charts";
import { Cell, DataTable, Panel, QueueTile, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { canOpen, getRevenue, getStudioDashboard, queueCounts, visitSeries } from "@/lib/api/studio";
import { formatDate, formatNumber, formatPrice, path, type Locale } from "@/lib/i18n";

/** How many records fall in the last `days` days. */
function countSince(rows: { date: string }[], days: number) {
  const since = Date.now() - days * 86400000;
  return rows.filter((row) => new Date(row.date).getTime() >= since).length;
}

export default async function StudioPulsePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;

  const [dashboard, courses] = await Promise.all([getStudioDashboard(), getCourses(locale, { preview: true })]);
  if (!dashboard) return null;

  const counts = queueCounts(dashboard);
  const visits = visitSeries(dashboard);
  const money = canOpen(dashboard.role, "revenue") ? await getRevenue(30) : null;
  const revenue = money?.daily ?? [];

  const registrations = dashboard.registrations ?? [];
  const users = dashboard.users ?? [];
  const recentRegistrations = countSince(registrations, 30);
  const conversion = money && recentRegistrations ? (money.orders / recentRegistrations) * 100 : 0;
  const showQueues = canOpen(dashboard.role, "queue");

  const courseTitleById = new Map(courses.map((course) => [course.id, course.title]));
  const topCourses = Object.entries(dashboard.analytics?.courseClicks ?? {})
    .map(([id, value]) => ({ label: courseTitleById.get(id) ?? id, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const p = (href: string) => path(href, locale);

  return (
    <StudioPage
      title={pick(locale, "Пульс платформы", "Platform pulse")}
      body={pick(
        locale,
        "Что происходит сегодня и что ждёт вашего решения.",
        "What is happening today, and what is waiting on your decision.",
      )}
    >
      {/* ------------------------------- queues -------------------------------- */}
      {showQueues && (
      <section className="mb-8">
        <h2 className="eyebrow mb-3">{pick(locale, "Требует решения", "Needs a decision")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <QueueTile
            label={pick(locale, "Домашние задания", "Assignments")}
            count={counts.homework}
            href={p("/studio/queue?tab=homework")}
            note={pick(locale, "ждут проверки куратора", "waiting on a curator")}
          />
          <QueueTile
            label={pick(locale, "Заявки на «Найди своё в AI»", "Find Your Path in AI applications")}
            count={counts.applications}
            href={p("/studio/queue?tab=applications")}
            note={pick(locale, "ждут решения по набору", "waiting on an intake decision")}
          />
          <QueueTile
            label={pick(locale, "Отзывы", "Reviews")}
            count={counts.reviews}
            href={p("/studio/queue?tab=reviews")}
            note={pick(locale, "ждут модерации перед витриной", "waiting on moderation")}
          />
        </div>
      </section>
      )}

      {/* -------------------------------- stats -------------------------------- */}
      {money && (
      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={pick(locale, "Выручка · 30 дней", "Revenue · 30 days")}
          value={formatPrice(money.revenue, locale)}
          hint={`${money.orders} ${pick(locale, "оплат", "orders")}${money.refunds.count ? ` · ${money.refunds.count} ${pick(locale, "возвратов", "refunds")}` : ""}`}
        />
        <StatTile
          label={pick(locale, "Средний чек", "Average order")}
          value={formatPrice(money.averageOrder, locale)}
          hint={pick(locale, "выручка / оплаты за 30 дней", "revenue / orders, 30 days")}
        />
        <StatTile
          label={pick(locale, "Регистрации · 30 дней", "Sign-ups · 30 days")}
          value={formatNumber(recentRegistrations, locale)}
          hint={`${users.length} ${pick(locale, "аккаунтов в выборке", "accounts loaded")}`}
        />
        <StatTile
          label={pick(locale, "Конверсия в покупку", "Purchase conversion")}
          value={`${conversion.toFixed(1)}%`}
          tone={conversion >= 5 ? "good" : "neutral"}
          hint={pick(locale, "оплаты / регистрации за 30 дней", "orders / sign-ups, 30 days")}
        />
      </section>
      )}

      {/* -------------------------------- charts ------------------------------- */}
      <section className="mb-8 grid gap-3 lg:grid-cols-2">
        <Panel
          title={pick(locale, "Визиты", "Visits")}
          action={
            <span className="font-mono text-[12px] tabular-nums text-muted">
              {formatNumber(dashboard.analytics?.visits ?? 0, locale)}
            </span>
          }
        >
          <Sparkline
            points={visits}
            label={pick(locale, "Визиты по дням", "Daily visits")}
            locale={locale}
            format="number"
          />
        </Panel>

        {money && (
        <Panel
          title={pick(locale, "Выручка по дням", "Daily revenue")}
          action={<span className="font-mono text-[12px] tabular-nums text-muted">{formatPrice(money.revenue, locale)}</span>}
        >
          <Bars
            points={revenue}
            label={pick(locale, "Выручка по дням", "Daily revenue")}
            locale={locale}
            format="price"
          />
        </Panel>
        )}
      </section>

      {/* ------------------------------- activity ------------------------------ */}
      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {money ? (
        <Panel
          title={pick(locale, "Последние оплаты", "Latest payments")}
          action={<Link href={p("/studio/orders")} className="text-[12.5px] text-accent-ink underline-offset-4 hover:underline">{pick(locale, "Все заказы", "All orders")}</Link>}
        >
          <DataTable
            caption={pick(locale, "Последние оплаты", "Latest payments")}
            columns={[
              { key: "item", label: pick(locale, "Позиция", "Item") },
              { key: "email", label: "Email" },
              { key: "provider", label: pick(locale, "Через", "Via") },
              { key: "amount", label: pick(locale, "Сумма", "Amount"), align: "right" },
              { key: "date", label: pick(locale, "Дата", "Date"), align: "right" },
            ]}
            empty={pick(locale, "Оплат пока нет", "No payments yet")}
          >
            {money.recent.slice(0, 8).map((payment) => (
              <Row key={payment.id}>
                <Cell strong>{payment.itemTitle}</Cell>
                <Cell mono>{payment.email}</Cell>
                <Cell>
                  <Badge tone={payment.status === "refunded" ? "warning" : "outline"}>
                    {payment.provider}
                    {payment.status === "refunded" ? ` · ${pick(locale, "возврат", "refund")}` : ""}
                  </Badge>
                </Cell>
                <Cell align="right" mono>
                  {formatPrice(payment.amount, locale)}
                </Cell>
                <Cell align="right" mono>
                  {formatDate(payment.completedAt ?? payment.createdAt, locale, { day: "numeric", month: "short" })}
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>
        ) : (
          <div />
        )}

        <div className="flex flex-col gap-3">
          <Panel title={pick(locale, "Клики по курсам", "Course clicks")}>
            {topCourses.length ? (
              <RankedBars rows={topCourses} locale={locale} format="number" />
            ) : (
              <p className="text-[13px] text-muted">{pick(locale, "Данных пока нет", "No data yet")}</p>
            )}
          </Panel>

          {dashboard.webhookLog && dashboard.webhookLog.length > 0 && (
            <Panel title={pick(locale, "Вебхуки", "Webhooks")}>
              <ul className="flex flex-col gap-2">
                {dashboard.webhookLog.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-[12px] text-ink-2">{entry.event_name}</span>
                    <Badge tone={entry.status === "ok" ? "success" : entry.status === "ignored" ? "neutral" : "danger"}>{entry.status}</Badge>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </section>
    </StudioPage>
  );
}
