import "server-only";
import { categoryById, fallbackProducts, storeCategories } from "@/content/store";
import { creatorById, revenueShare } from "@/content/site";
import { pick, suffixed, suffixedList } from "@/content/locale";
import type { Locale } from "@/lib/i18n/config";
import { tryApi } from "./http";
import type { ApiBundle, ApiCatalog, ApiLicense, ApiProduct, LicenseId } from "./types";

export interface ProductLicense {
  id: LicenseId;
  label: string;
  note: string;
  priceEur: number;
  clientLimit: number | null;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  summary: string;
  categoryId: string;
  categoryLabel: string;
  categorySlug: string;
  productType: string;
  priceEur: number;
  licenses: ProductLicense[];
  cover: { gradient: string | null; icon: string | null; image: string | null; accent: string };
  creator: { id: string; name: string; slug: string; verified: boolean; gradient: string } | null;
  rating: number | null;
  reviewCount: number;
  badges: string[];
  included: string[];
  fileTypes: string[];
  faq: { q: string; a: string }[];
  freePreview: { title: string; content: string; type: string } | null;
  relatedIds: string[];
  recommendsForCourses: string[];
  /** `false` when the item is announced but not yet on sale. */
  available: boolean;
  outcome: string;
  setupTime: string;
  priceModel: string;
}

export interface Bundle extends ApiBundle {
  products: Product[];
  fullPriceEur: number;
  savingEur: number;
}

export interface StoreCatalog {
  /** Mirrors the marketplace feature flag; drives the "opening later" state. */
  enabled: boolean;
  products: Product[];
  bundles: Bundle[];
}

const LICENSE_LABELS: Record<LicenseId, { ru: string; en: string; noteRu: string; noteEn: string }> = {
  personal: { ru: "Personal", en: "Personal", noteRu: "Для себя и своих проектов", noteEn: "For yourself and your own projects" },
  client: { ru: "Client", en: "Client", noteRu: "Внедрение до 5 клиентам", noteEn: "Deploy for up to 5 clients" },
  agency: { ru: "Agency", en: "Agency", noteRu: "Без лимита клиентов", noteEn: "Unlimited clients" },
};

function toLicenses(raw: ApiLicense[] | undefined, basePrice: number, locale: Locale): ProductLicense[] {
  const source = raw?.length
    ? raw
    : ([{ id: "personal", priceEur: basePrice, rights: "personal", clientLimit: 1 }] as ApiLicense[]);

  return source.map((license) => {
    const labels = LICENSE_LABELS[license.id] ?? LICENSE_LABELS.personal;
    return {
      id: license.id,
      label: pick(locale, labels.ru, labels.en),
      note: pick(locale, labels.noteRu, labels.noteEn),
      priceEur: license.priceEur,
      clientLimit: license.clientLimit,
    };
  });
}

function toProduct(raw: ApiProduct, locale: Locale): Product {
  const category = categoryById(raw.categoryId);
  const creator = creatorById(raw.creatorId);
  const preview = raw.freePreview;

  return {
    id: raw.id,
    slug: raw.slug,
    title: suffixed(raw as unknown as Record<string, unknown>, "title", locale),
    summary: suffixed(raw as unknown as Record<string, unknown>, "short", locale),
    categoryId: raw.categoryId,
    categoryLabel: category ? pick(locale, category.titleRu, category.titleEn) : raw.categoryId,
    categorySlug: category?.slug ?? raw.categoryId,
    productType: raw.productType,
    priceEur: raw.priceEur,
    licenses: toLicenses(raw.licenses, raw.priceEur, locale),
    cover: {
      gradient: raw.coverGradient,
      icon: raw.coverIcon,
      image: raw.coverImage,
      accent: category?.accent ?? "var(--accent)",
    },
    creator: creator
      ? { id: creator.id, name: creator.name, slug: creator.slug, verified: creator.verified, gradient: creator.avatarGradient }
      : null,
    rating: raw.rating,
    reviewCount: raw.reviewCount ?? 0,
    badges: raw.badges ?? [],
    included: suffixedList(raw as unknown as Record<string, unknown>, "included", locale),
    fileTypes: raw.fileTypes ?? [],
    faq: (locale === "en" ? raw.faqEn : raw.faqRu) ?? [],
    freePreview: preview
      ? {
          type: preview.type,
          title: pick(locale, preview.titleRu, preview.titleEn),
          content: pick(locale, preview.contentRu, preview.contentEn),
        }
      : null,
    relatedIds: raw.relatedIds ?? [],
    recommendsForCourses: raw.recommendsForCourses ?? [],
    available: raw.availability !== "coming_soon",
    outcome: suffixed(raw as unknown as Record<string, unknown>, "outcome", locale),
    setupTime: raw.setupTime ?? "",
    priceModel: raw.priceModel ?? "",
  };
}

