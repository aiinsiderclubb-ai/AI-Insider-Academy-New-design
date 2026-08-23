import "server-only";
import coursesContent from "@/content/data/courses.json";
import { CLUB_INCLUDED_PAID_IDS, DIFFICULTY, HIDDEN_COURSE_IDS, PRO_ONLY_COURSE_IDS } from "@/content/site";
import { programFor, toModules } from "@/content/catalog";
import { field, pick } from "@/content/locale";
import type { Locale } from "@/lib/i18n/config";
import { tryApi } from "./http";
import type { ApiCourse, ApiLesson } from "./types";

/* ------------------------------- view models ------------------------------- */

export type BadgeKey = "new" | "hit" | "trend2026";

export interface Lesson {
  index: number;
  id: string;
  title: string;
  description: string;
  duration: string;
  videoUrl: string | null;
  /** Lesson 1 is always open; the rest follow the course's access rules. */
  free: boolean;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  idea: string;
  category: string;
  categoryLabel: string;
  level: "basic" | "pro";
  difficulty: 1 | 2 | 3;
  difficultyLabel: string;
  status: "published" | "in-development";
  stage: string;
  priceEur: number;
  oldPriceEur: number | null;
  isFree: boolean;
  isIntake: boolean;
  isProOnly: boolean;
  inClub: boolean;
  image: string;
  badge: BadgeKey | null;
  lessonCount: number;
  durationLabel: string;
  audience: string[];
  goals: string[];
  skills: string[];
  tools: string[];
  finalProject: string;
  hasHomework: boolean;
  contentLocked: boolean;
  lessons: Lesson[];
  faq: { q: string; a: string }[];
}

/* --------------------------------- sources --------------------------------- */

type ContentCourse = (typeof coursesContent.courses)[number] & Record<string, unknown>;

const contentCourses = coursesContent.courses as unknown as ContentCourse[];

/** Content stores badge keys; the label is chosen at render time. */
const BADGE_KEYS: Record<string, BadgeKey> = {
  new: "new",
  hit: "hit",
  "trend-2026": "trend2026",
  trending: "trend2026",
};

function badgeOf(raw: unknown): BadgeKey | null {
  if (typeof raw !== "string") return null;
  return BADGE_KEYS[raw] ?? null;
}

function toLessons(source: ApiLesson[] | ContentCourse["lessons"], locale: Locale, isFree: boolean): Lesson[] {
  return (source as ApiLesson[]).map((lesson, index) => ({
    index,
    id: lesson.id ?? `lesson-${index + 1}`,
    title: field(lesson as unknown as Record<string, string>, "title", locale),
    description: field(lesson as unknown as Record<string, string>, "description", locale),
    duration: field(lesson as unknown as Record<string, string>, "duration", locale),
    videoUrl: lesson.videoUrl ?? null,
    free: isFree || index === 0,
  }));
}

function mergeCourse(content: ContentCourse, live: ApiCourse | undefined, locale: Locale): Course {
  const id = content.id;
  const priceEur = Number(content.priceEur ?? 0);
  const isFree = Boolean(content.isFreeTrial) || priceEur === 0;
  const isIntake = id === "ai-insider-accelerator";
  const difficulty = (Number(content.difficulty) || (isFree ? 1 : 3)) as 1 | 2 | 3;
  const lessonsSource = (live?.lessons?.length ? live.lessons : content.lessons) ?? [];
  const program = programFor(id);

  return {
    id,
    slug: String(content.slug ?? id),
    title: field(content as Record<string, string>, "title", locale),
    summary: field(content as Record<string, string>, "shortDescription", locale),
    description: field(content as Record<string, string>, "fullDescription", locale),
    idea: field(content as Record<string, string>, "courseIdea", locale),
    category: String(content.category ?? ""),
    categoryLabel: field(content as Record<string, string>, "category", locale),
    level: String(content.level).toLowerCase() === "pro" ? "pro" : "basic",
    difficulty,
    difficultyLabel: pick(locale, DIFFICULTY[String(difficulty)]?.ru ?? "", DIFFICULTY[String(difficulty)]?.en ?? ""),
    status: (content.status as Course["status"]) ?? (lessonsSource.length ? "published" : "in-development"),
    stage: String(content.stage ?? ""),
    priceEur,
    oldPriceEur: content.oldPriceEur ? Number(content.oldPriceEur) : null,
    isFree,
    isIntake,
    isProOnly: PRO_ONLY_COURSE_IDS.includes(id),
    inClub: CLUB_INCLUDED_PAID_IDS.includes(id) || isFree,
    image: String(content.image ?? ""),
    badge: badgeOf(content.badge),
    lessonCount: lessonsSource.length,
    durationLabel:
      (locale === "en" ? program?.countLabel.en : program?.countLabel.ru) ??
      field(content as Record<string, string>, "duration", locale),
    audience: (field(content as Record<string, string[]>, "forAudience", locale) as string[]) ?? [],
    goals: (field(content as Record<string, string[]>, "goals", locale) as string[]) ?? [],
    skills: (field(content as Record<string, string[]>, "skills", locale) as string[]) ?? [],
    tools: (field(content as Record<string, string[]>, "tools", locale) as string[]) ?? [],
    finalProject: field(content as Record<string, string>, "finalProject", locale),
    // Paid programmes always carry assignments and a certificate; the
    // content flag only adds them to otherwise-free tracks such as the intake.
    hasHomework: Boolean(content.hasHomework) || !isFree,
    contentLocked: live?.contentLocked ?? !isFree,
    lessons: toLessons(lessonsSource, locale, isFree),
    faq: Array.isArray(content.faq)
      ? (content.faq as { q: string; qEn?: string; a: string; aEn?: string }[]).map((entry) => ({
          q: locale === "en" ? (entry.qEn ?? entry.q) : entry.q,
          a: locale === "en" ? (entry.aEn ?? entry.a) : entry.a,
        }))
      : [],
  };
}

/* ---------------------------------- queries -------------------------------- */

/**
 * Catalogue for a locale. Content files are the shelf (they carry pricing,
 * badges and the two unreleased courses); the API supplies live lesson data
 * and lock state where it knows the course.
 */
export async function getCourses(locale: Locale): Promise<Course[]> {
  const live = await tryApi<ApiCourse[]>("/courses", { revalidate: 120, tags: ["courses"] }, []);
  const liveById = new Map(live.map((course) => [course.id, course]));

  return contentCourses
    .filter((course) => !course.catalogHidden && !HIDDEN_COURSE_IDS.includes(course.id))
    .map((course) => mergeCourse(course, liveById.get(course.id), locale));
}

export async function getCourse(slug: string, locale: Locale): Promise<Course | null> {
  const courses = await getCourses(locale);
  return courses.find((course) => course.slug === slug || course.id === slug) ?? null;
}

export interface CatalogGroups {
  paid: Course[];
  free: Course[];
  intake: Course[];
  soon: Course[];
}

/** The four shelves the catalogue page is built from. */
export function groupCourses(courses: Course[]): CatalogGroups {
  return {
    paid: courses.filter((c) => !c.isFree && !c.isIntake && c.status === "published"),
    free: courses.filter((c) => c.isFree && !c.isIntake),
    intake: courses.filter((c) => c.isIntake),
    soon: courses.filter((c) => c.status === "in-development"),
  };
}

/** Course modules for the curriculum accordion. */
export function courseModules(course: Course) {
  return toModules(course.lessons);
}
