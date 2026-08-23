import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/auth-forms";
import { requestPasswordReset } from "@/lib/auth/actions";
import { getDictionary, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDictionary(locale).auth.resetTitle, robots: { index: false } };
}

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  return <ForgotForm action={requestPasswordReset} locale={locale} d={getDictionary(locale)} />;
}
