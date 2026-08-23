"use client";

import * as React from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { Wipe } from "@/components/motion/wipe";
import { cn } from "@/lib/utils";

/**
 * The course trailer.
 *
 * The frame is the poster until someone asks for the film: the video element
 * is there from the start but loads only its metadata, so a page nobody
 * watches costs a few kilobytes rather than four megabytes. Pressing play
 * hands the frame to the browser's own controls — they are keyboard
 * accessible, they know about captions and picture-in-picture, and no custom
 * scrubber will ever match them.
 *
 * Facts about the course sit on the bottom edge as player chrome. They used
 * to be a full-width ledger of their own, which gave four small numbers the
 * weight of a chapter; here they read as a caption and disappear the moment
 * the film starts.
 */
export function CourseTrailer({
  src,
  poster,
  label,
  soonLabel,
  playLabel,
  facts,
}: {
  src: string | null;
  poster: string | null;
  /** Eyebrow on the frame, e.g. "Трейлер курса". */
  label: string;
  /** Shown in place of the play control when no film exists yet. */
  soonLabel: string;
  playLabel: string;
  facts: string[];
}) {
  const video = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [duration, setDuration] = React.useState<string | null>(null);

  const start = () => {
    const node = video.current;
    if (!node) return;
    setPlaying(true);
    node.play().catch(() => setPlaying(false));
  };

  return (
    <Wipe className="overflow-hidden rounded-2xl border border-line-2 bg-surface-inset shadow-lg">
      <div className="group relative aspect-video w-full">
        {src ? (
          <video
            ref={video}
            src={src}
            poster={poster ?? undefined}
            preload="metadata"
            playsInline
            controls={playing}
            controlsList="nodownload"
            onEnded={() => setPlaying(false)}
            onPause={(event) => {
              /* A pause at the very end is the film finishing, not a choice. */
              if (event.currentTarget.ended) setPlaying(false);
            }}
            onLoadedMetadata={(event) => {
              const total = event.currentTarget.duration;
              if (!Number.isFinite(total)) return;
              const minutes = Math.floor(total / 60);
              const seconds = Math.round(total % 60);
              setDuration(`${minutes}:${String(seconds).padStart(2, "0")}`);
            }}
            className="h-full w-full bg-ground-deep object-cover"
          />
        ) : (
          poster && (
            <Image
              src={poster}
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
          )
        )}

        {/* ------------------------------ poster face ----------------------------- */}
        <div
          aria-hidden={playing}
          className={cn(
            "absolute inset-0 transition-opacity duration-500",
            playing ? "pointer-events-none opacity-0" : "opacity-100",
          )}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgb(10 9 8 / 0.5) 0%, rgb(10 9 8 / 0.1) 32%, rgb(10 9 8 / 0.6) 80%, rgb(10 9 8 / 0.9) 100%)",
            }}
          />

          {/* Chrome sits in pills: a poster can be any brightness, and a
              gradient alone does not guarantee the label stays readable. */}
          <p className="absolute top-5 left-5 rounded-full bg-black/50 px-3 py-1 font-mono text-2xs tracking-[0.2em] text-white/85 uppercase backdrop-blur-sm sm:top-6 sm:left-7">
            {label}
          </p>

          {duration && (
            <p className="absolute top-5 right-5 rounded-full bg-black/50 px-2.5 py-1 font-mono text-2xs tabular-nums text-white/85 backdrop-blur-sm sm:top-6 sm:right-7">
              {duration}
            </p>
          )}

          {/* ------------------------------- the play ------------------------------- */}
          <div className="absolute inset-0 grid place-items-center">
            {src ? (
              <button
                type="button"
                onClick={start}
                aria-label={playLabel}
                className="relative grid h-20 w-20 place-items-center rounded-full bg-accent text-on-accent transition-transform duration-300 ease-[var(--ease-out-quart)] hover:scale-105 focus-visible:scale-105 active:scale-100 sm:h-24 sm:w-24"
              >
                {/* The halo grows out of the button rather than pulsing at rest. */}
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-accent/35 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.45] motion-reduce:transition-none"
                />
                <Play className="relative h-7 w-7 translate-x-0.5 fill-current sm:h-8 sm:w-8" aria-hidden />
              </button>
            ) : (
              <p className="rounded-full border border-white/20 bg-black/40 px-5 py-2.5 font-mono text-2xs tracking-[0.18em] text-white/75 uppercase backdrop-blur-sm">
                {soonLabel}
              </p>
            )}
          </div>

          {/* -------------------------------- chrome -------------------------------- */}
          {facts.length > 0 && (
            <ul className="absolute right-5 bottom-5 left-5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 sm:right-7 sm:bottom-6 sm:left-7">
              {facts.map((fact, index) => (
                <li key={fact} className="flex items-center gap-2.5">
                  {index > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-white/30" />}
                  <span className="font-mono text-[11.5px] tracking-[0.06em] text-white/85">{fact}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Wipe>
  );
}
