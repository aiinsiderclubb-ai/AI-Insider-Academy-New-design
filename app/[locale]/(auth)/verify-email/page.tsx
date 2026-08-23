import type { Metadata } from "next";
import { VerifyForm } from "@/components/auth/auth-forms";
import { resendCode, verifyEmail } from "@/lib/auth/actions";
import { getDictionary, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDictionary(locale).auth.verifyTitle, robots: { index: false } };
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale: raw } = await params;
  const { email } = await searchParams;
  const locale = raw as Locale;
  return (
    <VerifyForm
      action={verifyEmail}
      resend={resendCode}
      locale={locale}
      d={getDictionary(locale)}
      email={email ?? ""}
    />
  );
}
