import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/auth-forms";
import { signIn } from "@/lib/auth/actions";
import { getDictionary, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDictionary(locale).auth.signIn, robots: { index: false } };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { locale: raw } = await params;
  const { next, reset } = await searchParams;
  const locale = raw as Locale;
  return <SignInForm action={signIn} locale={locale} d={getDictionary(locale)} next={next} justReset={reset === "1"} />;
}
