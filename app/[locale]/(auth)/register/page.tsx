import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/auth-forms";
import { signUp } from "@/lib/auth/actions";
import { getDictionary, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDictionary(locale).auth.signUp, robots: { index: false } };
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  return <SignUpForm action={signUp} locale={locale} d={getDictionary(locale)} />;
}
