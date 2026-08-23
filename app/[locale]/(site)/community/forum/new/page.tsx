import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { Container } from "@/components/primitives/surface";
import { NewTopicForm } from "@/components/community/new-topic-form";
import { pick } from "@/content/locale";
import { getForumCategories } from "@/lib/api/public";
import { getSession } from "@/lib/api/session";
import { getDictionary, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function NewTopicPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const user = await getSession();
  if (!user) redirect(path("/login?next=" + encodeURIComponent(path("/community/forum/new", locale)), locale));

  const categories = await getForumCategories(locale);

  return (
    <Container size="default" className="pt-8 pb-20">
      <Breadcrumbs
        label={d.common.breadcrumb}
        items={[
          { label: d.community.forumTitle, href: path("/community/forum", locale) },
          { label: d.community.askQuestion },
        ]}
      />
      <h1 className="mt-7 text-[clamp(1.75rem,4vw,2.75rem)] leading-tight tracking-[-0.035em]">
        {d.community.askQuestion}
      </h1>
      <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-ink-2">
        {pick(
          locale,
          "Опишите контекст и что уже пробовали — так ответ придёт быстрее.",
          "Describe the context and what you already tried — that gets you an answer faster.",
        )}
      </p>
      <div className="mt-8">
        <NewTopicForm locale={locale} d={d} categories={categories} />
      </div>
    </Container>
  );
}
