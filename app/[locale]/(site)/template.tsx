"use client";

/**
 * Page transition for the public site.
 *
 * A template re-mounts on every navigation, so the incoming page can play a
 * short rise-in. Kept to one short cue — anything longer starts to feel like
 * waiting rather than motion.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page motion-reduce:animate-none">{children}</div>;
}
