import type { Metadata } from "next";
import { Award, Flame, Medal, Target } from "lucide-react";
import { AppPage } from "@/components/app/page-header";
import { Badge } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import { ProgressRing } from "@/components/primitives/display";
import { EmptyState } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { courseCompletion, getAccess, getCertificates, getMe } from "@/lib/api/session";
import { formatDate, getDictionary, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function AchievementsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [me, access, courses, certificates] = await Promise.all([
    getMe(),
    getAccess(),
    getCourses(locale),
    getCertificates(),
  ]);
  if (!me) return null;

  const owned = courses.filter((course) => course.isFree || access.courseIds.has(course.id) || access.tier === "pro");
  const lessonsDone = owned.reduce((sum, course) => sum + courseCompletion(access, course.id, course.lessonCount).done, 0);
  const lessonsTotal = owned.reduce((sum, course) => sum + course.lessonCount, 0);
  const overall = lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;

  const milestones = [
    { id: "first-lesson", label: pick(locale, "Первый урок", "First lesson"), reached: lessonsDone >= 1 },
    { id: "five-lessons", label: pick(locale, "5 уроков", "5 lessons"), reached: lessonsDone >= 5 },
    { id: "first-course", label: pick(locale, "Первый курс завершён", "First course completed"), reached: owned.some((course) => courseCompletion(access, course.id, course.lessonCount).percent === 100) },
    { id: "streak-7", label: pick(locale, "7 дней подряд", "7-day streak"), reached: me.streak.current >= 7 },
    { id: "certificate", label: pick(locale, "Первый сертификат", "First certificate"), reached: certificates.length > 0 },
  ];

  return (
    <AppPage
      eyebrow={d.app.achievements}
      title={pick(locale, "Ваш прогресс", "Your progress")}
      body={pick(
        locale,
        "Пройденные уроки, серия дней и сертификаты, которые можно показать работодателю.",
        "Lessons completed, your streak, and certificates you can show an employer.",
      )}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-5 rounded-lg border border-line bg-surface p-6">
          <ProgressRing value={overall} size={84}>
            <span className="font-display text-[1.25rem] leading-none font-extrabold tabular-nums">{overall}%</span>
          </ProgressRing>
          <div>
            <p className="eyebrow">{d.study.progress}</p>
            <p className="mt-2 text-[14px] text-ink-2 tabular-nums">
              {lessonsDone} / {lessonsTotal}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-6">
          <div>
            <p className="eyebrow">{pick(locale, "Серия дней", "Streak")}</p>
            <p className="mt-2 font-display text-[2rem] leading-none font-extrabold tabular-nums">{me.streak.current}</p>
            <p className="mt-1.5 text-[12.5px] text-muted">
              {pick(locale, "лучший результат", "personal best")}: {me.streak.best ?? me.streak.current}
            </p>
          </div>
          <Flame className={me.streak.current > 0 ? "h-8 w-8 text-accent" : "h-8 w-8 text-line-3"} aria-hidden />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-6">
          <div>
            <p className="eyebrow">{d.learn.certificate}</p>
            <p className="mt-2 font-display text-[2rem] leading-none font-extrabold tabular-nums">{certificates.length}</p>
            <p className="mt-1.5 text-[12.5px] text-muted">{pick(locale, "выдано", "issued")}</p>
          </div>
          <Award className={certificates.length ? "h-8 w-8 text-accent" : "h-8 w-8 text-line-3"} aria-hidden />
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 text-[17px]">
          <Target className="h-4 w-4 text-accent" aria-hidden />
          {pick(locale, "Вехи", "Milestones")}
        </h2>
        <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {milestones.map((milestone) => (
            <li key={milestone.id} className="flex items-center gap-3 bg-surface p-4">
              <Medal
                className={milestone.reached ? "h-5 w-5 shrink-0 text-accent" : "h-5 w-5 shrink-0 text-line-3"}
                aria-hidden
              />
              <span className={milestone.reached ? "text-[14px] text-ink" : "text-[14px] text-muted"}>
                {milestone.label}
              </span>
              {milestone.reached && <Badge tone="success" className="ml-auto">✓</Badge>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-[17px]">{d.learn.certificate}</h2>
        {certificates.length ? (
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {certificates.map((certificate) => (
              <li key={certificate.id} className="flex items-center justify-between gap-4 bg-surface p-4">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink">{certificate.courseTitle}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">{formatDate(certificate.issuedAt, locale)}</p>
                </div>
                {certificate.fileUrl && (
                  <ButtonLink href={certificate.fileUrl} variant="secondary" size="sm" target="_blank" rel="noreferrer">
                    {d.common.download}
                  </ButtonLink>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Award className="h-5 w-5" aria-hidden />}
            title={pick(locale, "Сертификат ждёт финального проекта", "Your certificate is waiting on a final project")}
            body={pick(
              locale,
              "Пройдите все уроки платной программы и сдайте финальный проект — именной PDF появится здесь.",
              "Finish every lesson of a paid programme and submit the final project — the named PDF appears here.",
            )}
            action={
              <ButtonLink href={path("/app/learning", locale)} size="sm">
                {d.app.learning}
              </ButtonLink>
            }
          />
        )}
      </section>
    </AppPage>
  );
}
