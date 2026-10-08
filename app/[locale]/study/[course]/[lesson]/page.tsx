import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StudyRoom, type StudyHomework, type StudyLesson } from "@/components/study/study-room";
import type { StudyMaterial } from "@/components/study/lesson-materials";
import { defaultHomework, lessonHomework, lessonMaterials, type HomeworkSpec } from "@/content/catalog";
import { pick } from "@/content/locale";
import { getCourse } from "@/lib/api/catalog";
import { canOpenLesson, getAccess, getMe } from "@/lib/api/session";
import { getDictionary, path, type Locale } from "@/lib/i18n";
import { lessonVideoUrl } from "@/lib/video/r2";

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

  /*
   * A locked lesson's film is withheld here rather than in the player. The
   * client receives every lesson in the rail, so handing it the URL and relying
   * on `unlocked` to decide what to render would ship a working link for
   * content the learner has not paid for — visible to anyone who opens the page
   * source. Locked lessons therefore carry no URL at all, and open ones carry a
   * freshly signed, expiring one.
   */
  const lessons: StudyLesson[] = course.lessons.map((lesson) => {
    const unlocked = canOpenLesson(access, course, lesson.index);
    return {
      index: lesson.index,
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      duration: lesson.duration,
      videoUrl: unlocked ? lessonVideoUrl(lesson.videoUrl) : null,
      unlocked,
    };
  });

  const current = lessons[index];

  const localised = (spec: HomeworkSpec, selfCheck: boolean): StudyHomework => ({
    tasks: pick(locale, spec.tasks, spec.tasksEn),
    deliverables: pick(locale, spec.deliverables, spec.deliverablesEn),
    criteria: pick(locale, spec.criteria, spec.criteriaEn),
    selfCheck,
  });

  /*
   * An assignment written for this lesson wins, and is practice: the learner
   * checks it against the criteria and nothing is sent in. Otherwise a reviewed
   * course falls back to the shared wording from its second lesson on — the
   * first is the free sample and has never carried one.
   */
  const own = lessonHomework(course.id, current.id);
  const homework: StudyHomework | null = own
    ? localised(own, true)
    : course.hasHomework && index > 0
      ? localised(defaultHomework, false)
      : null;

  /* Each entry is narrowed to the one shape its kind needs, in the learner's language. */
  const materials: StudyMaterial[] = lessonMaterials(course.id, current.id).flatMap((item): StudyMaterial[] => {
    const title = pick(locale, item.title, item.titleEn);
    const note = pick(locale, item.note, item.noteEn);
    if (item.kind === "copy" && item.text) {
      return [{ kind: "copy", title, note, text: pick(locale, item.text, item.textEn ?? item.text), code: Boolean(item.code) }];
    }
    if (item.kind === "file" && item.href) return [{ kind: "file", title, note, href: item.href }];
    if (item.kind === "link" && item.url) return [{ kind: "link", title, note, url: item.url }];
    return [];
  });

  return (
    <StudyRoom
      locale={locale}
      d={d}
      course={{ id: course.id, slug: course.slug, title: course.title, lessonCount: course.lessonCount }}
      lessons={lessons}
      current={current}
      homework={homework}
      materials={materials}
      watched={access.progress[course.id]?.watched ?? []}
      canSubmitHomework={current.unlocked && !access.prelaunch}
    />
  );
}
