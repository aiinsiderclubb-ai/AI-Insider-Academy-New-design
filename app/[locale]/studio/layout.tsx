import type { Metadata } from "next";
import { AdminLogin } from "@/components/studio/admin-login";
import { StudioShell, type StudioNavItem } from "@/components/studio/studio-shell";
import { adminSignIn, adminSignOut } from "@/lib/auth/actions";
import { getStudioDashboard, hasAdminSession, queueCounts } from "@/lib/api/studio";
import { pick } from "@/content/locale";
import { getDictionary, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const signedIn = await hasAdminSession();
  const dashboard = signedIn ? await getStudioDashboard() : null;

  if (!signedIn || !dashboard) {
    return <AdminLogin action={adminSignIn} locale={locale} d={d} />;
  }

  const counts = queueCounts(dashboard);
  const p = (href: string) => path(href, locale);

  const groups: { title: string; items: StudioNavItem[] }[] = [
    {
      title: pick(locale, "Обзор", "Overview"),
      items: [
        { id: "pulse", label: pick(locale, "Пульс", "Pulse"), href: p("/studio") },
        { id: "queue", label: pick(locale, "Очереди", "Queues"), href: p("/studio/queue"), badge: counts.total },
      ],
    },
    {
      title: pick(locale, "Люди и деньги", "People and money"),
      items: [
        { id: "learners", label: pick(locale, "Ученики", "Learners"), href: p("/studio/learners") },
        { id: "revenue", label: pick(locale, "Выручка", "Revenue"), href: p("/studio/revenue") },
      ],
    },
    {
      title: pick(locale, "Каталоги", "Catalogues"),
      items: [
        { id: "courses", label: pick(locale, "Курсы", "Courses"), href: p("/studio/courses") },
        { id: "store", label: "Marketplace", href: p("/studio/store") },
        { id: "content", label: pick(locale, "Контент", "Content"), href: p("/studio/content") },
      ],
    },
    {
      title: pick(locale, "Операции", "Operations"),
      items: [
        { id: "growth", label: pick(locale, "Рост", "Growth"), href: p("/studio/growth") },
        { id: "ops", label: pick(locale, "Инфраструктура", "Infrastructure"), href: p("/studio/ops") },
      ],
    },
  ];

  async function handleSignOut() {
    "use server";
    await adminSignOut(locale);
  }

  return (
    <StudioShell locale={locale} d={d} groups={groups} role={dashboard.role} onSignOut={handleSignOut}>
      {children}
    </StudioShell>
  );
}
