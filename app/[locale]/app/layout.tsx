import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { buildAppNav } from "@/components/layout/nav-model";
import { signOut } from "@/lib/auth/actions";
import { getAccess, getMe, getNotifications } from "@/lib/api/session";
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

  const [access, notifications] = await Promise.all([getAccess(), getNotifications()]);
  const unread = notifications.filter((notification) => !notification.read).length;

  async function handleSignOut() {
    "use server";
    await signOut(locale);
  }

  return (
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
      {children}
    </AppShell>
  );
}
