import type { Metadata } from "next";
import { CreditCard, Receipt } from "lucide-react";
import { AppPage } from "@/components/app/page-header";
import { Badge } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import { EmptyState, Note } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { planByTier } from "@/content/plans";
import { getCourses } from "@/lib/api/catalog";
import { getStoreCatalog } from "@/lib/api/store";
import { getAccess, getMe } from "@/lib/api/session";
import { formatDate, formatPrice, getDictionary, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [me, access, courses, catalog] = await Promise.all([
    getMe(),
    getAccess(),
    getCourses(locale),
    getStoreCatalog(locale),
  ]);
  if (!me) return null;

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const productById = new Map(catalog.products.map((product) => [product.id, product]));

  const orders = me.purchases.map((purchase) => {
    const course = courseById.get(purchase.id);
    const product = productById.get(purchase.id);
    return {
      id: purchase.id,
      title: course?.title ?? product?.title ?? purchase.id,
      kind: course ? d.nav.catalog : d.store.title,
      priceEur: course?.priceEur ?? product?.priceEur ?? 0,
      date: purchase.purchasedAt,
      href: course ? path(`/learn/${course.slug}`, locale) : product ? path(`/store/${product.slug}`, locale) : undefined,
    };
  });

  const plan = access.tier === "pro" ? planByTier("pro") : access.tier === "club" ? planByTier("club") : null;

  return (
    <AppPage
      eyebrow={d.app.orders}
      title={pick(locale, "Покупки и подписка", "Purchases and subscription")}
      body={pick(
        locale,
        "История заказов, активная подписка и накопленная скидка.",
        "Order history, your active subscription and any accumulated discount.",
      )}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-[17px]">
            <Receipt className="h-4 w-4 text-accent" aria-hidden />
            {pick(locale, "История заказов", "Order history")}
          </h2>

          {orders.length ? (
            <div className="scroll-x mt-4">
              <table className="w-full min-w-[30rem] text-[13.5px]">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2.5 text-left font-mono text-2xs tracking-[0.1em] text-muted uppercase">
                      {pick(locale, "Позиция", "Item")}
                    </th>
                    <th scope="col" className="py-2.5 text-left font-mono text-2xs tracking-[0.1em] text-muted uppercase">
                      {pick(locale, "Тип", "Type")}
                    </th>
                    <th scope="col" className="py-2.5 text-right font-mono text-2xs tracking-[0.1em] text-muted uppercase">
                      {d.checkout.total}
                    </th>
                    <th scope="col" className="py-2.5 text-right font-mono text-2xs tracking-[0.1em] text-muted uppercase">
                      {pick(locale, "Дата", "Date")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-line last:border-b-0">
                      <td className="py-3 pr-4">
                        {order.href ? (
                          <a href={order.href} className="font-medium text-ink underline-offset-4 hover:underline">
                            {order.title}
                          </a>
                        ) : (
                          <span className="font-medium text-ink">{order.title}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted">{order.kind}</td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums text-ink-2">
                        {formatPrice(order.priceEur, locale)}
                      </td>
                      <td className="py-3 text-right text-muted tabular-nums">{formatDate(order.date, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              compact
              className="mt-4"
              title={pick(locale, "Заказов пока нет", "No orders yet")}
              body={pick(
                locale,
                "Разовые покупки и товары Marketplace будут перечислены здесь с чеками.",
                "One-off purchases and marketplace items will be listed here with receipts.",
              )}
              action={
                <ButtonLink href={path("/learn", locale)} size="sm">
                  {d.nav.catalog}
                </ButtonLink>
              }
            />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 text-[15px]">
              <CreditCard className="h-4 w-4 text-accent" aria-hidden />
              {d.plans.title}
            </h2>
            {plan ? (
              <>
                <p className="mt-3 text-[15px] font-semibold text-ink">{locale === "en" ? plan.nameEn : plan.name}</p>
                <p className="mt-1 font-mono text-[14px] tabular-nums text-ink-2">
                  {formatPrice(plan.priceEur, locale)} {d.common.perMonth}
                </p>
                <Badge tone="success" className="mt-3">
                  {pick(locale, "активна", "active")}
                </Badge>
              </>
            ) : (
              <>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">{d.plans.body}</p>
                <ButtonLink href={path("/plans", locale)} variant="secondary" size="sm" className="mt-4" full>
                  {d.plans.compare}
                </ButtonLink>
              </>
            )}
          </div>

          {access.discountPercent > 0 && (
            <div className="rounded-lg border border-accent/35 bg-accent-soft p-5">
              <p className="eyebrow text-accent-ink">{d.checkout.discount}</p>
              <p className="mt-2 font-display text-[2rem] leading-none font-extrabold tabular-nums">
                −{access.discountPercent}%
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
                {pick(locale, "Скидка применяется автоматически при оплате.", "Applied automatically at checkout.")}
              </p>
            </div>
          )}
        </div>
      </div>

      {access.prelaunch && (
        <Note tone="warning" className="mt-8">
          {pick(
            locale,
            "В режиме предзапуска история покупок скрыта API до открытия продаж.",
            "While the platform is in prelaunch the API hides purchase history until sales open.",
          )}
        </Note>
      )}
    </AppPage>
  );
}
