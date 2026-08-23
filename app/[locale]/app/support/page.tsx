import type { Metadata } from "next";
import { AppPage } from "@/components/app/page-header";
import { SupportPanel, type SupportMessage } from "@/components/app/community-panels";
import { pick } from "@/content/locale";
import { links } from "@/content/site";
import { getSupportThread } from "@/lib/api/session";
import { getDictionary, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const thread = await getSupportThread();

  return (
    <AppPage
      eyebrow={d.app.support}
      title={pick(locale, "Поддержка", "Support")}
      body={pick(
        locale,
        "Задайте вопрос здесь — переписка сохраняется в кабинете и дублируется в Telegram.",
        "Ask here — the thread stays in your account and is mirrored to Telegram.",
      )}
    >
      <SupportPanel locale={locale} d={d} initial={thread as SupportMessage[]} telegramUrl={links.support} />
    </AppPage>
  );
}
