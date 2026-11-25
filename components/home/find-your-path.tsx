import { ArrowRight, CheckCircle2, Compass, Gift, MailCheck } from "lucide-react";
import { CourseTrailer } from "@/components/catalog/course-trailer";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { courseTrailer, courseWallpaper } from "@/content/covers";
import { pick } from "@/content/locale";
import type { Course } from "@/lib/api/catalog";
import { path, type Locale } from "@/lib/i18n";

/**
 * «Найди своё в AI» on its own: free, by application, and the door into the
 * paid programmes — an approved applicant also gets the first paid course free.
 */
export function FindYourPath({ course, locale }: { course: Course; locale: Locale }) {
  const facts = [
    pick(locale, "12 уроков", "12 lessons"),
    pick(locale, "9 направлений AI", "9 AI directions"),
    pick(locale, "куратор проверяет задания", "a curator reviews your work"),
    pick(locale, "проект в портфолио", "a portfolio project"),
  ];
  const steps = [
    {
      icon: Compass,
      title: pick(locale, "Заявка за 3 минуты", "Apply in 3 minutes"),
      body: pick(locale, "Пара вопросов о вас и о том, чего хотите от AI.", "A few questions about you and what you want from AI."),
    },
    {
      icon: MailCheck,
      title: pick(locale, "Одобрение — письмо на почту", "Approval lands in your inbox"),
      body: pick(locale, "Программа сразу открывается в кабинете.", "The programme opens in your account right away."),
    },
    {
      icon: Gift,
      title: pick(locale, "Бонусы для участников", "Bonuses for participants"),
      body: pick(locale, "Одобренные участники получают бонусы — подробности придут на почту.", "Approved participants get bonuses — the details arrive by email."),
    },
  ];

  return (
    <section id="find-your-path" className="relative isolate overflow-hidden py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(42rem 28rem at 72% 40%, color-mix(in oklab, #a855f7 14%, transparent), transparent 70%), radial-gradient(28rem 18rem at 20% 80%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 70%)",
        }}
      />
      <Container size="wide" className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <div>
          <Reveal>
            <SectionHead
              eyebrow={pick(locale, "Бесплатно · по заявке", "Free · by application")}
              title={course.title}
              body={course.idea || course.description}
            />
          </Reveal>

          <Reveal delay={80}>
            <ul className="flex flex-wrap gap-2">
              {facts.map((fact) => (
                <li key={fact} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-ink-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent" aria-hidden />
                  {fact}
                </li>
              ))}
            </ul>
          </Reveal>

          <RevealGroup step={80} className="mt-8 flex flex-col gap-4">
            {steps.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent-soft text-accent">
                  <step.icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] tabular-nums text-faint">{String(index + 1).padStart(2, "0")}</span>
                    <span className="text-[15px] font-medium text-ink">{step.title}</span>
                  </span>
                  <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-3">{step.body}</span>
                </span>
              </div>
            ))}
          </RevealGroup>

          <Reveal delay={200}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href={path(`/learn/${course.slug}/apply`, locale)} size="lg" className="group">
                {pick(locale, "Подать заявку", "Apply")}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </ButtonLink>
              <ButtonLink href={path(`/learn/${course.slug}`, locale)} size="lg" variant="ghost">
                {pick(locale, "О программе", "About the programme")}
              </ButtonLink>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <CourseTrailer
            src={courseTrailer(course.slug)}
            poster={courseWallpaper(course.image, course.slug)}
            label={pick(locale, "Промо программы", "Programme promo")}
            soonLabel={pick(locale, "Промо скоро", "Promo coming")}
            playLabel={pick(locale, "Смотреть промо", "Play the promo")}
            facts={[]}
            artwork
          />
        </Reveal>
      </Container>
    </section>
  );
}
