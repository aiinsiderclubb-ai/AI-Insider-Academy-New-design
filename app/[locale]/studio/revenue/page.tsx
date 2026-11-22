import Link from "next/link";
import { StudioPage } from "@/components/studio/studio-shell";
import { Bars, RankedBars } from "@/components/studio/charts";
import { NoAccess } from "@/components/studio/no-access";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { pick } from "@/content/locale";
import { canOpen, getRevenue, getStudioDashboard } from "@/lib/api/studio";
import { formatDate, formatNumber, formatPrice, path, type Locale } from "@/lib/i18n";

const WINDOWS = [7, 30, 90, 365];

export default async function StudioRevenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const title = pick(locale, "Выручка", "Revenue");

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "revenue")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const asked = Number((await searchParams).days);
  const days = WINDOWS.includes(asked) ? asked : 30;
  const money = await getRevenue(days);
  if (!money) return <StudioPage title={title}>{pick(locale, "API не ответил", "The API did not answer")}</StudioPage>;

  return (
    <StudioPage
      title={title}
      body={pick(
        locale,
        "Оплаченные заказы за выбранные календарные дни. Возвраты в выручку не входят и показаны отдельно.",
        "Paid orders over the chosen calendar days. Refunds are not revenue and are shown apart.",
      )}
      action={
        <nav className="flex gap-1.5" aria-label={pick(locale, "Период", "Period")}>
          {WINDOWS.map((value) => (
            <Link
              key={value}
              href={path(`/studio/revenue?days=${value}`, locale)}
              className={
                value === days
                  ? "rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-medium text-on-accent"
                  : "rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ink-2 hover:bg-surface-2"
              }
            >
              {value} {pick(locale, "дн.", "d")}
            </Link>
          ))}
        </nav>
      }
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Выручка", "Revenue")} value={formatPrice(money.revenue, locale)} />
        <StatTile label={pick(locale, "Оплат", "Orders")} value={formatNumber(money.orders, locale)} />
        <StatTile label={pick(locale, "Средний чек", "Average order")} value={formatPrice(money.averageOrder, locale)} />
        <StatTile
          label={pick(locale, "Возвраты", "Refunds")}
          value={formatPrice(money.refunds.amount, locale)}
          tone={money.refunds.count ? "warning" : "neutral"}
          hint={`${money.refunds.count} ${pick(locale, "заказов", "orders")}`}
        />
      </section>

      <Panel title={pick(locale, "Выручка по дням", "Daily revenue")} className="mb-6">
        <Bars points={money.daily} height={160} label={pick(locale, "Выручка по дням", "Daily revenue")} locale={locale} format="price" />
      </Panel>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          title={pick(locale, "Оплаты за период", "Payments in the period")}
          action={
            <Link href={path("/studio/orders", locale)} className="text-[12.5px] text-accent-ink underline-offset-4 hover:underline">
              {pick(locale, "Все заказы и фильтры", "All orders and filters")}
            </Link>
          }
        >
          <DataTable
            caption={pick(locale, "Оплаты", "Payments")}
            columns={[
              { key: "item", label: pick(locale, "Позиция", "Item") },
              { key: "email", label: "Email" },
              { key: "provider", label: pick(locale, "Через", "Via") },
              { key: "amount", label: pick(locale, "Сумма", "Amount"), align: "right" },
              { key: "date", label: pick(locale, "Дата", "Date"), align: "right" },
            ]}
            empty={pick(locale, "Оплат за период нет", "No payments in this period")}
          >
            {money.recent.map((payment) => (
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

        <div className="flex flex-col gap-3">
          <Panel title={pick(locale, "По провайдерам", "By provider")}>
            {money.byProvider.length ? (
              <RankedBars rows={money.byProvider.map((row) => ({ label: `${row.provider} · ${row.orders}`, value: row.revenue }))} locale={locale} format="price" />
            ) : (
              <p className="text-[13px] text-muted">{pick(locale, "Данных нет", "No data")}</p>
            )}
          </Panel>
          <Panel title={pick(locale, "Что покупают", "What sells")}>
            {money.byItem.length ? (
              <RankedBars rows={money.byItem} locale={locale} format="price" />
            ) : (
              <p className="text-[13px] text-muted">{pick(locale, "Данных нет", "No data")}</p>
            )}
          </Panel>
        </div>
      </div>
    </StudioPage>
  );
}
