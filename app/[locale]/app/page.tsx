import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BellRing,
  CalendarDays,
  Flame,
  Gift,
  Play,
  Sparkles,
  Ticket,
} from "lucide-react";
import { AppPage } from "@/components/app/page-header";
import { Badge, Dot } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import { Progress, ProgressRing } from "@/components/primitives/display";
import { EmptyState, Note } from "@/components/primitives/states";
import { ProductCard } from "@/components/store/product-card";
import { courseCover } from "@/content/covers";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { getStoreCatalog } from "@/lib/api/store";
import { getAccess, getCertificates, getMe, getNotifications, courseCompletion } from "@/lib/api/session";
import { getGiveaways } from "@/lib/api/public";
import { formatDate, formatRelative, getDictionary, lessonCount, path, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { robots: { index: false } };

function greeting(locale: Locale, name: string) {
  const hour = new Date().getHours();
  const key = hour < 5 ? "night" : hour < 12 ? "morning" : hour < 18 ? "day" : "evening";
  const ru = { night: "Доброй ночи", morning: "Доброе утро", day: "Добрый день", evening: "Добрый вечер" };
  const en = { night: "Good night", morning: "Good morning", day: "Good afternoon", evening: "Good evening" };
  return `${pick(locale, ru[key], en[key])}, ${name.split(" ")[0]}`;
}

export default async function TodayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [me, access, courses, catalog, certificates, notifications, giveaways] = await Promise.all([
    getMe(),
    getAccess(),
    getCourses(locale),
    getStoreCatalog(locale),
    getCertificates(),
    getNotifications(),
    getGiveaways(),
  ]);

  if (!me) return null;

  const openCourses = courses.filter(
    (course) => course.isFree || access.courseIds.has(course.id) || access.tier === "pro",
  );

  const withProgress = openCourses
    .map((course) => ({ course, ...courseCompletion(access, course.id, course.lessonCount) }))
    .sort((a, b) => b.done - a.done || a.course.lessonCount - b.course.lessonCount);

  const current = withProgress.find((item) => item.done > 0 && item.percent < 100) ?? withProgress[0];
  const nextLessonIndex = current ? Math.min(current.done, current.course.lessonCount - 1) : 0;
  const nextLesson = current?.course.lessons[nextLessonIndex];
  const currentImage = current ? courseCover(current.course.image, current.course.slug) : null;

  const activeGiveaway = giveaways.find((giveaway) => giveaway.status === "active");
  const unread = notifications.filter((notification) => !notification.read);

  const recommended = catalog.products
    .filter((product) => product.available)
    .slice(0, 3);

  const weekTarget = 5;
  const weekDone = Math.min(weekTarget, withProgress.reduce((sum, item) => sum + item.done, 0));

  return (
    <AppPage
      eyebrow={formatDate(new Date(), locale, { weekday: "long", day: "numeric", month: "long" })}
      title={greeting(locale, me.user.name || me.user.email)}
      body={
        current
          ? pick(locale, "Один шаг за раз. Следующий урок уже открыт.", "One step at a time. Your next lesson is ready.")
          : pick(locale, "Выберите программу — и начнём.", "Pick a programme and let's start.")
      }
    >
      {access.prelaunch && (
        <Note tone="warning" className="mb-6">
          {pick(
            locale,
            "Платформа в режиме предзапуска: покупки и доступы к платным курсам временно заморожены на стороне API.",
            "The platform is in prelaunch: purchases and paid-course access are frozen on the API side for now.",
          )}
        </Note>
      )}

      {/* ------------------------------ hero row ------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {current ? (
          <article className="relative overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
            {currentImage && (
              <div className="absolute inset-0 opacity-[0.18]">
                <Image src={currentImage} alt="" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
              </div>
            )}
            <div className="relative flex h-full flex-col justify-between gap-8 p-6 sm:p-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{d.app.learning}</Badge>
                  <Badge tone="outline">{current.course.categoryLabel}</Badge>
                </div>
                <h2 className="mt-4 text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.05]">{current.course.title}</h2>
                {nextLesson && (
                  <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-ink-2">
                    <span className="font-mono text-[12px] tracking-[0.1em] text-muted">
                      {String(nextLessonIndex + 1).padStart(2, "0")}
                    </span>{" "}
                    {nextLesson.title}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-end justify-between gap-5">
                <div className="min-w-48 flex-1">
                  <Progress
                    value={current.percent}
                    label={`${current.done} / ${current.total} · ${d.study.progress}`}
                  />
                </div>
                <ButtonLink
                  href={path(`/study/${current.course.slug}/${nextLessonIndex + 1}`, locale)}
                  size="lg"
                  className="group"
                >
                  <Play className="h-4 w-4" aria-hidden />
                  {current.done > 0 ? d.common.continue : d.common.start}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </ButtonLink>
              </div>
            </div>
          </article>
        ) : (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" aria-hidden />}
            title={pick(locale, "Пока нет открытых курсов", "No open courses yet")}
            body={pick(
              locale,
              "Три программы доступны бесплатно сразу после регистрации — начните с них.",
              "Three programmes are free the moment you register — start there.",
            )}
            action={
              <ButtonLink href={path("/learn?tab=free", locale)} size="sm">
                {d.learn.startFree}
              </ButtonLink>
            }
          />
        )}

        {/* --------------------------- streak + rhythm -------------------------- */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex items-center gap-5 rounded-xl border border-line bg-surface p-6 shadow-xs">
            <ProgressRing value={(weekDone / weekTarget) * 100} size={76} stroke={6}>
              <span className="font-display text-[1.15rem] leading-none font-extrabold tabular-nums">{weekDone}</span>
              <span className="mt-0.5 font-mono text-[10px] text-muted">/{weekTarget}</span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="eyebrow">{pick(locale, "Ритм недели", "Weekly rhythm")}</p>
              <p className="mt-2 text-[14px] leading-snug text-ink-2">
                {pick(locale, "Цель — 5 уроков в неделю", "A five-lesson week")}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-6 shadow-xs">
            <div>
              <p className="eyebrow">{pick(locale, "Серия дней", "Streak")}</p>
              <p className="mt-2 font-display text-[2rem] leading-none font-extrabold tabular-nums">
                {me.streak.current}
              </p>
              <p className="mt-1.5 text-[13px] text-muted">{pick(locale, "дней подряд", "days in a row")}</p>
            </div>
            <Flame
              className={cn("h-9 w-9", me.streak.current > 0 ? "text-accent" : "text-line-3")}
              aria-hidden
            />
          </div>
        </div>
      </div>

      {/* ------------------------------ my courses ----------------------------- */}
      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="text-[19px]">{d.app.learning}</h2>
          <Link
            href={path("/app/learning", locale)}
            className="text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
          >
            {d.common.showAll}
          </Link>
        </div>

        {withProgress.length ? (
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {withProgress.slice(0, 4).map(({ course, done, total, percent }) => (
              <li key={course.id} className="bg-surface transition-colors hover:bg-surface-2">
                <Link href={path(`/study/${course.slug}/${Math.min(done + 1, total)}`, locale)} className="flex gap-4 p-4">
                  <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md border border-line bg-surface-3">
                    {courseCover(course.image, course.slug) && (
                      <Image src={courseCover(course.image, course.slug)!} alt="" fill sizes="80px" className="object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium text-ink">{course.title}</span>
                    <span className="mt-1 block text-[12.5px] text-muted">
                      {done} / {total} · {lessonCount(total, locale, d)}
                    </span>
                    <Progress value={percent} size="sm" className="mt-2.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            title={pick(locale, "Курсы появятся здесь", "Your courses will appear here")}
            body={pick(locale, "Начните с бесплатной программы.", "Start with a free programme.")}
            action={
              <ButtonLink href={path("/learn", locale)} size="sm">
                {d.nav.catalog}
              </ButtonLink>
            }
          />
        )}
      </section>

      {/* --------------------------- secondary panels -------------------------- */}
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {/* notifications */}
        <section className="rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-[15px]">
              <BellRing className="h-4 w-4 text-accent" aria-hidden />
              {d.nav.notifications}
            </h2>
            {unread.length > 0 && <Badge tone="accent">{unread.length}</Badge>}
          </div>
          {notifications.length ? (
            <ul className="mt-4 flex flex-col gap-3">
              {notifications.slice(0, 4).map((notification) => (
                <li key={notification.id} className="flex gap-2.5">
                  {!notification.read && <Dot />}
                  <div className="min-w-0">
                    <p className="text-[13.5px] leading-snug text-ink">{notification.title}</p>
                    <p className="mt-0.5 text-[12px] text-muted">{formatRelative(notification.createdAt, locale)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              {pick(
                locale,
                "Здесь появятся принятые задания, промокоды и новости курсов.",
                "Accepted assignments, promo codes and course news land here.",
              )}
            </p>
          )}
        </section>

        {/* certificates */}
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[15px]">
            <Award className="h-4 w-4 text-accent" aria-hidden />
            {d.learn.certificate}
          </h2>
          {certificates.length ? (
            <ul className="mt-4 flex flex-col gap-2.5">
              {certificates.slice(0, 3).map((certificate) => (
                <li key={certificate.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[13.5px] text-ink">{certificate.courseTitle}</span>
                  <span className="shrink-0 font-mono text-[12px] text-muted">
                    {formatDate(certificate.issuedAt, locale, { month: "short", year: "numeric" })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              {pick(
                locale,
                "Первый сертификат выдаётся после приёмки финального проекта.",
                "The first certificate arrives once your final project is accepted.",
              )}
            </p>
          )}
          <Link
            href={path("/app/achievements", locale)}
            className="mt-4 inline-block text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
          >
            {d.app.achievements}
          </Link>
        </section>

        {/* giveaway or referral */}
        {activeGiveaway ? (
          <section className="rounded-lg border border-accent/35 bg-accent-soft p-5">
            <h2 className="flex items-center gap-2 text-[15px]">
              <Ticket className="h-4 w-4 text-accent-ink" aria-hidden />
              {d.nav.giveaways}
            </h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
              {pick(locale, "Активный дроп сообщества.", "A community drop is running.")}{" "}
              {activeGiveaway.chances > 0
                ? `${activeGiveaway.chances} ${d.community.chances}`
                : pick(locale, "Участие бесплатное.", "Entry is free.")}
            </p>
            <p className="mt-2 font-mono text-[12px] text-ink-3">
              {pick(locale, "до", "until")} {formatDate(activeGiveaway.endsAt, locale, { day: "numeric", month: "long" })}
            </p>
            <ButtonLink
              href={path(`/community/giveaways/${activeGiveaway.slug}`, locale)}
              variant="secondary"
              size="sm"
              className="mt-4"
            >
              {d.community.enterGiveaway}
            </ButtonLink>
          </section>
        ) : (
          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 text-[15px]">
              <Gift className="h-4 w-4 text-accent" aria-hidden />
              {d.app.referrals}
            </h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">
              {pick(
                locale,
                "Пригласите друга — он получит скидку, вы накопите бонус на следующую покупку.",
                "Invite a friend: they get a discount, you build credit towards your next purchase.",
              )}
            </p>
            <ButtonLink href={path("/app/referrals", locale)} variant="secondary" size="sm" className="mt-4">
              {d.app.referrals}
            </ButtonLink>
          </section>
        )}
      </div>

      {/* ----------------------------- recommended ----------------------------- */}
      {recommended.length > 0 && (
        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[19px]">{d.store.recommended}</h2>
              <p className="mt-1.5 text-[13px] text-muted">{d.store.recommendedBody}</p>
            </div>
            <Link
              href={path("/store", locale)}
              className="text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
            >
              {d.common.showAll}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} d={d} compact />
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 p-4">
        <CalendarDays className="h-4 w-4 text-accent" aria-hidden />
        <p className="text-[13.5px] text-ink-2">
          {pick(locale, "Ближайшие эфиры и разборы — в календаре сообщества.", "Upcoming live sessions are in the community calendar.")}
        </p>
        <Link
          href={path("/community/events", locale)}
          className="text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
        >
          {d.nav.events}
        </Link>
      </div>
    </AppPage>
  );
}
