import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { StudioPage } from "@/components/studio/studio-shell";
import { Cell, DataTable, Panel, Row, StatTile } from "@/components/studio/tiles";
import { Badge } from "@/components/primitives/badge";
import { Note } from "@/components/primitives/states";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { getStudioDashboard } from "@/lib/api/studio";
import { formatNumber, formatPrice, getDictionary, path, type Locale } from "@/lib/i18n";

export default async function StudioCoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;

  const [dashboard, courses] = await Promise.all([getStudioDashboard(), getCourses(locale)]);
  if (!dashboard) return null;

  const lessons = courses.reduce((sum, course) => sum + course.lessonCount, 0);
  const withoutVideo = courses.reduce(
    (sum, course) => sum + course.lessons.filter((lesson) => !lesson.videoUrl).length,
    0,
  );
  const clicks = dashboard.analytics?.courseClicks ?? {};

  return (
    <StudioPage
      title={pick(locale, "Курсы", "Courses")}
      body={pick(
        locale,
        "Каталог, уроки и готовность контента к публикации.",
        "The catalogue, its lessons and how ready the content is to ship.",
      )}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={pick(locale, "Программ", "Programmes")} value={formatNumber(courses.length, locale)} />
        <StatTile label={pick(locale, "Уроков", "Lessons")} value={formatNumber(lessons, locale)} />
        <StatTile
          label={pick(locale, "Уроков без видео", "Lessons without video")}
          value={formatNumber(withoutVideo, locale)}
          tone={withoutVideo > 0 ? "warning" : "good"}
          hint={pick(locale, "их плеер показывает заглушку", "the player shows a placeholder for these")}
        />
        <StatTile
          label={pick(locale, "Готовятся к выпуску", "In production")}
          value={formatNumber(courses.filter((course) => course.status === "in-development").length, locale)}
        />
      </section>

      {withoutVideo > 0 && (
        <Note tone="warning" className="mb-6">
          <span className="inline-flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            {pick(
              locale,
              `Видео отсутствует у ${withoutVideo} уроков. Пока файла нет, урок открывается с честной заглушкой и кнопкой подписки на анонс.`,
              `${withoutVideo} lessons have no video file. Until one exists the lesson opens with an honest placeholder and a notify button.`,
            )}
          </span>
        </Note>
      )}

      <Panel title={pick(locale, "Каталог", "Catalogue")}>
        <DataTable
          caption={pick(locale, "Курсы", "Courses")}
          columns={[
            { key: "title", label: pick(locale, "Программа", "Programme") },
            { key: "category", label: pick(locale, "Направление", "Track") },
            { key: "lessons", label: pick(locale, "Уроки", "Lessons"), align: "right" },
            { key: "video", label: pick(locale, "Видео", "Video"), align: "right" },
            { key: "price", label: pick(locale, "Цена", "Price"), align: "right" },
            { key: "clicks", label: pick(locale, "Клики", "Clicks"), align: "right" },
            { key: "open", label: "", align: "right" },
          ]}
          empty={pick(locale, "Курсов нет", "No courses")}
        >
          {courses.map((course) => {
            const missing = course.lessons.filter((lesson) => !lesson.videoUrl).length;
            return (
              <Row key={course.id}>
                <Cell strong>
                  <span className="flex flex-wrap items-center gap-2">
                    {course.title}
                    {course.status === "in-development" && <Badge tone="warning">soon</Badge>}
                    {course.isProOnly && <Badge tone="accent">pro</Badge>}
                  </span>
                </Cell>
                <Cell>{course.categoryLabel}</Cell>
                <Cell align="right" mono>
                  {course.lessonCount}
                </Cell>
                <Cell align="right">
                  <Badge tone={missing === 0 ? "success" : missing === course.lessonCount ? "danger" : "warning"}>
                    {course.lessonCount - missing}/{course.lessonCount}
                  </Badge>
                </Cell>
                <Cell align="right" mono>
                  {course.isFree ? "0 €" : formatPrice(course.priceEur, locale)}
                </Cell>
                <Cell align="right" mono>
                  {formatNumber(Number(clicks[course.id]) || 0, locale)}
                </Cell>
                <Cell align="right">
                  <Link
                    href={path(`/learn/${course.slug}`, locale)}
                    className="inline-flex items-center gap-1 text-accent-ink hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      </Panel>
    </StudioPage>
  );
}
