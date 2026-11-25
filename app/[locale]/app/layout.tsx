import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift, KeyRound } from "lucide-react";
import { Countdown } from "@/components/motion/countdown";
import { AppShell } from "@/components/layout/app-shell";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { buildAppNav } from "@/components/layout/nav-model";
import { signOut } from "@/lib/auth/actions";
import { getAccess, getMe, getNotifications } from "@/lib/api/session";
import { getAssistantOnline } from "@/lib/api/public";
import { coursesPublic } from "@/lib/visibility";
import { getDictionary, path, type Locale } from "@/lib/i18n";

/** The moment of this render, for the countdown's first paint. */
function layoutNow() {
  return Date.now();
}

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const me = await getMe();
  if (!me) redirect(path("/login?next=" + encodeURIComponent(path("/app", locale)), locale));

  const [access, notifications, assistantOnline] = await Promise.all([
    getAccess(),
    getNotifications(),
    getAssistantOnline(),
  ]);
  const unread = notifications.filter((notification) => !notification.read).length;

  async function handleSignOut() {
    "use server";
    await signOut(locale);
  }

  return (
    <>
      <AppShell
        locale={locale}
        d={d}
        groups={buildAppNav(d, locale)}
        user={{
          name: me.user.name || me.user.email,
          email: me.user.email,
          avatarUrl: me.user.avatarUrl,
          personalId: me.user.personalId,
          tier: access.tier === "guest" ? "free" : access.tier,
        }}
        unread={unread}
        onSignOut={handleSignOut}
      >
        {me.user.passwordTemporary && (
          <div
            role="status"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-[13.5px] text-ink"
          >
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 shrink-0 text-warning" aria-hidden />
              {locale === "en"
                ? "You signed in with a temporary password. Choose your own to keep the account safe."
                : locale === "ukr"
                  ? "Ви увійшли з тимчасовим паролем. Придумайте свій, щоб захистити акаунт."
                  : "Вы вошли с временным паролем. Придумайте свой, чтобы защитить аккаунт."}
            </span>
            <Link href={path("/app/settings", locale)} className="font-medium text-accent-ink underline-offset-4 hover:underline">
              {locale === "en" ? "Change password" : locale === "ukr" ? "Змінити пароль" : "Сменить пароль"} →
            </Link>
          </div>
        )}
        {me.offers?.todayFree && (
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent/50 p-4 text-ink shadow-glow"
            style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--accent) 26%, transparent), color-mix(in oklab, var(--accent) 6%, transparent))" }}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[14.5px] font-semibold">
                <Gift className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                {locale === "en"
                  ? "A gift for getting in: your first paid course is free"
                  : locale === "ukr"
                    ? "Подарунок за вступ: перший платний курс — безкоштовно"
                    : "Подарок за поступление: первый платный курс — бесплатно"}
              </span>
              <span className="mt-1 block text-[13px] leading-snug text-ink-2">
                {locale === "en" ? "Open a course, pick a plan and enter the code " : locale === "ukr" ? "Відкрийте курс, оберіть тариф і введіть промокод " : "Откройте курс, выберите тариф и введите промокод "}
                <span className="rounded-md border border-accent/40 bg-surface px-1.5 py-0.5 font-mono font-semibold tracking-wide text-ink select-all">
                  {me.offers.todayFree.code}
                </span>
                {locale === "en" ? " — the button turns into “Start for free”." : locale === "ukr" ? " — кнопка зміниться на «Почати безкоштовно»." : " — кнопка сменится на «Начать бесплатно»."}
              </span>
            </span>
            <span className="flex items-center gap-4">
              <Countdown
                endsAt={me.offers.todayFree.endsAt}
                serverNow={layoutNow()}
                labels={locale === "en" ? ["h", "min", "sec"] : ["ч", "мин", "сек"]}
              />
              <Link
                href={path("/learn", locale)}
                className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-[13.5px] font-medium text-on-accent transition-colors hover:bg-accent-strong"
              >
                {locale === "en" ? "Choose a course" : locale === "ukr" ? "Обрати курс" : "Выбрать курс"}
              </Link>
            </span>
          </div>
        )}
        {children}
      </AppShell>
      {/* Above the tab bar that docks to the bottom on phones and tablets. */}
      {assistantOnline && (
        <AssistantWidget
          locale={locale}
          d={d}
          userName={me.user.name}
          lift="max-lg:[--assistant-lift:4.25rem]"
          prelaunch={!coursesPublic()}
        />
      )}
    </>
  );
}
