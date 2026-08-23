import type { Metadata } from "next";
import { AppPage } from "@/components/app/page-header";
import { TeamPanel, type TeamMember } from "@/components/app/community-panels";
import { pick } from "@/content/locale";
import { getTeam } from "@/lib/api/session";
import { getDictionary, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const { team, members } = await getTeam();

  return (
    <AppPage
      eyebrow={d.app.team}
      title={pick(locale, "Корпоративный доступ", "Team access")}
      body={pick(
        locale,
        "Один владелец покупает программы и раздаёт их участникам команды по коду приглашения.",
        "One owner buys the programmes and hands them to teammates with an invite code.",
      )}
    >
      <TeamPanel locale={locale} d={d} team={team} members={members as TeamMember[]} />
    </AppPage>
  );
}
