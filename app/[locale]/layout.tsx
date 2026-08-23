import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Geologica, Golos_Text, JetBrains_Mono } from "next/font/google";
import { getDictionary, htmlLang, isLocale, locales } from "@/lib/i18n";
import { ToastProvider } from "@/components/primitives/toast";
import "../globals.css";

/** Display face — industrial grotesque with a first-class Cyrillic cut. */
const display = Geologica({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-display-face",
  display: "swap",
});

/** Interface face — designed for Cyrillic first, excellent at 13–17px. */
const sans = Golos_Text({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-face",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono-face",
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(locale);
  return {
    metadataBase: new URL(process.env.SITE_URL ?? "https://myinsideracademy.com"),
    title: { default: `${d.brand.name} ${d.brand.sub}`, template: `%s · ${d.brand.name} ${d.brand.sub}` },
    description: d.home.heroBody,
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [htmlLang[l], `/${l}`])),
    },
    openGraph: {
      siteName: `${d.brand.name} ${d.brand.sub}`,
      type: "website",
      locale: htmlLang[locale as never] ?? "ru",
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0908" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Applies the stored theme before first paint. The product is dark by default,
 * so this exists to stop a *light*-mode visitor seeing a dark flash. It has to
 * run before hydration, hence the inline script.
 */
const themeBootstrap = `(function(){try{var t=localStorage.getItem("aia-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const d = getDictionary(locale);

  return (
    <html
      lang={htmlLang[locale]}
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent focus:shadow-md"
        >
          {d.nav.skipToContent}
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
