import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/auth-forms";
import { resetPassword } from "@/lib/auth/actions";
import { getDictionary, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDictionary(locale).auth.resetTitle, robots: { index: false } };
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale: raw } = await params;
  const { token } = await searchParams;
  const locale = raw as Locale;
  return <ResetForm action={resetPassword} locale={locale} d={getDictionary(locale)} token={token ?? ""} />;
}
