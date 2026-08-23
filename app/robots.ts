import type { MetadataRoute } from "next";

const SITE = process.env.SITE_URL ?? "https://myinsideracademy.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/studio", "/app", "/study", "/login", "/register", "/verify-email", "/forgot-password", "/reset-password", "/onboarding"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
