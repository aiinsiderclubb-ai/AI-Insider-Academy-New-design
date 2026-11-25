import Link from "next/link";
import { StudioPage } from "@/components/studio/studio-shell";
import { NoAccess } from "@/components/studio/no-access";
import { RevokeOrderButton } from "@/components/studio/people-controls";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Field, Input, Select } from "@/components/primitives/field";
import { pick } from "@/content/locale";
import { canOpen, getOrders, getStudioDashboard } from "@/lib/api/studio";
import { revokeOrder } from "@/lib/api/studio-actions";
import { formatDate, formatNumber, formatPrice, getDictionary, path, type Locale } from "@/lib/i18n";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  completed: "success",
  refunded: "warning",
  pending: "neutral",
  failed: "danger",
};

export default async function StudioOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ provider?: string; status?: string; from?: string; to?: string; q?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);
  const title = pick(locale, "Заказы", "Orders");

  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "orders")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const filters = await searchParams;
  const { orders, providers } = await getOrders(filters);
  const completed = orders.filter((order) => order.status === "completed");
  const statusLabel: Record<string, string> = {
    completed: pick(locale, "оплачен", "paid"),
    refunded: pick(locale, "возврат", "refunded"),
    pending: pick(locale, "не оплачен", "unpaid"),
    failed: pick(locale, "ошибка", "failed"),
  };

  async function handleRevoke(paymentId: string, reason: string) {
    "use server";
    return revokeOrder(locale, paymentId, reason);
  }

  return (
    <StudioPage
      title={title}
      body={pick(
        locale,
        "Все оплаты с любого провайдера. «Забрать доступ» отзывает выданное; деньги возвращаются в кабинете провайдера (Gumroad).",
        "Every payment from any provider. “Revoke” takes back what was granted; money is refunded in the provider dashboard (Gumroad).",
      )}
    >
      <form className="mb-6 grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
        <Field label={pick(locale, "Email, товар или ID", "Email, item or ID")} htmlFor="q">
          <Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="anna@…" />
        </Field>
        <Field label={pick(locale, "Провайдер", "Provider")} htmlFor="provider">
          <Select id="provider" name="provider" defaultValue={filters.provider ?? ""}>
            <option value="">{pick(locale, "Все", "All")}</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={pick(locale, "Статус", "Status")} htmlFor="status">
          <Select id="status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">{pick(locale, "Все", "All")}</option>
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={pick(locale, "С", "From")} htmlFor="from">
          <Input id="from" name="from" type="date" defaultValue={filters.from ?? ""} />
        </Field>
        <Field label={pick(locale, "По", "To")} htmlFor="to">
          <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} />
        </Field>
        <div className="flex gap-2">
          <Button type="submit">{pick(locale, "Показать", "Show")}</Button>
          <Link href={path("/studio/orders", locale)} className="self-center text-[12.5px] text-muted hover:text-ink">
            {pick(locale, "Сбросить", "Reset")}
          </Link>
        </div>
      </form>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile label={pick(locale, "Найдено", "Found")} value={formatNumber(orders.length, locale)} />
        <StatTile label={pick(locale, "Оплачено", "Paid")} value={formatNumber(completed.length, locale)} />
        <StatTile
          label={pick(locale, "Сумма оплаченных", "Paid total")}
          value={formatPrice(completed.reduce((sum, order) => sum + order.amount, 0), locale)}
        />
      </section>

      <Panel title={pick(locale, "Список", "List")}>
        <DataTable
          caption={title}
          columns={[
            { key: "date", label: pick(locale, "Дата", "Date") },
            { key: "item", label: pick(locale, "Позиция", "Item") },
            { key: "buyer", label: pick(locale, "Покупатель", "Buyer") },
            { key: "provider", label: pick(locale, "Через", "Via") },
            { key: "status", label: pick(locale, "Статус", "Status") },
            { key: "granted", label: pick(locale, "Выдано", "Granted") },
            { key: "amount", label: pick(locale, "Сумма", "Amount"), align: "right" },
            { key: "actions", label: "", align: "right" },
          ]}
          empty={pick(locale, "Заказов нет", "No orders")}
        >
          {orders.map((order) => {
            const granted = [
              ...order.granted.courses,
              ...order.granted.products.filter((item) => item.status === "active").map((item) => item.productId),
            ];
            return (
              <Row key={order.id}>
                <Cell mono>{formatDate(order.completedAt ?? order.createdAt, locale, { day: "numeric", month: "short", year: "2-digit" })}</Cell>
                <Cell strong>
                  {order.itemTitle}
                  {order.licenseTier ? <span className="ml-1.5 font-mono text-[11px] text-muted">{order.licenseTier}</span> : null}
                  {order.plan === "mentor" && <Badge tone="accent" className="ml-1.5">{pick(locale, "с ментором", "mentor")}</Badge>}
                  {order.plan === "self" && <Badge tone="outline" className="ml-1.5">{pick(locale, "самостоятельно", "self-study")}</Badge>}
                </Cell>
                <Cell mono>
                  {order.userId ? (
                    <Link href={path(`/studio/learners/${order.userId}`, locale)} className="underline-offset-4 hover:underline">
                      {order.email}
                    </Link>
                  ) : (
                    order.email
                  )}
                </Cell>
                <Cell>
                  <Badge tone="outline">{order.provider}</Badge>
                </Cell>
                <Cell>
                  <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>{statusLabel[order.status] ?? order.status}</Badge>
                </Cell>
                <Cell>
                  <span className="text-[12px] text-ink-3" title={granted.join(", ")}>
                    {granted.length ? `${granted.length} ${pick(locale, "поз.", "items")}` : "—"}
                  </span>
                </Cell>
                <Cell align="right" mono>
                  {formatPrice(order.amount, locale)}
                </Cell>
                <Cell align="right">
                  {order.status === "completed" ? (
                    <RevokeOrderButton locale={locale} d={d} paymentId={order.id} label={order.itemTitle} onRevoke={handleRevoke} />
                  ) : null}
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      </Panel>
    </StudioPage>
  );
}
