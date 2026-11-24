import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLook } from "./look";

/**
 * Word-timed captions. The timeline comes from the captions-explainer skill's
 * srt_to_timeline.py: pages of a few words, each word with its own start and
 * end in seconds. One page is on screen at a time; the spoken word carries the
 * accent.
 */

export type CaptionWord = { text: string; start: number; end: number };
export type CaptionPage = { start: number; end: number; words: CaptionWord[] };
export type CaptionTimeline = { pages: CaptionPage[] };

export type CaptionMode =
  /** Words pop in as they are spoken; the spoken word sits on an accent block. */
  | "pop"
  /** The whole page is visible; the spoken word lights up. Calmer, easier to read. */
  | "karaoke";

export function CaptionTrack({
  timeline,
  mode = "pop",
  size = 84,
  maxWidth = 900,
  uppercase = false,
}: {
  timeline: CaptionTimeline;
  mode?: CaptionMode;
  size?: number;
  maxWidth?: number;
  uppercase?: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, fonts } = useLook();
  const t = frame / fps;
  const page = timeline.pages.find((p) => t >= p.start && t < p.end);
  if (!page) return null;
  const pageAge = frame - Math.round(page.start * fps);
  const pageIn = spring({ frame: pageAge, fps, config: { damping: 200, stiffness: 220 } });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: size * 0.26,
        rowGap: size * 0.08,
        maxWidth,
        fontFamily: fonts.display,
        fontWeight: style.fonts.display.weight,
        fontSize: size,
        lineHeight: 1.05,
        letterSpacing: `${Math.max(style.fonts.display.tracking, -0.03)}em`,
        textTransform: uppercase ? "uppercase" : "none",
        textAlign: "center",
        transform: `translateY(${(1 - pageIn) * 30}px)`,
      }}
    >
      {page.words.map((word, i) => {
        const start = Math.round(word.start * fps);
        const age = frame - start;
        const spoken = t >= word.start;
        const active = t >= word.start && t < Math.max(word.end, word.start + 0.12);
        const pop = spring({ frame: age, fps, config: { damping: 14, stiffness: 260, mass: 0.6 } });
        const shown = mode === "karaoke" || spoken;
        const scale = mode === "pop" ? interpolate(pop, [0, 1], [0.6, 1]) : 1;
        return (
          <span
            key={`${word.text}-${i}`}
            style={{
              position: "relative",
              display: "inline-block",
              isolation: "isolate",
              opacity: shown ? (mode === "karaoke" && !spoken ? 0.38 : 1) : 0,
              transform: `scale(${scale})`,
              color: active ? style.colors.onAccent : style.colors.ink,
              padding: "0 0.1em",
              margin: "0 -0.1em",
              textShadow: active ? "none" : "0 4px 24px rgba(0,0,0,0.35)",
            }}
          >
            {active && (
              <span
                style={{
                  position: "absolute",
                  inset: "0.04em -0.02em 0.02em",
                  background: style.colors.accent,
                  borderRadius: Math.min(style.radius, 10),
                  zIndex: -1,
                }}
              />
            )}
            {word.text}
          </span>
        );
      })}
    </div>
  );
}