/* ---------------------------------- queries -------------------------------- */

export async function getStoreCatalog(locale: Locale): Promise<StoreCatalog> {
  const raw = await tryApi<ApiCatalog>(
    "/marketplace/catalog",
    { revalidate: 120, tags: ["marketplace"] },
    { enabled: false, products: [], bundles: [] },
  );

  // The API does not serve ratings yet; the migrated catalogue does.
  const localById = new Map(fallbackProducts.map((product) => [product.id, product]));
  const source = raw.products?.length ? raw.products : fallbackProducts;
  const products = source
    .map((product) => {
      const local = localById.get(product.id);
      return toProduct(
        {
          ...product,
          rating: product.rating ?? local?.rating ?? null,
          reviewCount: product.reviewCount || local?.reviewCount || 0,
          availability: product.availability ?? local?.availability,
          outcomeRu: product.outcomeRu ?? local?.outcomeRu,
          outcomeEn: product.outcomeEn ?? local?.outcomeEn,
          setupTime: product.setupTime ?? local?.setupTime,
          priceModel: product.priceModel ?? local?.priceModel,
        },
        locale,
      );
    });
  const byId = new Map(products.map((product) => [product.id, product]));

  const bundles: Bundle[] = (raw.bundles ?? []).map((bundle) => {
    const items = bundle.productIds.map((id) => byId.get(id)).filter((item): item is Product => Boolean(item));
    const fullPriceEur = items.reduce((sum, item) => sum + item.priceEur, 0);
    return { ...bundle, products: items, fullPriceEur, savingEur: Math.max(0, fullPriceEur - bundle.priceEur) };
  });

  return { enabled: Boolean(raw.enabled), products, bundles };
}

export async function getProduct(slug: string, locale: Locale) {
  const catalog = await getStoreCatalog(locale);
  const product = catalog.products.find((item) => item.slug === slug) ?? null;
  if (!product) return null;

  const related = product.relatedIds
    .map((id) => catalog.products.find((item) => item.id === id))
    .filter((item): item is Product => Boolean(item));

  const sameCategory = catalog.products
    .filter((item) => item.categoryId === product.categoryId && item.id !== product.id)
    .slice(0, 4);

  const inBundles = catalog.bundles.filter((bundle) => bundle.productIds.includes(product.id));

  return { product, related: related.length ? related : sameCategory, inBundles, enabled: catalog.enabled };
}

export { storeCategories, revenueShare };

/* ---------------------------------- filters -------------------------------- */

export type StoreSort = "popular" | "trending" | "new" | "price-asc" | "price-desc" | "rating";

export interface StoreQuery {
  q?: string;
  category?: string;
  sort?: StoreSort;
  min?: number;
  max?: number;
  minRating?: number;
  badge?: string;
}

/** Runs entirely on the server so a shared URL reproduces the exact shelf. */
export function filterProducts(products: Product[], query: StoreQuery): Product[] {
  const needle = query.q?.trim().toLowerCase();

  const filtered = products.filter((product) => {
    if (query.category && product.categorySlug !== query.category && product.categoryId !== query.category) return false;
    if (query.badge && !product.badges.includes(query.badge)) return false;
    if (typeof query.min === "number" && product.priceEur < query.min) return false;
    if (typeof query.max === "number" && product.priceEur > query.max) return false;
    if (typeof query.minRating === "number" && (product.rating ?? 0) < query.minRating) return false;
    if (needle) {
      const haystack = `${product.title} ${product.summary} ${product.categoryLabel} ${product.included.join(" ")}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  switch (query.sort) {
    case "price-asc":
      sorted.sort((a, b) => a.priceEur - b.priceEur);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.priceEur - a.priceEur);
      break;
    case "rating":
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case "new":
      sorted.sort((a, b) => Number(b.badges.includes("new")) - Number(a.badges.includes("new")));
      break;
    case "trending":
      sorted.sort((a, b) => Number(b.badges.includes("trending")) - Number(a.badges.includes("trending")));
      break;
    default:
      sorted.sort(
        (a, b) =>
          (b.rating ?? 0) * 10 + b.reviewCount - ((a.rating ?? 0) * 10 + a.reviewCount) ||
          a.title.localeCompare(b.title),
      );
  }
  return sorted;
}

/** Facet counts so a filter never leads to an empty shelf without warning. */
export function categoryFacets(products: Product[]) {
  const counts = new Map<string, number>();
  for (const product of products) counts.set(product.categorySlug, (counts.get(product.categorySlug) ?? 0) + 1);
  return storeCategories.map((category) => ({ ...category, count: counts.get(category.slug) ?? 0 }));
}
