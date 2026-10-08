import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReviewForm } from "@/components/app/review-form";
import { Container } from "@/components/primitives/surface";
import { Note } from "@/components/primitives/states";
import { getCourses } from "@/lib/api/catalog";
import { getAccess, getMe } from "@/lib/api/session";
import { getStoreCatalog } from "@/lib/api/store";
import { getDictionary, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Where the thank-you email sends a buyer to leave a review.
 *
 * It sits outside the cabinet on purpose. The cabinet's layout signs people in
 * and then drops them on its home page, which would lose the link from the
 * email for anyone who was signed out — and a buyer opening an email on their
 * phone usually is. Here the sign-in redirect carries the way back.
 */
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);
  const itemId = String((await searchParams).item ?? "").trim();

  const me = await getMe();
  if (!me) {
    const back = `/${locale}/review${itemId ? `?item=${encodeURIComponent(itemId)}` : ""}`;
    redirect(path(`/login?next=${encodeURIComponent(back)}`, locale));
  }

  const [courses, catalog, access] = await Promise.all([getCourses(locale), getStoreCatalog(locale), getAccess()]);

  const course = courses.find((entry) => entry.id === itemId);
  const product = catalog.products.find((entry) => entry.id === itemId);
  const title = course?.title ?? product?.title ?? null;
  const owned = access.courseIds.has(itemId) || access.productIds.has(itemId);

  return (
    <section className="chapter chapter-tight">
      <Container size="narrow">
        <p className="eyebrow flex items-center gap-3">
          <span className="rule-accent inline-block w-7" aria-hidden />
          {d.review.eyebrow}
        </p>
        <h1 className="mt-5 text-[clamp(1.8rem,4vw,2.8rem)] tracking-[-0.04em]">{d.review.title}</h1>
        <p className="mt-5 text-[15.5px] leading-relaxed text-ink-3">{d.review.body}</p>

        <div className="mt-9">
          {!title ? (
            <Note tone="warning">{d.review.notFound}</Note>
          ) : !owned ? (
            <Note tone="warning">{d.review.notOwned}</Note>
          ) : (
            <ReviewForm
              item={{ id: itemId, title }}
              spendHref={path("/learn", locale)}
              dateLocale={locale === "en" ? "en-GB" : locale === "ukr" ? "uk-UA" : "ru-RU"}
              d={d}
            />
          )}
        </div>
      </Container>
    </section>
  );
}
