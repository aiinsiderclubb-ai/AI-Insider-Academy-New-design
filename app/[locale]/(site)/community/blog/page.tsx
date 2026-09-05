import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Languages, Newspaper } from "lucide-react";
import { Badge, ChipLink } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Reveal } from "@/components/motion/reveal";
import { EmptyState, Note } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { getBlogPosts, getOtherLanguagePosts } from "@/lib/api/public";
import { formatDate, getDictionary, path, resultCount, type Locale } from "@/lib/i18n";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(locale);
  return { title: d.community.blogTitle, description: d.community.blogBody };
}

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale: raw } = await params;
  const { category } = await searchParams;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [all, otherLanguage] = await Promise.all([getBlogPosts(locale), getOtherLanguagePosts(locale)]);

  const categories = Array.from(new Set(all.map((post) => post.category)));
  const posts = category ? all.filter((post) => post.category === category) : all;
  const [lead, ...rest] = posts;

  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[{ label: d.brand.name, href: path("/", locale) }, { label: d.community.blogTitle }]}
        />
      </Container>

      <Container size="wide" className="pt-7 pb-10">
        <p className="eyebrow">{d.community.title}</p>
        <h1 className="mt-5 max-w-3xl text-[clamp(2.1rem,5vw,3.5rem)] leading-[0.99] tracking-[-0.04em]">
          {d.community.blogTitle}
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">{d.community.blogBody}</p>
      </Container>

      {posts.length === 0 ? (
        <Container size="wide" className="pb-20">
          <EmptyState
            icon={<Newspaper className="h-5 w-5" aria-hidden />}
            title={d.states.emptyTitle}
            body={pick(
              locale,
              "На этом языке материалов пока нет — загляните в другую локаль.",
              "Nothing published in this language yet — try another locale.",
            )}
          />
        </Container>
      ) : (
        <>
          <Container size="wide" className="pb-8">
            <div className="flex flex-wrap gap-2">
              <ChipLink href={path("/community/blog", locale)} active={!category}>
                {d.common.all}
              </ChipLink>
              {categories.map((item) => (
                <ChipLink
                  key={item}
                  href={path(`/community/blog?category=${encodeURIComponent(item)}`, locale)}
                  active={category === item}
                >
                  {item}
                </ChipLink>
              ))}
            </div>
            <p className="mt-4 text-[13px] text-muted tabular-nums">{resultCount(posts.length, locale, d)}</p>
          </Container>

          {lead && (
            <Container size="wide" className="pb-12">
              <article className="group relative overflow-hidden rounded-xl border border-line bg-surface p-7 shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md sm:p-10">
                <Badge tone="accent">{lead.category}</Badge>
                <h2 className="mt-5 max-w-3xl text-[clamp(1.6rem,3.4vw,2.5rem)] leading-[1.05]">
                  <Link href={path(`/community/blog/${lead.slug}`, locale)} className="after:absolute after:inset-0 after:content-['']">
                    {lead.title}
                  </Link>
                </h2>
                <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">{lead.excerpt}</p>
                <p className="mt-6 flex items-center gap-3 text-[12.5px] text-muted">
                  <span>{formatDate(lead.date, locale)}</span>
                  <span className="h-3 w-px bg-line-2" aria-hidden />
                  <span>
                    {lead.readMinutes} {d.common.minRead}
                  </span>
                </p>
              </article>
            </Container>
          )}

          <Container size="wide" className="pb-16">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <li key={post.id}>
                  <article className="group relative flex h-full flex-col rounded-lg border border-line bg-surface p-5 shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md">
                    <p className="eyebrow">{post.category}</p>
                    <h3 className="mt-3 text-[17px] leading-snug">
                      <Link
                        href={path(`/community/blog/${post.slug}`, locale)}
                        className="after:absolute after:inset-0 after:content-['']"
                      >
                        {post.title}
                      </Link>
                    </h3>
                    <p className="mt-2.5 line-clamp-3 text-[13.5px] leading-relaxed text-ink-3">{post.excerpt}</p>
                    <p className="mt-auto flex items-center justify-between gap-3 pt-5 text-[12.5px] text-muted">
                      <span>{formatDate(post.date, locale, { day: "numeric", month: "short", year: "numeric" })}</span>
                      <ArrowUpRight
                        className="h-4 w-4 text-line-3 transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                        aria-hidden
                      />
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          </Container>
        </>
      )}

      {otherLanguage.length > 0 && (
        <Container size="wide" className="pb-20">
          <Reveal>
            <SectionHead
              eyebrow={
                <span className="inline-flex items-center gap-1.5">
                  <Languages className="h-3.5 w-3.5" aria-hidden />
                  {pick(locale, "Другая локаль", "Other locale")}
                </span>
              }
              title={pick(locale, "Есть на другом языке", "Available in another language")}
              body={pick(
                locale,
                "Эти материалы написаны на другом языке — мы не показываем их как переведённые.",
                "These pieces are written in another language, so we do not pass them off as translated.",
              )}
              as="h2"
            />
          </Reveal>
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {otherLanguage.slice(0, 8).map((post) => (
              <li key={post.id} className="bg-surface p-4">
                <Link
                  href={path(`/community/blog/${post.slug}`, post.lang === "ukr" ? "ukr" : "ru")}
                  className="flex items-start justify-between gap-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-ink">{post.title}</span>
                    <span className="mt-0.5 block text-[12.5px] text-muted">{post.category}</span>
                  </span>
                  <Badge tone="outline">{post.lang === "ukr" ? "UA" : "RU"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
          <Note tone="neutral" className="mt-5">
            {pick(
              locale,
              "Перевод этих статей запланирован — до тех пор они остаются в исходной локали.",
              "Translations are planned — until then these stay in their original locale.",
            )}
          </Note>
        </Container>
      )}
    </>
  );
}
