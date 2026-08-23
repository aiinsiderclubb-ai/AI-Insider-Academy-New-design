import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/primitives/button";
import { Container } from "@/components/primitives/surface";
import { AnimatedNumber } from "@/components/primitives/display";
import { Dot } from "@/components/primitives/badge";
import { Reveal } from "@/components/motion/reveal";
import { ScrollHint } from "@/components/motion/journey";
import { pick } from "@/content/locale";
import { path, type Dictionary, type Locale } from "@/lib/i18n";

export interface HeroStats {
  courses: number;
  lessons: number;
  products: number;
  languages: number;
}

/**
 * Cinematic opener: one full-bleed frame, one marked sentence, one action.
 * The figures sit on the same dark ground so the fold reads as a single shot.
 */
export function Hero({ locale, d, stats }: { locale: Locale; d: Dictionary; stats: HeroStats }) {
  const [firstLine, secondLine] = d.home.heroTitle.split("\n");

  const figures = [
    { value: stats.courses, suffix: "", label: d.home.statsCourses },
    { value: stats.lessons, suffix: "+", label: d.home.statsLessons },
    { value: stats.products, suffix: "", label: d.home.statsProducts },
    { value: stats.languages, suffix: "", label: d.home.statsLangs },
  ];

  return (
    <section
      data-dark-hero
      className="on-dark relative isolate -mt-16 flex min-h-[94svh] flex-col overflow-hidden bg-ground"
    >
      {/* the frame */}
      <Image
        src="/design/mentor-bridge.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center saturate-[0.55] brightness-[0.78]"
      />
      <div className="scrim absolute inset-0" aria-hidden />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 12% 88%, color-mix(in oklab, #ff7a1a 22%, transparent), transparent 62%)",
        }}
      />

      {/* the words */}
      <Container size="wide" className="relative flex flex-1 items-center pt-32 pb-10 sm:pt-36">
        <div className="max-w-3xl">
          <Reveal>
            <p className="eyebrow flex items-center gap-2.5 text-ink-3">
              <Dot pulse />
              {d.home.heroKicker}
            </p>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-7 text-[clamp(2.75rem,7.6vw,5.75rem)] leading-[1.02] tracking-[-0.05em] text-ink">
              {firstLine}
              <br />
              <span className="mark">{secondLine}</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-2">{d.home.heroBody}</p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href={path("/learn", locale)} size="lg" className="group">
                {d.home.heroPrimary}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </ButtonLink>
              <ButtonLink
                href={path("/store", locale)}
                variant="secondary"
                size="lg"
                className="border-line-3 bg-[color-mix(in_oklab,var(--surface)_55%,transparent)] backdrop-blur-md"
              >
                {d.home.heroSecondary}
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <p className="mt-6 font-mono text-2xs tracking-[0.18em] text-faint uppercase">
              {pick(locale, "Доступно на русском, украинском и английском", "Available in Russian, Ukrainian and English")}
            </p>
          </Reveal>
        </div>
      </Container>

      {/* the ledger */}
      <div className="relative border-t border-line-2/60">
        <Container size="wide">
          <dl className="grid grid-cols-2 md:grid-cols-4">
            {figures.map((figure, index) => (
              <Reveal
                key={figure.label}
                as="div"
                delay={index * 70}
                distance={10}
                className="border-line-2/60 px-1 py-5 not-first:border-l md:px-5 [&:nth-child(3)]:border-l-0 md:[&:nth-child(3)]:border-l"
              >
                <dt className="sr-only">{figure.label}</dt>
                <dd>
                  <span className="block font-display text-[clamp(1.75rem,3.4vw,2.75rem)] leading-none font-extrabold tracking-tight text-ink">
                    <AnimatedNumber value={figure.value} duration={1000 + index * 140} />
                    {figure.suffix}
                  </span>
                  <span className="mt-2 block text-[12.5px] leading-snug text-muted">{figure.label}</span>
                </dd>
              </Reveal>
            ))}
          </dl>
        </Container>
      </div>

      <div className="relative pb-7">
        <ScrollHint label={pick(locale, "Листайте дальше", "Scroll to explore")} />
      </div>
    </section>
  );
}
