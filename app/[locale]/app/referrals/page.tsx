import type { Metadata } from "next";
import { AppPage } from "@/components/app/page-header";
import { ReferralPanel } from "@/components/app/community-panels";
import { pick } from "@/content/locale";
import { links } from "@/content/site";
import { getMe, getRewards } from "@/lib/api/session";
import { getDictionary, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function ReferralsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [me, rewards] = await Promise.all([getMe(), getRewards()]);
  if (!me) return null;

  const base = process.env.SITE_URL ?? links.academy;
  const code = rewards?.referralCode ?? me.user.personalId;
  const link = `${base.replace(/\/$/, "")}/${locale}/store?ref=${encodeURIComponent(code)}`;

  return (
    <AppPage
      eyebrow={d.app.referrals}
      title={pick(locale, "Приглашайте — и платите меньше", "Invite friends, pay less")}
      body={pick(
        locale,
        "Друг получает −10% на первую покупку, вы — код −15% за каждого купившего друга.",
        "Your friend gets 10% off their first purchase; you get a 15% code for every friend who buys.",
      )}
    >
      <ReferralPanel
        locale={locale}
        d={d}
        link={link}
        rewards={rewards ?? { friendPercent: 10, referrerPercent: 15, nextPercent: 15, invited: 0, purchased: 0, friendDiscount: 0, codes: [] }}
      />
    </AppPage>
  );
}
