import manifest from "./covers.json";

type Bucket = "marketplace" | "courses" | "coursesWide" | "vault" | "certificates" | "design" | "videos";

const covers = manifest as Record<Bucket, Record<string, string>>;

/**
 * Resolves an artwork path by slug. Six store items have no artwork yet — they
 * get a generated cover instead of a broken image frame.
 */
export function cover(bucket: Bucket, slug: string | null | undefined): string | null {
  if (!slug) return null;
  const clean = slug.replace(/^\//, "").replace(/\.[^.]*$/, "").split("/").pop() ?? slug;
  return covers[bucket]?.[clean] ?? null;
}

/**
 * The 16:9 version of a course's artwork, for the wide frames — the course
 * page and checkout. Falls back to the card artwork when there is none.
 */
export function courseWallpaper(imagePath: string | null | undefined, slug: string): string | null {
  return cover("coursesWide", slug) ?? courseCover(imagePath, slug);
}

export function courseCover(imagePath: string | null | undefined, slug: string): string | null {
  if (imagePath) {
    const base = imagePath.split("?")[0].split("/").pop()?.replace(/\.[^.]*$/, "");
    const resolved = base ? covers.courses[base] : null;
    if (resolved) return resolved;
  }
  return cover("courses", slug);
}

/**
 * The course trailer, if one has been produced.
 *
 * Files are named `<slug>-promo.mp4` and live in `public/videos`; the manifest
 * is what makes one appear on the page. A course without a file is not an
 * error — the frame says so instead of pretending.
 */
export function courseTrailer(slug: string): string | null {
  return cover("videos", `${slug}-promo`);
}
