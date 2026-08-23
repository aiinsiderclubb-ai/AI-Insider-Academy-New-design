import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Eye, MessageSquare, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { Container } from "@/components/primitives/surface";
import { Avatar } from "@/components/primitives/display";
import { Note } from "@/components/primitives/states";
import { ForumReply } from "@/components/community/forum-reply";
import { pick } from "@/content/locale";
import { getForumCategories, getForumTopic } from "@/lib/api/public";
import { getSession } from "@/lib/api/session";
import { formatRelative, getDictionary, path, type Locale } from "@/lib/i18n";

export const revalidate = 15;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getForumTopic(decodeURIComponent(slug));
  if (!data?.topic) return {};
  return { title: data.topic.title, description: data.topic.body?.slice(0, 160) };
}

export default async function ForumTopicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [data, categories, user] = await Promise.all([
    getForumTopic(decodeURIComponent(slug)),
    getForumCategories(locale),
    getSession(),
  ]);

  if (!data?.topic) notFound();
  const { topic, posts } = data;
  const categoryLabel = categories.find((item) => item.id === topic.category)?.label ?? topic.category;

  return (
    <Container size="default" className="pt-8 pb-20">
      <Breadcrumbs
        label={d.common.breadcrumb}
        items={[
          { label: d.community.forumTitle, href: path("/community/forum", locale) },
          { label: categoryLabel, href: path(`/community/forum?category=${topic.category}`, locale) },
          { label: topic.title },
        ]}
      />

      <article className="mt-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">{categoryLabel}</Badge>
          {topic.solvedPostId && (
            <Badge tone="success">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              {d.community.solved}
            </Badge>
          )}
          {topic.isLocked && <Badge tone="warning">{pick(locale, "Закрыта", "Locked")}</Badge>}
        </div>

        <h1 className="mt-5 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] tracking-[-0.035em]">{topic.title}</h1>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
          <span className="flex items-center gap-2">
            <Avatar name={topic.author?.name ?? "?"} size={22} />
            {topic.author?.name}
          </span>
          <span>{formatRelative(topic.createdAt, locale)}</span>
          <span className="flex items-center gap-1.5 tabular-nums">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {topic.views}
          </span>
          <span className="flex items-center gap-1.5 tabular-nums">
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
            {topic.reactions}
          </span>
        </div>

        {topic.body && (
          <div className="prose-body mt-7 text-[15.5px] whitespace-pre-line">{topic.body}</div>
        )}
      </article>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-[19px]">
          <MessageSquare className="h-4.5 w-4.5 text-accent" aria-hidden />
          {d.community.answers}
          <span className="font-mono text-[13px] tabular-nums text-faint">{posts?.length ?? topic.replyCount}</span>
        </h2>

        {posts?.length ? (
          <ul className="mt-5 flex flex-col gap-3">
            {posts.map((post) => (
              <li
                key={post.id}
                className={
                  post.isSolution || post.id === topic.solvedPostId
                    ? "rounded-lg border border-success/35 bg-success-soft p-5"
                    : "rounded-lg border border-line bg-surface p-5"
                }
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={post.author?.name ?? "?"} size={26} />
                  <span className="text-[13.5px] font-medium text-ink">{post.author?.name}</span>
                  <span className="text-[12.5px] text-muted">{formatRelative(post.createdAt, locale)}</span>
                  {(post.isSolution || post.id === topic.solvedPostId) && (
                    <Badge tone="success" className="ml-auto">
                      {d.community.solved}
                    </Badge>
                  )}
                </div>
                <div className="mt-3.5 text-[14.5px] leading-relaxed whitespace-pre-line text-ink-2">{post.body}</div>
              </li>
            ))}
          </ul>
        ) : (
          <Note tone="neutral" className="mt-5">
            {pick(locale, "Ответов пока нет — станьте первым.", "No answers yet — be the first.")}
          </Note>
        )}
      </section>

      <section className="mt-10">
        {user ? (
          <ForumReply topicId={topic.id} locale={locale} d={d} locked={topic.isLocked} />
        ) : (
          <div className="rounded-lg border border-line bg-surface-2 p-6 text-center">
            <p className="text-[14.5px] text-ink-2">
              {pick(
                locale,
                "Чтобы ответить или задать свой вопрос, нужен аккаунт. Регистрация бесплатная.",
                "You need an account to answer or ask. Registration is free.",
              )}
            </p>
            <ButtonLink href={path("/register", locale)} className="mt-4">
              {d.auth.signUp}
            </ButtonLink>
          </div>
        )}
      </section>
    </Container>
  );
}
