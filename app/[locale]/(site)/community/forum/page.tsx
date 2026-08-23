import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Eye, MessageSquare, ThumbsUp } from "lucide-react";
import { Badge, ChipLink } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { Container } from "@/components/primitives/surface";
import { EmptyState } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { getForumCategories, getForumTopics } from "@/lib/api/public";
import { getSession } from "@/lib/api/session";
import { formatRelative, getDictionary, path, resultCount, type Locale } from "@/lib/i18n";

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(locale);
  return { title: d.community.forumTitle, description: d.community.forumBody };
}

export default async function ForumPage({
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

  const [categories, { topics, total }, user] = await Promise.all([
    getForumCategories(locale),
    getForumTopics(category),
    getSession(),
  ]);

  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[{ label: d.brand.name, href: path("/", locale) }, { label: d.community.forumTitle }]}
        />
      </Container>

      <Container size="wide" className="pt-7 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="eyebrow">{d.community.title}</p>
            <h1 className="mt-5 text-[clamp(2.1rem,5vw,3.5rem)] leading-[0.99] tracking-[-0.04em]">
              {d.community.forumTitle}
            </h1>
            <p className="mt-5 text-[16px] leading-relaxed text-ink-2">{d.community.forumBody}</p>
          </div>
          <ButtonLink href={user ? path("/community/forum/new", locale) : path("/register", locale)} size="lg">
            {d.community.askQuestion}
          </ButtonLink>
        </div>
      </Container>

      <Container size="wide" className="pb-6">
        <div className="flex flex-wrap gap-2">
          <ChipLink href={path("/community/forum", locale)} active={!category}>
            {d.common.all}
          </ChipLink>
          {categories.map((item) => (
            <ChipLink
              key={item.id}
              href={path(`/community/forum?category=${item.id}`, locale)}
              active={category === item.id}
            >
              {item.label}
            </ChipLink>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-muted tabular-nums">{resultCount(total, locale, d)}</p>
      </Container>

      <Container size="wide" className="pb-20">
        {topics.length ? (
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line">
            {topics.map((topic) => {
              const categoryLabel = categories.find((item) => item.id === topic.category)?.label ?? topic.category;
              return (
                <li key={topic.id} className="bg-surface transition-colors hover:bg-surface-2">
                  <Link href={path(`/community/forum/${encodeURIComponent(topic.slug)}`, locale)} className="block p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="outline">{categoryLabel}</Badge>
                      {topic.solvedPostId && (
                        <Badge tone="success">
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          {d.community.solved}
                        </Badge>
                      )}
                    </div>

                    <h2 className="mt-3 text-[17px] leading-snug">{topic.title}</h2>
                    {topic.body && <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-ink-3">{topic.body}</p>}

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
                      <span>{topic.author?.name}</span>
                      <span>{formatRelative(topic.createdAt, locale)}</span>
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                        {topic.replyCount}
                      </span>
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                        {topic.reactions}
                      </span>
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        {topic.views}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<MessageSquare className="h-5 w-5" aria-hidden />}
            title={pick(locale, "Вопросов пока нет", "No questions yet")}
            body={pick(
              locale,
              "Задайте первый — участники и менторы Academy отвечают в течение дня.",
              "Ask the first one — members and Academy mentors answer within a day.",
            )}
            action={
              <ButtonLink href={user ? path("/community/forum/new", locale) : path("/register", locale)} size="sm">
                {d.community.askQuestion}
              </ButtonLink>
            }
          />
        )}
      </Container>
    </>
  );
}
