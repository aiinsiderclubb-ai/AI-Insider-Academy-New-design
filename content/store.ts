import categories from "./data/marketplace__categories.json";
import products from "./data/marketplace__products.json";
import type { ApiProduct } from "@/lib/api/types";

export interface StoreCategory {
  id: string;
  slug: string;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  icon: string;
  priceFrom: number;
  priceTo: number;
  accent: string;
}

export const storeCategories = categories.MARKETPLACE_CATEGORIES as unknown as StoreCategory[];

export function categoryById(id: string): StoreCategory | undefined {
  return storeCategories.find((category) => category.id === id);
}

export function categoryBySlug(slug: string): StoreCategory | undefined {
  return storeCategories.find((category) => category.slug === slug);
}

/**
 * Local snapshot of the catalogue. The API is authoritative; this is the
 * fallback that keeps the store browsable when the marketplace feature flag is
 * off or the service is unreachable, instead of showing an empty shelf.
 */
export const fallbackProducts = (products.MARKETPLACE_PRODUCTS ?? []) as unknown as ApiProduct[];

/** Collections are curated shelves; the source data marks them with badges. */
export const collections = [
  { id: "trending", labelRu: "Тренды 2026", labelEn: "2026 trends", badge: "trending" },
  { id: "new", labelRu: "Новые поступления", labelEn: "New arrivals", badge: "new" },
  { id: "bestseller", labelRu: "Лучшие продажи", labelEn: "Best sellers", badge: "bestseller" },
] as const;

/** Marketplace discounts that come with an active subscription. */
export const tierDiscount: Record<"club" | "pro", number> = { club: 0.1, pro: 0.25 };
