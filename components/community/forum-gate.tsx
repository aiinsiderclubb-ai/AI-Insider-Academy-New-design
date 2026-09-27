import { CheckCircle2, Lock, MessagesSquare, Search } from "lucide-react";
import { ButtonLink } from "@/components/primitives/button";
import { pick } from "@/content/locale";
import type { ForumAccess } from "@/lib/api/public";
import { path, type Locale } from "@/lib/i18n";

/**
 * What stands in front of the forum for anyone who is not a member yet.
 *
 * The two cases ask for different things, so they say different things: a
 * guest may well be a student who is simply signed out, and needs the door
 * to the login form; a signed-in account without a purchase needs to know
 * what opens the room, not to be sent back to a login it has already done.
 */
export function ForumGate({
  access,
  locale,
  next,
}: {
  access: Exclude<ForumAccess, "member">;
  locale: Locale;
  /** Where to land after signing in. */
  next: string;
}) {
  const perks = [
    {
      icon: MessagesSquare,
      text: pick(
        locale,
        "Вопросы по курсам, n8n, агентам и работе с клиентами — в своих разделах",
        "Questions on courses, n8n, agents and client work — each in its own section",
      ),
    },
    {
      icon: CheckCircle2,
      text: pick(
        locale,
        "Автор отмечает ответ, который сработал, — следующему не придётся спрашивать",
        "The asker marks the answer that worked — so the next person does not have to ask",
      ),
    },
    {
      icon: Search,
      text: pick(locale, "Только студенты Academy — без спама и случайных людей", "Academy students only — no spam, no drive-bys"),
    },
  ];

  const guest = access === "guest";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface-2 px-6 py-10 sm:px-10 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(36rem 20rem at 100% 0%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 62%)",
        }}
      />

      <div className="relative max-w-2xl">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-2 bg-surface text-accent">
          <Lock className="h-5 w-5" aria-hidden />
        </span>

        <h2 className="mt-6 text-[clamp(1.5rem,3vw,2rem)] leading-tight">
          {guest
            ? pick(locale, "Сообщество студентов Academy", "The Academy student community")
            : pick(locale, "Откроется после первой покупки", "Opens with your first purchase")}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          {guest
            ? pick(
                locale,
                "Здесь спрашивают и помогают те, кто учится вместе с вами. Войдите, чтобы открыть.",
                "This is where people learning alongside you ask and help. Sign in to open it.",
              )
            : pick(
                locale,
                "Сообщество — для студентов. Любой курс, пакет или продукт из магазина открывает его сразу после оплаты.",
                "The community is for students. Any course, bundle or store product opens it the moment it is paid for.",
              )}
        </p>

        <ul className="mt-7 flex flex-col gap-3">
          {perks.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-[14px] leading-snug text-ink-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              {text}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap gap-3">
          {guest ? (
            <>
              <ButtonLink href={path(`/login?next=${encodeURIComponent(next)}`, locale)} size="lg">
                {pick(locale, "Войти", "Sign in")}
              </ButtonLink>
              <ButtonLink href={path("/register", locale)} variant="secondary" size="lg">
                {pick(locale, "Создать аккаунт", "Create an account")}
              </ButtonLink>
            </>
          ) : (
            <>
              <ButtonLink href={path("/learn", locale)} size="lg">
                {pick(locale, "Выбрать курс", "Choose a course")}
              </ButtonLink>
              <ButtonLink href={path("/store", locale)} variant="secondary" size="lg">
                {pick(locale, "Магазин", "Store")}
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
