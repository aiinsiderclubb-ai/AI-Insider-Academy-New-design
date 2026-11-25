import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { buildAppNav } from "@/components/layout/nav-model";
import { signOut } from "@/lib/auth/actions";
import { getAccess, getMe, getNotifications } from "@/lib/api/session";
import { getAssistantOnline } from "@/lib/api/public";
import { coursesPublic } from "@/lib/visibility";
import { getDictionary, path, type Locale } from "@/lib/i18n";

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
