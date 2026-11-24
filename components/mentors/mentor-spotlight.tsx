import Link from "next/link";
import { ArrowRight, Check, Send } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Spotlight } from "@/components/motion/pointer";
import { pick } from "@/content/locale";
import { mentors, type Mentor } from "@/content/mentors";
import { path, type Dictionary, type Locale } from "@/lib/i18n";
import { MentorFaces, MentorPortrait } from "./mentor-portrait";

/**
 * "Who teaches the course": the teacher in a lit portrait beside their story,
 * and below it the team that reviews the work on the mentor plan.
 */
export function MentorSpotlight({
  mentor,
  locale,
  d,
  bio,
  mentorPlan,
}: {
  mentor: Mentor;
  locale: Locale;
  d: Dictionary;
  /** The course's own wording of the teacher's story, when it has one. */
  bio?: string;
  /** The course is sold with a mentor plan, so say who reviews. */
  mentorPlan?: boolean;
}) {
  const name = pick(locale, mentor.nameRu, mentor.name);
  const role = pick(locale, mentor.roleRu, mentor.role);

  return (
    <Reveal>
      <Spotlight className="mentor-card relative overflow-hidden rounded-[30px] border border-line-2">
        <div className="relative z-10 grid gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-16 lg:p-12">
          <MentorPortrait
            src={mentor.photo}
            alt={name}
            caption={name}
            note={pick(locale, "Ведёт этот курс", "Teaches this course")}
            className="mx-auto w-full max-w-[380px] lg:max-w-none"
          />

          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-3">
              <span className="rule-accent inline-block w-7" aria-hidden />
              {d.learn.instructor}
            </p>
            <h2 className="mt-5 font-display text-[clamp(2.6rem,6vw,4.5rem)] leading-[0.92] font-extrabold tracking-[-0.035em]">
              {name}
            </h2>
            <p className="mt-4 text-[14px] font-medium text-accent-ink">{role}</p>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-2">
              {bio || pick(locale, mentor.bioRu, mentor.bio)}
            </p>

            {mentor.facts.length > 0 && (
              <ul className="mt-7 flex flex-wrap gap-2">
                {mentor.facts.map((fact) => (
                  <li
                    key={fact.en}
                    className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface-2/80 px-3.5 py-1.5 text-[13px] text-ink-2"
                  >
                    <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
                    {pick(locale, fact.ru, fact.en)}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-9 flex flex-wrap items-center justify-between gap-5 border-t border-line pt-7">
              <div className="flex items-center gap-4">
                <MentorFaces people={mentors.map((m) => ({ photo: m.photo, name: pick(locale, m.nameRu, m.name) }))} />
                <p className="max-w-xs text-[13.5px] leading-snug text-ink-3">
                  {mentorPlan
                    ? pick(
                        locale,
                        "В тарифе «С ментором» ваши работы проверяет команда менторов.",
                        "On the mentor plan your work is reviewed by the mentor team.",
                      )
                    : pick(locale, "Команда, которая ведёт курсы Академии.", "The team behind the Academy's courses.")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {mentor.links?.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink-2 transition-colors hover:text-accent-ink"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden />
                    {link.label}
                  </a>
                ))}
                <Link
                  href={path("/mentors", locale)}
                  className="group inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent-ink"
                >
                  {pick(locale, "Все менторы", "All mentors")}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Spotlight>
    </Reveal>
  );
}
