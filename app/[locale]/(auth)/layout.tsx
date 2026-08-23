import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { getCourses } from "@/lib/api/catalog";
import { getStoreCatalog } from "@/lib/api/store";
import { pick } from "@/content/locale";
import { getDictionary, path, type Locale } from "@/lib/i18n";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [courses, catalog] = await Promise.all([getCourses(locale), getStoreCatalog(locale)]);
  const lessons = courses.reduce((sum, course) => sum + course.lessonCount, 0);

  const proof = [
    { value: courses.length, label: d.home.statsCourses },
    { value: lessons, label: d.home.statsLessons },
    { value: catalog.products.length, label: d.home.statsProducts },
  ];

  const perks = [
    pick(locale, "Три программы открыты бесплатно", "Three programmes are free"),
    pick(locale, "Прогресс и заметки сохраняются", "Progress and notes are saved"),
    pick(locale, "Домашние задания с проверкой", "Assignments get reviewed"),
    pick(locale, "Сертификат после финального проекта", "A certificate after the final project"),
  ];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      {/* -------------------------------- form -------------------------------- */}
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <Brand href={path("/", locale)} name={d.brand.name} sub={d.brand.sub} />
          <Link
            href={path("/", locale)}
            className="flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {d.nav.backToSite}
          </Link>
        </div>

        <main id="main" className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </main>

        <p className="text-center text-[12px] text-faint">
          © {new Date().getFullYear()} {d.footer.madeWith}
        </p>
      </div>

      {/* -------------------------------- proof ------------------------------- */}
      <aside className="relative hidden overflow-hidden border-l border-line bg-surface-2 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(48rem 32rem at 100% 0%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 62%)",
          }}
        />

        <div className="relative">
          <p className="eyebrow">{d.brand.tagline}</p>
          <p className="mt-7 max-w-md font-display text-[clamp(1.75rem,2.4vw,2.5rem)] leading-[1.12] font-extrabold tracking-[-0.035em] text-ink">
            {pick(locale, "Один аккаунт на курсы, магазин и ", "One account for courses, the store and ")}
            <span className="mark">{pick(locale, "сообщество", "the community")}</span>
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <dl className="relative grid grid-cols-3 gap-6 border-t border-line pt-8">
          {proof.map((item) => (
            <div key={item.label}>
              <dt className="sr-only">{item.label}</dt>
              <dd>
                <span className="block font-display text-[2rem] leading-none font-extrabold tracking-tight tabular-nums text-ink">
                  {item.value}
                </span>
                <span className="mt-2 block text-[12.5px] leading-snug text-muted">{item.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
