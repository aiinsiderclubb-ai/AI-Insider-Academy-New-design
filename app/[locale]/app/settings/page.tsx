import type { Metadata } from "next";
import { AppPage } from "@/components/app/page-header";
import { SettingsPanels, type TelegramState } from "@/components/app/settings-panels";
import { pick } from "@/content/locale";
import { tryApi } from "@/lib/api/http";
import { getMe } from "@/lib/api/session";
import { getDictionary, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const me = await getMe();
  if (!me) return null;

  const telegramDefaults = { botUrl: "https://t.me/InsiderAcademyNotifyBot", botUsername: "InsiderAcademyNotifyBot" };
  const telegramRaw = await tryApi<TelegramState>(
    "/telegram/status",
    { auth: true, soft: true },
    { connected: false, username: null, ...telegramDefaults, prefs: {} },
  );
  // An API without the bot configured answers with nulls; the public bot is shown instead of "@null".
  const telegram: TelegramState = {
    ...telegramRaw,
    botUrl: telegramRaw.botUrl || telegramDefaults.botUrl,
    botUsername: telegramRaw.botUsername || telegramDefaults.botUsername,
  };

  return (
    <AppPage
      eyebrow={d.app.settings}
      title={pick(locale, "Настройки аккаунта", "Account settings")}
      body={pick(
        locale,
        "Профиль, безопасность и каналы уведомлений — в одном месте.",
        "Profile, security and notification channels in one place.",
      )}
    >
      <SettingsPanels
        locale={locale}
        d={d}
        user={{
          name: me.user.name,
          email: me.user.email,
          personalId: me.user.personalId,
          avatarUrl: me.user.avatarUrl,
          emailVerified: me.user.emailVerified,
          passwordTemporary: me.user.passwordTemporary,
        }}
        telegram={telegram}
      />
    </AppPage>
  );
}
