import { StudioPage } from "@/components/studio/studio-shell";
import { Bars, RankedBars, Sparkline } from "@/components/studio/charts";
import { Cell, DataTable, Panel, QueueTile, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { getStudioDashboard, queueCounts, revenueSeries, visitSeries } from "@/lib/api/studio";
import { formatDate, formatNumber, formatPrice, path, type Locale } from "@/lib/i18n";

export default async function StudioPulsePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;

  const [dashboard, courses] = await Promise.all([getStudioDashboard(), getCourses(locale)]);
  if (!dashboard) return null;

  const counts = queueCounts(dashboard);
  const visits = visitSeries(dashboard);
  const revenue = revenueSeries(dashboard);

  const purchases = dashboard.purchases ?? [];
  const registrations = dashboard.registrations ?? [];
  const users = dashboard.users ?? [];

  const revenue30 = revenue.reduce((sum, point) => sum + point.value, 0);
  const averageOrder = purchases.length ? revenue30 / purchases.length : 0;
  const conversion = registrations.length ? (purchases.length / registrations.length) * 100 : 0;

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
            label={pick(locale, "Заявки Accelerator", "Accelerator applications")}
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

      {/* -------------------------------- stats -------------------------------- */}
      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={pick(locale, "Выручка · 30 дней", "Revenue · 30 days")}
          value={formatPrice(revenue30, locale)}
          hint={`${purchases.length} ${pick(locale, "покупок", "purchases")}`}
        />
        <StatTile
          label={pick(locale, "Средний чек", "Average order")}
          value={formatPrice(Math.round(averageOrder), locale)}
          hint={pick(locale, "по логу покупок", "from the purchase log")}
        />
        <StatTile
          label={pick(locale, "Регистрации", "Registrations")}
          value={formatNumber(registrations.length, locale)}
          hint={`${users.length} ${pick(locale, "аккаунтов всего", "accounts total")}`}
        />
        <StatTile
          label={pick(locale, "Конверсия в покупку", "Purchase conversion")}
          value={`${conversion.toFixed(1)}%`}
          tone={conversion >= 5 ? "good" : "neutral"}
          hint={pick(locale, "покупки / регистрации", "purchases / registrations")}
        />
      </section>

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

        <Panel
          title={pick(locale, "Выручка по дням", "Daily revenue")}
          action={<span className="font-mono text-[12px] tabular-nums text-muted">{formatPrice(revenue30, locale)}</span>}
        >
          <Bars
            points={revenue}
            label={pick(locale, "Выручка по дням", "Daily revenue")}
            locale={locale}
            format="price"
          />
        </Panel>
      </section>

      {/* ------------------------------- activity ------------------------------ */}
      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title={pick(locale, "Последние покупки", "Latest purchases")}>
          <DataTable
            caption={pick(locale, "Последние покупки", "Latest purchases")}
            columns={[
              { key: "course", label: pick(locale, "Курс", "Course") },
              { key: "email", label: "Email" },
              { key: "amount", label: pick(locale, "Сумма", "Amount"), align: "right" },
              { key: "date", label: pick(locale, "Дата", "Date"), align: "right" },
            ]}
            empty={pick(locale, "Покупок пока нет", "No purchases yet")}
          >
            {purchases.slice(0, 8).map((purchase) => (
              <Row key={purchase.id}>
                <Cell strong>{purchase.courseTitle || purchase.courseId}</Cell>
                <Cell mono>{purchase.email}</Cell>
                <Cell align="right" mono>
                  {formatPrice(Number(purchase.amount) || 0, locale)}
                </Cell>
                <Cell align="right" mono>
                  {formatDate(purchase.date, locale, { day: "numeric", month: "short" })}
                </Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>

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
                    <Badge tone={entry.status === "ok" ? "success" : "danger"}>{entry.status}</Badge>
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
