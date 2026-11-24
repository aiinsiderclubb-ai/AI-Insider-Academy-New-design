"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A muted clip laid over a product card's cover. It loads nothing until the
 * card is pointed at or focused, plays while it is, and rewinds when the
 * pointer leaves — so a shelf with a few video products stays light.
 */
export function HoverVideo({ src, poster, className }: { src: string; poster?: string; className?: string }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    const video = ref.current;
    const card = video?.closest("article");
    if (!video || !card) return;

    const start = () => {
      setArmed(true);
      void video.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    };
    const stop = () => {
      video.pause();
      video.currentTime = 0;
      setPlaying(false);
    };

    card.addEventListener("pointerenter", start);
    card.addEventListener("pointerleave", stop);
    card.addEventListener("focusin", start);
    card.addEventListener("focusout", stop);
    return () => {
      card.removeEventListener("pointerenter", start);
      card.removeEventListener("pointerleave", stop);
      card.removeEventListener("focusin", start);
      card.removeEventListener("focusout", stop);
    };
  }, []);

  return (
    <video
      ref={ref}
      src={armed ? src : undefined}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      className={cn(
        "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
        playing ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}

/**
 * A muted loop that plays on its own while on screen — for the one featured
 * clip on a page. Visitors who prefer reduced motion get the poster and a
 * play button instead.
 */
export function AmbientVideo({
  src,
  poster,
  className,
  playLabel,
}: {
  src: string;
  poster?: string;
  className?: string;
  playLabel: string;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [still, setStill] = React.useState(false);

  React.useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Play only while visible; a looping video off screen is wasted battery.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (reduced) {
          setStill(true);
          observer.disconnect();
        } else if (entry?.isIntersecting) void video.play().catch(() => setStill(true));
        else video.pause();
      },
      { threshold: 0.2 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        className={cn("absolute inset-0 h-full w-full object-cover", className)}
      />
      {still && (
        <button
          type="button"
          onClick={() => {
            setStill(false);
            void ref.current?.play();
          }}
          className="absolute top-4 right-4 z-10 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-[color-mix(in_oklab,var(--ground)_70%,transparent)] px-3.5 text-[12.5px] text-ink backdrop-blur-md"
        >
          <svg viewBox="0 0 10 12" className="h-3 w-2.5 fill-current" aria-hidden>
            <path d="M0 0l10 6-10 6z" />
          </svg>
          {playLabel}
        </button>
      )}
    </>
  );
}
