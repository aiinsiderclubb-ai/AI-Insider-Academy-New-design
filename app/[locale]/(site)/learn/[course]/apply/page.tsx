import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { Container } from "@/components/primitives/surface";
import { ApplicationForm } from "@/components/catalog/application-form";
import { pick } from "@/content/locale";
import { getCourse } from "@/lib/api/catalog";
import { getSession } from "@/lib/api/session";
import { getDictionary, path, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; course: string }>;
}): Promise<Metadata> {
  const { locale, course: slug } = await params;
  const course = await getCourse(slug, locale as Locale);
  return {
    title: course ? `${course.title} · ${getDictionary(locale).learn.apply}` : undefined,
    robots: { index: false },
  };
}

/** The application for the intake course; every other course is bought or started, not applied to. */
export default async function ApplyPage({ params }: { params: Promise<{ locale: string; course: string }> }) {
  const { locale: raw, course: slug } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const course = await getCourse(slug, locale);
  if (!course || !course.isIntake) notFound();

  const user = await getSession();
  const courseHref = path(`/learn/${course.slug}`, locale);

  return (
    <Container size="wide" className="pt-8 pb-20">
      <Breadcrumbs
        label={d.common.breadcrumb}
        items={[
          { label: d.learn.title, href: path("/learn", locale) },
          { label: course.title, href: courseHref },
          { label: d.learn.apply },
        ]}
      />

      <div className="mt-7 grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Badge tone="accent">{pick(locale, "Бесплатно · по заявке", "Free · by application")}</Badge>
          <h1 className="mt-5 text-[clamp(2rem,4.4vw,3.25rem)] leading-[1.02] tracking-[-0.045em]">
            {pick(locale, "Как попасть в поток", "How to join the cohort")}
          </h1>
          <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-ink-2">
            {pick(
              locale,
              "Курс бесплатный, но места ограничены — куратор проверяет каждую работу. Заполните анкету, это займёт несколько минут.",
              "The course is free, but places are limited: a curator reviews every assignment. The application takes a few minutes.",
            )}
          </p>
          <ul className="mt-7 flex flex-col gap-2.5">
            {[
              pick(locale, "12 уроков и 9 направлений AI на практике", "12 lessons and 9 AI directions in practice"),
              pick(locale, "Весь курс — с одним бизнесом, в финале готовая AI-система", "One business all course long, ending in a working AI system"),
              pick(locale, "Куратор проверяет каждое задание", "A curator reviews every assignment"),
            ].map((item) => (
              <li key={item} className="flex gap-2.5 text-[14px] leading-snug text-ink-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-7 text-[13px] text-muted">
            {pick(locale, "Первый урок открыт всем — посмотрите до заявки.", "The first lesson is open to everyone — watch it before you apply.")}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-9">
          <ApplicationForm locale={locale} defaultEmail={user?.email ?? ""} courseHref={courseHref} />
        </div>
      </div>
    </Container>
  );
}
