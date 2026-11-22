import { permanentRedirect } from "next/navigation";
import { path, type Locale } from "@/lib/i18n";

/** Creator pages are gone (see ../page.tsx); a creator's old address opens the store. */
export default async function CreatorPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale } = await params;
  permanentRedirect(path("/store", locale as Locale));
}
