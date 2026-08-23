import packs from "./data/coursePacks.json";
import packDetails from "./data/coursePackDetails.json";
import vault from "./data/vaultProducts.json";
import vaultDetails from "./data/vaultDetails.json";
import map from "./data/learningMap.json";
import paths from "./data/learningPaths.json";
import programs from "./data/courseLessonPrograms.json";
import homework from "./data/courseHomework.json";
import landing from "./data/courseLanding.json";
import profiles from "./data/courseProfiles.json";

/* ---------------------------------- bundles -------------------------------- */

export interface CourseBundle {
  id: string;
  slug?: string;
  title: string;
  descRu: string;
  descEn: string;
  courseIds: string[];
  includes: string[];
  bonusRu: string[];
  bonusEn: string[];
  priceEur: number;
  oldPriceEur: number;
  featured?: boolean;
  badgeRu?: string;
  badgeEn?: string;
}

export const courseBundles = packs.COURSE_BUNDLES as unknown as CourseBundle[];
export const coursePackDetails = packDetails as Record<string, unknown>;

export function bundleById(id: string) {
  return courseBundles.find((bundle) => bundle.id === id);
}

/** Bundles that contain a given course, cheapest first. */
export function bundlesWithCourse(courseId: string) {
  return courseBundles
    .filter((bundle) => bundle.courseIds.includes(courseId))
    .sort((a, b) => a.priceEur - b.priceEur);
}

/* ----------------------------------- vault --------------------------------- */

export interface VaultProduct {
  id: string;
  slug: string;
  titleRu: string;
  titleEn: string;
  shortRu: string;
  shortEn: string;
  priceEur: number;
  icon: string;
  coverImage: string;
  highlightRu: string;
  highlightEn: string;
  accent: string;
  gradient: string;
  categoryRu: string;
  categoryEn?: string;
}

export const vaultProducts = vault.VAULT_PRODUCTS as unknown as VaultProduct[];
export const vaultBundle = vault.VAULT_COMPLETE_BUNDLE as unknown as {
  id: string;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  priceEur: number;
  oldPriceEur: number;
  productIds: string[];
};
export const vaultHub = vault.VAULT_HUB as unknown as {
  id: string;
  titleRu: string;
  titleEn: string;
  leadRu: string;
  leadEn: string;
  audienceRu: string[];
  audienceEn: string[];
  priceFromEur: number;
  priceToEur: number;
  stats: { value: string; labelRu: string; labelEn: string }[];
  benefitsRu: string[];
  benefitsEn: string[];
};
export const vaultProductDetails = vaultDetails as Record<string, unknown>;

/* ------------------------------- learning path ----------------------------- */

export interface LearningStage {
  id: string;
  order: number;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn: string;
  accent: string;
  courseIds: string[];
  note?: string;
  noteEn?: string;
}

export const learningStages = map.LEARNING_STAGES as unknown as LearningStage[];
export const stageByCourse = map.STAGE_BY_COURSE as Record<string, string>;
export const academyPrinciples = map.ACADEMY_PRINCIPLES as { ru: string; en: string };
export const learningPaths = paths as Record<string, unknown>;

/* ------------------------------ lesson programs ---------------------------- */

export interface ProgramLesson {
  num: number;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
}

export interface LessonProgram {
  duration: { ru: string; en: string };
  countLabel: { ru: string; en: string };
  lessons: ProgramLesson[];
}

const lessonPrograms = programs.LESSON_PROGRAMS as unknown as Record<string, LessonProgram>;

export function programFor(courseId: string): LessonProgram | undefined {
  return lessonPrograms[courseId];
}

/**
 * The catalogue has no module metadata, so lessons are grouped in fives — the
 * same rhythm the curriculum was written in. Grouping happens here rather than
 * in a component so every surface splits a course identically.
 */
export function toModules<T>(lessons: T[], size = 5): T[][] {
  const modules: T[][] = [];
  for (let index = 0; index < lessons.length; index += size) {
    modules.push(lessons.slice(index, index + size));
  }
  return modules;
}

/* --------------------------------- homework -------------------------------- */

export interface HomeworkSpec {
  tasks: string;
  tasksEn: string;
  deliverables: string;
  deliverablesEn: string;
  criteria: string;
  criteriaEn: string;
}

export const defaultHomework = homework.DEFAULT_LESSON_HOMEWORK as unknown as HomeworkSpec;
export const homeworkByCourse = homework.HOMEWORK_BY_COURSE as Record<string, unknown>;
export const gradingStandard = homework.ACADEMY_GRADING_STANDARD as unknown as Record<
  "ru" | "en",
  { title: string; levels: { name: string; desc: string }[] }
>;

/* ------------------------------ landing content ---------------------------- */

export interface FaqEntry {
  q: string;
  qEn: string;
  a: string;
  aEn: string;
}

export const courseFaq = landing.COURSE_FAQ as unknown as FaqEntry[];
export const buyFaq = landing.BUY_FAQ as unknown as FaqEntry[];
export const instructor = landing.INSTRUCTOR as unknown as {
  name: string;
  nameRu: string;
  role: string;
  roleRu: string;
  bio: string;
  bioRu: string;
  highlights?: string[];
  highlightsRu?: string[];
};
export const socialProof = landing.SOCIAL_PROOF as unknown as {
  courses: number;
  lessons: string;
  community: string;
  communityLabelRu: string;
  communityLabelEn: string;
  certificateNoteRu: string;
  certificateNoteEn: string;
};

/* -------------------------------- profiles --------------------------------- */

export interface CourseProfile {
  shortDescription?: string;
  shortDescriptionEn?: string;
  fullDescription?: string;
  fullDescriptionEn?: string;
  courseIdea?: string;
  courseIdeaEn?: string;
  forAudience?: string[];
  forAudienceEn?: string[];
  goals?: string[];
  goalsEn?: string[];
  prerequisites?: string[];
  prerequisitesEn?: string[];
  finalProject?: string;
  finalProjectEn?: string;
}

const courseProfiles = profiles.COURSE_PROFILES as unknown as Record<string, CourseProfile>;

export function profileFor(courseId: string): CourseProfile | undefined {
  return courseProfiles[courseId];
}
