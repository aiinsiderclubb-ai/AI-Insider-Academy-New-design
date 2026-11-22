import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { StudioPage } from "@/components/studio/studio-shell";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { Note } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { NoAccess } from "@/components/studio/no-access";
import { canOpen, getStoreStats, getStudioDashboard } from "@/lib/api/studio";
import { getStoreCatalog } from "@/lib/api/store";
import { getFeatureFlags } from "@/lib/api/public";
import { formatNumber, formatPrice, path, type Locale } from "@/lib/i18n";

export default async function StudioStorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;

  const title = pick(locale, "Магазин", "Store");
  const dashboard = await getStudioDashboard();
  if (!dashboard) return null;
  if (!canOpen(dashboard.role, "store")) return <NoAccess locale={locale} title={title} role={dashboard.role} />;

  const [catalog, flags, stats] = await Promise.all([getStoreCatalog(locale), getFeatureFlags(), getStoreStats()]);

  const available = catalog.products.filter((product) => product.available);
  const sold = (id: string) => stats.orders[id]?.count ?? 0;
  const storeRevenue = [...catalog.products, ...catalog.bundles].reduce((sum, item) => sum + (stats.orders[item.id]?.revenue ?? 0), 0);

  return (
    <StudioPage
      title={title}
      body={pick(
        locale,
        "Товары, цены, продажи и готовность витрины. Все товары — наши; продажи идут через Paddle.",
        "Products, prices, sales and how ready the storefront is. Every product is ours; sales go through Paddle.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Товаров", "Products")} value={formatNumber(catalog.products.length, locale)} />
        <StatTile
          label={pick(locale, "В продаже", "On sale")}
          value={formatNumber(available.length, locale)}
          tone={available.length === catalog.products.length ? "good" : "warning"}
          hint={`${catalog.products.length - available.length} ${pick(locale, "скоро", "coming soon")}`}
        />
        <StatTile label={pick(locale, "Наборов", "Bundles")} value={formatNumber(catalog.bundles.length, locale)} />
        <StatTile label={pick(locale, "Выручка магазина", "Store revenue")} value={formatPrice(storeRevenue, locale)} hint={pick(locale, "оплаченные заказы, за всё время", "paid orders, all time")} />
      </section>

      {!catalog.enabled && (
        <Note tone="warning" className="mb-6">
          {pick(
            locale,
            "Флаг marketplace выключен на стороне API: витрина работает из локального снимка каталога, оплата закрыта.",
            "The marketplace flag is off API-side: the storefront runs from the local catalogue snapshot and checkout is closed.",
          )}
        </Note>
      )}

      <Panel title={pick(locale, "Товары", "Products")} className="mb-6">
        <DataTable
          caption={pick(locale, "Товары магазина", "Store products")}
          columns={[
            { key: "title", label: pick(locale, "Товар", "Product") },
            { key: "category", label: pick(locale, "Категория", "Category") },
            { key: "price", label: pick(locale, "Цена", "Price"), align: "right" },
            { key: "licenses", label: pick(locale, "Лицензии", "Licences"), align: "right" },
            { key: "sold", label: pick(locale, "Продано", "Sold"), align: "right" },
            { key: "library", label: pick(locale, "В библиотеках", "In libraries"), align: "right" },
            { key: "state", label: pick(locale, "Статус", "State"), align: "right" },
            { key: "open", label: "", align: "right" },
          ]}
          empty={pick(locale, "Товаров нет", "No products")}
        >
          {catalog.products.map((product) => (
            <Row key={product.id}>
              <Cell strong>
                {product.title}
              </Cell>
              <Cell>{product.categoryLabel}</Cell>
              <Cell align="right" mono>
                {formatPrice(product.priceEur, locale)}
              </Cell>
              <Cell align="right" mono>
                {product.licenses.length}
              </Cell>
              <Cell align="right" mono>
                {sold(product.id)}
              </Cell>
              <Cell align="right" mono>
                {stats.grants[product.id] ?? 0}
              </Cell>
              <Cell align="right">
                <Badge tone={product.available ? "success" : "warning"}>
                  {product.available ? pick(locale, "в продаже", "on sale") : pick(locale, "скоро", "soon")}
                </Badge>
              </Cell>
              <Cell align="right">
                <Link
                  href={path(`/store/${product.slug}`, locale)}
                  className="inline-flex items-center gap-1 text-accent-ink hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Cell>
            </Row>
          ))}
        </DataTable>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={pick(locale, "Хранилища и наборы", "Vaults and bundles")}>
          <ul className="flex flex-col gap-2.5 text-[13.5px]">
            {catalog.bundles.map((bundle) => (
              <li key={bundle.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-ink-2">{bundle.title}</span>
                <span className="font-mono text-[12.5px] tabular-nums text-ink">
                  {formatPrice(bundle.priceEur, locale)} · {sold(bundle.id)} {pick(locale, "прод.", "sold")}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={pick(locale, "Здоровье витрины", "Storefront health")}>
          <ul className="flex flex-col gap-2.5 text-[13.5px]">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-2">{pick(locale, "Товары «скоро»", "Coming soon")}</span>
              <Badge tone={catalog.products.length - available.length ? "warning" : "success"}>{catalog.products.length - available.length}</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-2">{pick(locale, "Товары с отзывами", "Products with reviews")}</span>
              <Badge tone="neutral">{catalog.products.filter((product) => product.reviewCount > 0).length}</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-2">{pick(locale, "Флаг магазина (marketplace)", "Store flag (marketplace)")}</span>
              <Badge tone={flags.marketplace ? "success" : "danger"}>{String(flags.marketplace)}</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-2">{pick(locale, "Флаг vault", "Vault flag")}</span>
              <Badge tone={flags.vault ? "success" : "danger"}>{String(flags.vault)}</Badge>
            </li>
          </ul>
        </Panel>
      </div>
    </StudioPage>
  );
}
