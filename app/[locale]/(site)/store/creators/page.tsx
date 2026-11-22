import { permanentRedirect } from "next/navigation";
import { path, type Locale } from "@/lib/i18n";

/**
 * Every product in the store is made and sold by AI Insider Academy, so there
 * are no creator pages. Old links land on the store.
 */
export default async function CreatorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  permanentRedirect(path("/store", locale as Locale));
}
