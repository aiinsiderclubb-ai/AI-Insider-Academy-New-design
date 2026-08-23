import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Note } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { getBlogPost } from "@/lib/api/public";
import { formatDate, getDictionary, path, type Locale } from "@/lib/i18n";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const data = await getBlogPost(slug, locale as Locale);
  if (!data) return {};
  return {
    title: data.post.title,
    description: data.post.excerpt,
    openGraph: { title: data.post.title, description: data.post.excerpt, type: "article" },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const data = await getBlogPost(slug, locale);
  if (!data) notFound();
  const { post, prev, next, related } = data;

  const mismatched = locale !== "en" && post.lang !== locale;
  const paragraphs = post.body ? post.body.split(/\n{2,}/).filter(Boolean) : [];

  return (
    <>
      <Container size="narrow" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[
            { label: d.community.blogTitle, href: path("/community/blog", locale) },
            { label: post.category, href: path(`/community/blog?category=${encodeURIComponent(post.category)}`, locale) },
            { label: post.title },
          ]}
        />
      </Container>

      <Container size="narrow" className="pt-7 pb-12">
        <article>
          <Badge tone="accent">{post.category}</Badge>

          <h1 className="mt-5 text-[clamp(2rem,4.6vw,3.25rem)] leading-[1.03] tracking-[-0.04em]">{post.title}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {formatDate(post.date, locale)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {post.readMinutes} {d.common.minRead}
            </span>
            {mismatched && <Badge tone="outline">{post.lang === "ukr" ? "Українська" : "Русский"}</Badge>}
          </div>

          {mismatched && (
            <Note tone="warning" className="mt-6">
              {pick(
                locale,
                "Материал опубликован на украинском — перевод в работе.",
                "This piece is published in Ukrainian; a translation is in progress.",
              )}
            </Note>
          )}

          <p className="mt-8 border-l-[3px] border-accent pl-5 text-[17px] leading-relaxed text-ink-2">{post.excerpt}</p>

          {paragraphs.length > 0 ? (
            <div className="prose-body mt-8 flex flex-col gap-5 text-[16px]">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <div className="mt-10 rounded-lg border border-dashed border-line-2 bg-surface-2 p-6">
              <p className="font-display text-[17px] font-extrabold tracking-tight text-ink">
                {pick(locale, "Полный текст готовится", "The full text is in preparation")}
              </p>
              <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-ink-3">
                {pick(
                  locale,
                  "Материал перенесён из старой редакции: лид уже здесь, развёрнутая версия появится после редактуры.",
                  "Migrated from the previous edition: the lead is here, the long version follows after editing.",
                )}
              </p>
              <ButtonLink href={path("/learn", locale)} variant="secondary" size="sm" className="mt-5">
                {d.nav.catalog}
              </ButtonLink>
            </div>
          )}
        </article>

        <nav className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6" aria-label={d.community.blogTitle}>
          {prev ? (
            <Link
              href={path(`/community/blog/${prev.slug}`, locale)}
              className="group flex max-w-[45%] items-center gap-2 text-[13.5px] text-ink-2 hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" aria-hidden />
              <span className="truncate">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={path(`/community/blog/${next.slug}`, locale)}
              className="group flex max-w-[45%] items-center gap-2 text-right text-[13.5px] text-ink-2 hover:text-ink"
            >
              <span className="truncate">{next.title}</span>
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}
        </nav>
      </Container>

      {related.length > 0 && (
        <Container size="wide" className="pb-20">
          <SectionHead eyebrow={post.category} title={d.store.related} as="h2" />
          <ul className="grid gap-4 sm:grid-cols-3">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  href={path(`/community/blog/${item.slug}`, locale)}
                  className="group flex h-full flex-col rounded-lg border border-line bg-surface p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md"
                >
                  <p className="eyebrow">{item.category}</p>
                  <p className="mt-3 text-[15.5px] leading-snug font-medium text-ink">{item.title}</p>
                  <p className="mt-auto pt-4 text-[12.5px] text-muted">
                    {formatDate(item.date, locale, { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      )}
    </>
  );
}
