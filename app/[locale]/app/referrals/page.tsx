import type { Metadata } from "next";
import { AppPage } from "@/components/app/page-header";
import { ReferralPanel } from "@/components/app/community-panels";
import { pick } from "@/content/locale";
import { links } from "@/content/site";
import { getAccess, getMe } from "@/lib/api/session";
import { getDictionary, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function ReferralsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [me, access] = await Promise.all([getMe(), getAccess()]);
  if (!me) return null;

  const base = process.env.SITE_URL ?? links.academy;
  const link = `${base.replace(/\/$/, "")}/${locale}/register?ref=${encodeURIComponent(me.user.personalId)}`;

  return (
    <AppPage
      eyebrow={d.app.referrals}
      title={pick(locale, "Приглашайте — и платите меньше", "Invite friends, pay less")}
      body={pick(
        locale,
        "Персональная ссылка привязана к вашему ID. Скидка растёт с каждым приглашённым.",
        "Your personal link is tied to your ID. The discount grows with every friend who joins.",
      )}
    >
      <ReferralPanel locale={locale} d={d} link={link} discountPercent={access.discountPercent} />
    </AppPage>
  );
}
