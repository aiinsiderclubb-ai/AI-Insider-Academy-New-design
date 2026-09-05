import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { StudioPage } from "@/components/studio/studio-shell";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { Note } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { creatorList, revenueShare } from "@/content/site";
import { getStoreCatalog } from "@/lib/api/store";
import { getFeatureFlags } from "@/lib/api/public";
import { formatNumber, formatPrice, path, type Locale } from "@/lib/i18n";

export default async function StudioStorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;

  const [catalog, flags] = await Promise.all([getStoreCatalog(locale), getFeatureFlags()]);

  const available = catalog.products.filter((product) => product.available);
  const rated = catalog.products.filter((product) => product.rating !== null);
  const withoutCover = catalog.products.filter((product) => !product.cover.image);

  return (
    <StudioPage
      title="Marketplace"
      body={pick(
        locale,
        "Товары, лицензии, креаторы и готовность витрины к продажам.",
        "Products, licences, creators and how ready the storefront is to sell.",
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
        <StatTile
          label={pick(locale, "Доля креатора", "Creator share")}
          value={`${Math.round(revenueShare.creator * 100)}%`}
        />
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
          caption={pick(locale, "Товары Marketplace", "Marketplace products")}
          columns={[
            { key: "title", label: pick(locale, "Товар", "Product") },
            { key: "category", label: pick(locale, "Категория", "Category") },
            { key: "price", label: pick(locale, "Цена", "Price"), align: "right" },
            { key: "licenses", label: pick(locale, "Лицензии", "Licences"), align: "right" },
            { key: "rating", label: pick(locale, "Рейтинг", "Rating"), align: "right" },
            { key: "state", label: pick(locale, "Статус", "State"), align: "right" },
            { key: "open", label: "", align: "right" },
          ]}
          empty={pick(locale, "Товаров нет", "No products")}
        >
          {catalog.products.map((product) => (
            <Row key={product.id}>
              <Cell strong>
                <span className="flex flex-wrap items-center gap-2">
                  {product.title}
                  {!product.cover.image && <Badge tone="neutral">{pick(locale, "нет обложки", "no cover")}</Badge>}
                </span>
              </Cell>
              <Cell>{product.categoryLabel}</Cell>
              <Cell align="right" mono>
                {formatPrice(product.priceEur, locale)}
              </Cell>
              <Cell align="right" mono>
                {product.licenses.length}
              </Cell>
              <Cell align="right" mono>
                {product.rating !== null ? product.rating.toFixed(1) : "—"}
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
        <Panel title={pick(locale, "Креаторы", "Creators")}>
          <ul className="flex flex-col gap-3">
            {creatorList.map((creator) => (
              <li key={creator.id} className="flex items-center gap-3">
                <span
                  className="h-8 w-8 shrink-0 rounded-full border border-line"
                  style={{ background: creator.avatarGradient }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{creator.name}</span>
                  <span className="block font-mono text-[11.5px] text-muted">
                    {catalog.products.filter((product) => product.creator?.id === creator.id).length}{" "}
                    {pick(locale, "товаров", "products")}
                  </span>
                </span>
                {creator.verified && <Badge tone="success">verified</Badge>}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={pick(locale, "Здоровье витрины", "Storefront health")}>
          <ul className="flex flex-col gap-2.5 text-[13.5px]">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-2">{pick(locale, "Товары без обложки", "Products without a cover")}</span>
              <Badge tone={withoutCover.length ? "warning" : "success"}>{withoutCover.length}</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-2">{pick(locale, "Товары без рейтинга", "Products without a rating")}</span>
              <Badge tone="neutral">{catalog.products.length - rated.length}</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-2">{pick(locale, "Флаг marketplace", "Marketplace flag")}</span>
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
