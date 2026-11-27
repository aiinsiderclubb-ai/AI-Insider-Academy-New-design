import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Heart, Package } from "lucide-react";
import { DownloadFileButton } from "@/components/app/download-file-button";
import { AppPage } from "@/components/app/page-header";
import { ButtonLink } from "@/components/primitives/button";
import { EmptyState, Note } from "@/components/primitives/states";
import { WishlistPanel } from "@/components/store/wishlist";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { getStoreCatalog } from "@/lib/api/store";
import { getAccess, getDownloads, ownsCourse } from "@/lib/api/session";
import { formatPrice, getDictionary, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

interface DownloadRow {
  assetId?: string;
  productId?: string;
  fileName?: string;
  sizeBytes?: number;
  version?: number;
}

function fileSize(bytes?: number) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
    (course) => ownsCourse(access, course),
  );
  const rows = downloads as DownloadRow[];
  const filesFor = (productId: string) => rows.filter((row) => row.productId === productId && row.assetId);

  return (
    <AppPage
      eyebrow={d.app.library}
      title={pick(locale, "Файлы и материалы", "Files and resources")}
      body={pick(
        locale,
        "Материалы курсов, купленные в магазине товары и все версии файлов в одном месте.",
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
            {ownedProducts.map((product) => {
              const files = filesFor(product.id);
              return (
                <li key={product.id} className="flex flex-col gap-3 bg-surface p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-ink">
                        <a href={path(`/store/${product.slug}`, locale)} className="underline-offset-4 hover:underline">
                          {product.title}
                        </a>
                      </p>
                      <p className="mt-0.5 font-mono text-[12px] text-muted">{product.fileTypes.join(" · ")}</p>
                    </div>
                    {files.length === 0 && (
                      <ButtonLink href={path(`/store/${product.slug}`, locale)} variant="secondary" size="sm">
                        {pick(locale, "Открыть", "Open")}
                      </ButtonLink>
                    )}
                  </div>
                  {files.length > 0 && (
                    <ul className="flex flex-col gap-2 border-t border-line pt-3">
                      {files.map((file) => (
                        <li key={file.assetId} className="flex items-center justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-[12.5px] text-ink-2">{file.fileName}</span>
                            <span className="text-[11.5px] text-muted">
                              {pick(locale, "версия", "version")} {file.version ?? 1}
                              {file.sizeBytes ? ` · ${fileSize(file.sizeBytes)}` : ""}
                            </span>
                          </span>
                          <DownloadFileButton
                            assetId={file.assetId as string}
                            label={d.common.download}
                            errorLabel={pick(locale, "Не вышло, попробуйте ещё раз", "Didn't work, try again")}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
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
