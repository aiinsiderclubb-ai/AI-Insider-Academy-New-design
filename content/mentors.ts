import { instructor, instructorFor, type Instructor } from "./catalog";

/**
 * The people who teach the courses and review the work.
 *
 * Course pages still take the teacher of a course from `instructorFor`; this
 * adds what a person needs to be shown as a person — a photo, a general bio
 * that is not about one course, a few facts — and the mentors page lists them.
 */
export interface Mentor {
  id: string;
  name: string;
  nameRu: string;
  role: string;
  roleRu: string;
  bio: string;
  bioRu: string;
  photo: string;
  facts: { ru: string; en: string }[];
  /** Mentors who only review work and teach no course of their own. */
  reviewsOnly?: boolean;
  links?: { label: string; href: string }[];
}

const founder = instructor as Instructor & { statsRu?: string[]; statsEn?: string[]; telegram?: string };

export const mentors: Mentor[] = [
  {
    id: "vladyslav",
    name: founder.name,
    nameRu: founder.nameRu,
    role: founder.role,
    roleRu: founder.roleRu,
    bio: founder.bio,
    bioRu: founder.bioRu,
    photo: "/mentors/vladyslav.jpg",
    facts: (founder.statsRu ?? []).map((ru, i) => ({ ru, en: founder.statsEn?.[i] ?? ru })),
    links: founder.telegram ? [{ label: "Telegram", href: founder.telegram }] : [],
  },
  {
    id: "yuliia",
    name: "Yuliia",
    nameRu: "Yuliia",
    role: "Co-owner, AI Insider and AI Insider Academy · mentor",
    roleRu: "Совладелица AI Insider и AI Insider Academy · ментор",
    bio: "An experienced programmer who has worked with automation for more than two years. To her, AI is a working tool first and an impressive technology second — so her lessons hold only the scenarios that take routine out of an ordinary working day.",
    bioRu:
      "Опытный программист, больше двух лет работает с автоматизациями. Для неё AI — в первую очередь рабочий инструмент, а не эффектная технология, поэтому в её уроках только те сценарии, которые убирают рутину из обычного рабочего дня.",
    photo: "/mentors/yuliia.jpg",
    facts: [
      { ru: "Совладелица AI Insider", en: "Co-owner of AI Insider" },
      { ru: "2+ года в автоматизациях", en: "2+ years in automation" },
      { ru: "Программист", en: "Software engineer" },
    ],
  },
  {
    id: "dmitry",
    name: "Dmitry",
    nameRu: "Дмитрий",
    role: "Mentor, AI Insider Academy",
    roleRu: "Ментор AI Insider Academy",
    bio: "Reviews learners' assignments on the mentor plan: goes through each piece of work against the criteria, answers questions and signs off the final project.",
    bioRu:
      "Проверяет задания учеников на тарифе «С ментором»: разбирает каждую работу по критериям, отвечает на вопросы и принимает финальный проект.",
    photo: "/mentors/dmitry.jpg",
    facts: [
      { ru: "Проверка заданий", en: "Assignment review" },
      { ru: "Приёмка финальных проектов", en: "Final project sign-off" },
    ],
    reviewsOnly: true,
  },
];

/** The mentor behind a course's instructor entry, matched by name. */
export function mentorForCourse(courseId: string): Mentor {
  const teacher = instructorFor(courseId);
  return mentors.find((mentor) => mentor.name === teacher.name) ?? mentors[0];
}

/** Ids of the courses a mentor teaches, out of the given ones. */
export function coursesTaughtBy<T extends { id: string }>(mentor: Mentor, courses: T[]): T[] {
  if (mentor.reviewsOnly) return [];
  return courses.filter((course) => instructorFor(course.id).name === mentor.name);
}
