import Image from "next/image";
import { ArrowRight, Award, BadgeCheck, FileCheck2, GraduationCap } from "lucide-react";
import { ArtParallax } from "@/components/catalog/art-parallax";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { pick } from "@/content/locale";
import { path, type Locale } from "@/lib/i18n";

/**
 * The certificate, floating. It is issued on the mentor plan once the final
 * project is accepted, so the copy promises exactly that — no more.
 */
export function CertificateShowcase({ locale }: { locale: Locale }) {
  const steps = [
    {
      icon: GraduationCap,
      title: pick(locale, "Пройдите курс", "Finish the course"),
      body: pick(locale, "Все уроки — в своём темпе, доступ навсегда.", "Every lesson, at your own pace, yours for good."),
    },
    {
      icon: FileCheck2,
      title: pick(locale, "Сдайте задания ментору", "Hand your work to a mentor"),
      body: pick(locale, "Ментор проверяет каждую работу и принимает финальный проект.", "A mentor reviews each assignment and signs off the final project."),
    },
    {
      icon: BadgeCheck,
      title: pick(locale, "Получите сертификат", "Receive the certificate"),
      body: pick(
        locale,
        "Именной, с уникальным номером, на русском и на английском — появится в кабинете, его можно скачать и добавить в LinkedIn.",
        "In your name, with a unique number, in English and in Russian — it appears in your account, ready to download and add to LinkedIn.",
      ),
    },
  ];

  // Two copies of every certificate: the reader's language in front, the other one behind it.
  const ru = { src: "/certificates/ai-content-creator-ru.png", alt: pick(locale, "Сертификат на русском — пример", "The Russian certificate — a sample") };
  const en = { src: "/certificates/ai-agency-builder-en.png", alt: pick(locale, "Сертификат на английском — пример", "The English certificate — a sample") };
  const [front, back] = locale === "en" ? [en, ru] : [ru, en];

  return (
    <section id="certificate" className="relative isolate overflow-hidden py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(40rem 26rem at 78% 45%, color-mix(in oklab, #8b5cf6 16%, transparent), transparent 70%), radial-gradient(30rem 20rem at 62% 70%, color-mix(in oklab, var(--accent) 12%, transparent), transparent 70%)",
        }}
      />
      <Container size="wide" className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div>
          <Reveal>
            <SectionHead
              eyebrow={pick(locale, "Сертификат", "Certificate")}
              title={pick(locale, "Именной сертификат за пройденный курс", "A certificate in your name for every course")}
              body={pick(
                locale,
                "Подтверждает не просмотр уроков, а сделанную работу: его выдаёт ментор, когда принимает ваш финальный проект.",
                "It vouches for work done, not lessons watched: your mentor issues it when they accept your final project.",
              )}
            />
          </Reveal>

          <RevealGroup step={80} className="mt-2 flex flex-col gap-5">
            {steps.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-accent">
                  <step.icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] tabular-nums text-faint">{String(index + 1).padStart(2, "0")}</span>
                    <span className="text-[15.5px] font-medium text-ink">{step.title}</span>
                  </span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-ink-3">{step.body}</span>
                </span>
              </div>
            ))}
          </RevealGroup>

          <Reveal delay={200}>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ButtonLink href={path("/learn", locale)} size="lg" className="group">
                {pick(locale, "Выбрать курс", "Choose a course")}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </ButtonLink>
              <span className="inline-flex items-center gap-2 text-[13px] text-muted">
                <Award className="h-4 w-4 text-accent" aria-hidden />
                {pick(locale, "Входит в тариф «С ментором» · на русском и английском", "Included in the mentor plan · in English and Russian")}
              </span>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <figure className="cert-stage relative mx-auto mt-10 w-[88%] max-w-[600px] lg:mt-14">
            {/* the second language, behind and floating a beat later */}
            <div className="cert-float-back absolute inset-0 opacity-90">
              <div className="relative aspect-[1024/682] overflow-hidden rounded-xl border border-white/10 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]">
                <Image src={back.src} alt={back.alt} fill sizes="(max-width: 1024px) 80vw, 560px" className="object-cover brightness-90" />
              </div>
            </div>
            <div className="cert-float relative">
              <article className="relative aspect-[1024/682] overflow-hidden rounded-xl border border-white/10 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]">
                <ArtParallax>
                  <Image src={front.src} alt={front.alt} fill sizes="(max-width: 1024px) 92vw, 640px" className="object-cover" />
                </ArtParallax>
                <span aria-hidden className="cert-sheen pointer-events-none absolute inset-0" />
              </article>
            </div>
            <span className="absolute -top-3 left-4 z-10 rounded-full border border-white/15 bg-black/60 px-3 py-1 font-mono text-[11px] tracking-[0.12em] text-white/85 uppercase backdrop-blur-sm">
              RU · EN
            </span>
            <span aria-hidden className="cert-shadow pointer-events-none absolute -bottom-10 left-1/2 h-6 w-[70%] -translate-x-1/2 rounded-[50%] bg-black/45 blur-xl" />
            <figcaption className="sr-only">{pick(locale, "Пример: имя скрыто. Сертификат выдаётся на русском и английском.", "Sample: the name is hidden. Issued in English and Russian.")}</figcaption>
          </figure>
        </Reveal>
      </Container>
    </section>
  );
}
