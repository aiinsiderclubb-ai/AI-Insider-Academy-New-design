import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Geologica, Golos_Text, JetBrains_Mono } from "next/font/google";
import { getDictionary, htmlLang, isLocale, locales } from "@/lib/i18n";
import { resolveSiteUrl } from "@/lib/api/origin";
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
    metadataBase: new URL(resolveSiteUrl()),
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
    verification: {
      google: "XKA9nH6bLwQq4epuO6-0W4rFpvpS5RMrmFVrQ1nIxbw",
    },
  };
}

/**
 * One colour, not a media-query pair: the product ignores the OS preference
 * and opens dark for everyone, so a `prefers-color-scheme: light` entry would
 * paint the browser chrome cream around a near-black page. The bootstrap below
 * rewrites this tag when the visitor has chosen light.
 */
export const viewport: Viewport = {
  themeColor: "#0a0908",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Runs before first paint, hence inline:
 *
 * 1. drops `no-js`, which is what keeps scroll-reveal elements visible when
 *    scripting never arrives — without it a failed hydration leaves the page
 *    blank at `opacity: 0`;
 * 2. applies the stored theme, so a light-mode visitor never sees a dark
 *    flash, and moves the `theme-color` tag with it.
 */
const themeBootstrap = `(function(){var d=document.documentElement;d.classList.remove("no-js");try{var t=localStorage.getItem("aia-theme");if(t==="dark"||t==="light"){d.setAttribute("data-theme",t);if(t==="light"){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#f4f2ee")}}}catch(e){}})()`;

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
      /* Tells the router to opt out of the smooth scroll during a route
         change; without it Next warns and every navigation animates the jump
         back to the top. */
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`no-js ${display.variable} ${sans.variable} ${mono.variable}`}
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
