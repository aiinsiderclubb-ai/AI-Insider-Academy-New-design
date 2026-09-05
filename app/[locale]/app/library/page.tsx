import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileArchive, FolderOpen, Heart, Package } from "lucide-react";
import { AppPage } from "@/components/app/page-header";
import { ButtonLink } from "@/components/primitives/button";
import { EmptyState, Note } from "@/components/primitives/states";
import { WishlistPanel } from "@/components/store/wishlist";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { getStoreCatalog } from "@/lib/api/store";
import { getAccess, getDownloads } from "@/lib/api/session";
import { formatDate, formatPrice, getDictionary, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

interface DownloadRow {
  assetId?: string;
  title?: string;
  productSlug?: string;
  version?: number;
  updatedAt?: string;
}

export default async function LibraryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [courses, catalog, access, downloads] = await Promise.all([
    getCourses(locale),
    getStoreCatalog(locale),
    getAccess(),
    getDownloads(),
  ]);

  const ownedProducts = catalog.products.filter((product) => access.productIds.has(product.id));
  const ownedCourses = courses.filter(
    (course) => course.isFree || access.courseIds.has(course.id) || access.tier === "pro",
  );
  const rows = downloads as DownloadRow[];

  return (
    <AppPage
      eyebrow={d.app.library}
      title={pick(locale, "Файлы и материалы", "Files and resources")}
      body={pick(
        locale,
        "Материалы курсов, купленные системы Marketplace и все версии файлов в одном месте.",
        "Course resources, purchased marketplace systems and every file version in one place.",
      )}
    >
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-[17px]">
          <Package className="h-4 w-4 text-accent" aria-hidden />
          {d.store.title}
        </h2>
        {ownedProducts.length ? (
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {ownedProducts.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-4 bg-surface p-4">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink">{product.title}</p>
                  <p className="mt-0.5 font-mono text-[12px] text-muted">{product.fileTypes.join(" · ")}</p>
                </div>
                <ButtonLink href={path(`/store/${product.slug}`, locale)} variant="secondary" size="sm">
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  {d.common.download}
                </ButtonLink>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={<FolderOpen className="h-5 w-5" aria-hidden />}
            title={pick(locale, "Покупок ещё нет", "No purchases yet")}
            body={pick(
              locale,
              "Файлы купленных систем появляются здесь сразу после оплаты — с версиями и обновлениями.",
              "Files from purchased systems land here right after payment — versions and updates included.",
            )}
            action={
              <ButtonLink href={path("/store", locale)} size="sm">
                {d.store.title}
              </ButtonLink>
            }
          />
        )}
      </section>

      {rows.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 text-[17px]">
            <FileArchive className="h-4 w-4 text-accent" aria-hidden />
            {pick(locale, "История скачиваний", "Download history")}
          </h2>
          <div className="scroll-x rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[32rem] text-[13.5px]">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th scope="col" className="p-3.5 text-left font-mono text-2xs tracking-[0.1em] text-muted uppercase">
                    {d.store.title}
                  </th>
                  <th scope="col" className="p-3.5 text-left font-mono text-2xs tracking-[0.1em] text-muted uppercase">
                    v
                  </th>
                  <th scope="col" className="p-3.5 text-left font-mono text-2xs tracking-[0.1em] text-muted uppercase">
                    {d.common.saved}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.assetId ?? index} className="border-b border-line last:border-b-0">
                    <td className="p-3.5 text-ink-2">{row.title ?? row.productSlug ?? "—"}</td>
                    <td className="p-3.5 font-mono text-muted">{row.version ?? 1}</td>
                    <td className="p-3.5 text-muted">{row.updatedAt ? formatDate(row.updatedAt, locale) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 text-[17px]">
          <Heart className="h-4 w-4 text-accent" aria-hidden />
          {d.store.wishlist}
        </h2>
        <WishlistPanel
          locale={locale}
          catalogue={catalog.products.map((product) => ({
            id: product.id,
            slug: product.slug,
            title: product.title,
            price: formatPrice(product.priceEur, locale),
            category: product.categoryLabel,
          }))}
          labels={{
            title: d.store.wishlist,
            empty: pick(locale, "В избранном пусто", "Nothing saved yet"),
            emptyBody: pick(
              locale,
              "Нажмите на сердце в карточке товара — список сохраняется на этом устройстве.",
              "Tap the heart on a product card — the list is kept on this device.",
            ),
            browse: d.store.title,
            remove: d.common.remove,
          }}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 text-[17px]">
          <FolderOpen className="h-4 w-4 text-accent" aria-hidden />
          {pick(locale, "Материалы курсов", "Course resources")}
        </h2>
        {ownedCourses.length ? (
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {ownedCourses.map((course) => (
              <li key={course.id} className="flex items-center justify-between gap-4 bg-surface p-4">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink">{course.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">{course.categoryLabel}</p>
                </div>
                <Link
                  href={path(`/study/${course.slug}/1`, locale)}
                  className="shrink-0 text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
                >
                  {d.common.open}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact title={d.states.emptyTitle} body={d.learn.body} />
        )}
      </section>

      {access.prelaunch && (
        <Note tone="warning" className="mt-8">
          {pick(
            locale,
            "Выдача файлов включится вместе с продажами.",
            "File delivery switches on together with sales.",
          )}
        </Note>
      )}
    </AppPage>
  );
}
