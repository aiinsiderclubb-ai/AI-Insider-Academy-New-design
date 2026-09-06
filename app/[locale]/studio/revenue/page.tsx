import { StudioPage } from "@/components/studio/studio-shell";
import { Bars, RankedBars } from "@/components/studio/charts";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { pick } from "@/content/locale";
import { getStudioDashboard, revenueSeries } from "@/lib/api/studio";
import { formatDate, formatNumber, formatPrice, type Locale } from "@/lib/i18n";

export default async function StudioRevenuePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;

  const purchases = dashboard.purchases ?? [];
  const series = revenueSeries(dashboard, 60);
  const total = purchases.reduce((sum, purchase) => sum + (Number(purchase.amount) || 0), 0);
  const referrals = dashboard.referrals ?? [];
  const discounts = Object.entries(dashboard.discounts ?? {});

  const byCourse = new Map<string, number>();
  for (const purchase of purchases) {
    const key = purchase.courseTitle || purchase.courseId;
    byCourse.set(key, (byCourse.get(key) ?? 0) + (Number(purchase.amount) || 0));
  }
  const topCourses = [...byCourse.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <StudioPage
      title={pick(locale, "Выручка", "Revenue")}
      body={pick(
        locale,
        "Оплаты, распределение по программам, рефералы и накопленные скидки.",
        "Payments, split by programme, referrals and accumulated discounts.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Всего оплат", "Payments")} value={formatNumber(purchases.length, locale)} />
        <StatTile label={pick(locale, "Сумма", "Total")} value={formatPrice(total, locale)} />
        <StatTile
          label={pick(locale, "Средний чек", "Average order")}
          value={formatPrice(purchases.length ? Math.round(total / purchases.length) : 0, locale)}
        />
        <StatTile label={pick(locale, "Рефералов", "Referrals")} value={formatNumber(referrals.length, locale)} />
      </section>

      <Panel title={pick(locale, "Выручка по дням", "Daily revenue")} className="mb-6">
        <Bars
          points={series}
          height={160}
          label={pick(locale, "Выручка по дням", "Daily revenue")}
          locale={locale}
          format="price"
        />
      </Panel>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title={pick(locale, "Оплаты", "Payments")}>
          <DataTable
            caption={pick(locale, "Оплаты", "Payments")}
            columns={[
              { key: "course", label: pick(locale, "Позиция", "Item") },
              { key: "email", label: "Email" },
              { key: "amount", label: pick(locale, "Сумма", "Amount"), align: "right" },
              { key: "date", label: pick(locale, "Дата", "Date"), align: "right" },
            ]}
            empty={pick(locale, "Оплат пока нет", "No payments yet")}
          >
            {purchases.slice(0, 50).map((purchase) => (
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
          <Panel title={pick(locale, "Топ программ", "Top programmes")}>
            {topCourses.length ? (
              <RankedBars rows={topCourses} locale={locale} format="price" />
            ) : (
              <p className="text-[13px] text-muted">{pick(locale, "Данных нет", "No data")}</p>
            )}
          </Panel>

          <Panel title={pick(locale, "Накопленные скидки", "Accumulated discounts")}>
            {discounts.length ? (
              <ul className="flex flex-col gap-2">
                {discounts.slice(0, 10).map(([email, percent]) => (
                  <li key={email} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-[12px] text-ink-2">{email}</span>
                    <span className="font-mono text-[12.5px] tabular-nums text-accent-ink">−{percent}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">{pick(locale, "Скидок нет", "No discounts")}</p>
            )}
          </Panel>
        </div>
      </div>
    </StudioPage>
  );
}
