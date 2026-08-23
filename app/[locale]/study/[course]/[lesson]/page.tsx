import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StudyRoom, type StudyHomework, type StudyLesson } from "@/components/study/study-room";
import { defaultHomework } from "@/content/catalog";
import { pick } from "@/content/locale";
import { getCourse } from "@/lib/api/catalog";
import { canOpenLesson, getAccess, getMe } from "@/lib/api/session";
import { getDictionary, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function StudyPage({
  params,
}: {
  params: Promise<{ locale: string; course: string; lesson: string }>;
}) {
  const { locale: raw, course: slug, lesson: lessonParam } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const me = await getMe();
  if (!me) redirect(path(`/login?next=${encodeURIComponent(`/${locale}/study/${slug}/${lessonParam}`)}`, locale));

  const course = await getCourse(slug, locale);
  if (!course || course.lessons.length === 0) notFound();

  const requested = Number(lessonParam);
  if (!Number.isFinite(requested) || requested < 1) redirect(path(`/study/${slug}/1`, locale));
  const index = Math.min(Math.max(1, Math.trunc(requested)), course.lessons.length) - 1;

  const access = await getAccess();

  const lessons: StudyLesson[] = course.lessons.map((lesson) => ({
    index: lesson.index,
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    duration: lesson.duration,
    videoUrl: lesson.videoUrl,
    unlocked: canOpenLesson(access, course, lesson.index),
  }));

  const current = lessons[index];

  const homework: StudyHomework | null =
    course.hasHomework && index > 0
      ? {
          task: pick(locale, defaultHomework.tasks, defaultHomework.tasksEn),
          deliverable: pick(locale, defaultHomework.deliverables, defaultHomework.deliverablesEn),
          criteria: pick(locale, defaultHomework.criteria, defaultHomework.criteriaEn),
        }
      : null;

  return (
    <StudyRoom
      locale={locale}
      d={d}
      course={{ id: course.id, slug: course.slug, title: course.title, lessonCount: course.lessonCount }}
      lessons={lessons}
      current={current}
      homework={homework}
      watched={access.progress[course.id]?.watched ?? []}
      canSubmitHomework={current.unlocked && !access.prelaunch}
    />
  );
}
