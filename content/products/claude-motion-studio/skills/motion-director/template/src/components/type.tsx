import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { ramp, styledFrame } from "../lib/motion";
import { useLook } from "./look";

/**
 * Text moves. Each one animates a single, honest property — position inside a
 * mask, scale, letter spacing, a marker behind the words — because type that
 * fades, slides, spins and blurs at once reads as a template.
 */

/** Splits text into words, keeping punctuation attached to its word. */
export const splitWords = (text: string) => text.split(/\s+/).filter(Boolean);

/**
 * A line that rises out of an invisible slot. The slot is padded so
 * descenders and Cyrillic diacritics are not clipped.
 */
export function MaskLine({
  children,
  delay = 0,
  duration,
  from = "below",
  exitAt,
  style: css,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  from?: "below" | "above";
  /** Frame at which the line drops out again, if it should leave before the cut. */
  exitAt?: number;
  style?: React.CSSProperties;
}) {
  const raw = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style } = useLook();
  const frame = styledFrame(raw, style);
  const length = duration ?? Math.round(style.beat * fps * 1.4);
  const enter = ramp(frame, delay, length, style.ease.out);
  const exit = exitAt === undefined ? 0 : ramp(frame, exitAt, Math.round(length * 0.7), style.ease.in);
  const sign = from === "below" ? 1 : -1;
  const y = (1 - enter) * 115 * sign - exit * 135 * sign;
  return (
    <span style={{ display: "inline-block", overflow: "hidden", padding: "0.12em 0.04em 0.16em", margin: "-0.12em -0.04em -0.16em", verticalAlign: "top", ...css }}>
      <span style={{ display: "inline-block", transform: `translateY(${y}%)`, willChange: "transform" }}>{children}</span>
    </span>
  );
}

/** Words that rise one after another. `highlight` puts a marker behind words by index. */
export function Words({
  text,
  delay = 0,
  step = 3,
  highlight = [],
  exitAt,
  gap = "0.24em",
}: {
  text: string;
  delay?: number;
  step?: number;
  highlight?: number[];
  exitAt?: number;
  gap?: string;
}) {
  const words = splitWords(text);
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", columnGap: gap }}>
      {words.map((word, i) => (
        <MaskLine key={`${word}-${i}`} delay={delay + i * step} exitAt={exitAt === undefined ? undefined : exitAt + i * 1}>
          {highlight.includes(i) ? <Marker delay={delay + i * step + 6}>{word}</Marker> : word}
        </MaskLine>
      ))}
    </span>
  );
}

/** A block of accent colour that wipes in behind text; the text flips to the on-accent colour. */
export function Marker({ children, delay = 0, duration }: { children: React.ReactNode; delay?: number; duration?: number }) {
  const frame = styledFrame(useCurrentFrame(), useLook().style);
  const { fps } = useVideoConfig();
  const { style } = useLook();
  const p = ramp(frame, delay, duration ?? Math.round(style.beat * fps), style.ease.inOut);
  return (
    <span style={{ position: "relative", display: "inline-block", padding: "0 0.12em", margin: "0 -0.12em" }}>
      <span
        style={{
          position: "absolute",
          inset: "0.02em 0 0.04em",
          background: style.colors.accent,
          transform: `scaleX(${p})`,
          transformOrigin: "left center",
          borderRadius: Math.min(style.radius, 8),
        }}
      />
      <span style={{ position: "relative", color: p > 0.5 ? style.colors.onAccent : "inherit" }}>{children}</span>
    </span>
  );
}

/** Lands from larger to its size with the style's spring — the "slam". */
export function Slam({ children, delay = 0, from = 1.6 }: { children: React.ReactNode; delay?: number; from?: number }) {
  const frame = styledFrame(useCurrentFrame(), useLook().style);
  const { fps } = useVideoConfig();
  const { style } = useLook();
  const s = spring({ frame: frame - delay, fps, config: style.spring });
  const scale = interpolate(s, [0, 1], [from, 1]);
  const opacity = interpolate(frame - delay, [0, 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <span style={{ display: "inline-block", transform: `scale(${scale})`, opacity }}>{children}</span>;
}

/** Letter spacing opens from tight to wide — or closes, with `reverse`. */
export function TrackIn({
  children,
  delay = 0,
  from = 0.6,
  to,
  duration,
}: {
  children: React.ReactNode;
  delay?: number;
  from?: number;
  to?: number;
  duration?: number;
}) {
  const frame = styledFrame(useCurrentFrame(), useLook().style);
  const { fps } = useVideoConfig();
  const { style } = useLook();
  const target = to ?? style.fonts.display.tracking;
  const p = ramp(frame, delay, duration ?? Math.round(style.beat * fps * 2.4), style.ease.out);
  const opacity = ramp(frame, delay, 6);
  return <span style={{ display: "inline-block", letterSpacing: `${from + (target - from) * p}em`, opacity }}>{children}</span>;
}

/** Characters appear at `cps` per second behind a block cursor. */
export function Typewriter({ text, delay = 0, cps = 24, cursor = true }: { text: string; delay?: number; cps?: number; cursor?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style } = useLook();
  const shown = Math.max(0, Math.min(text.length, Math.floor(((frame - delay) / fps) * cps)));
  const blinkOn = Math.floor(frame / (fps / 2)) % 2 === 0 || shown < text.length;
  return (
    <span>
      {text.slice(0, shown)}
      {cursor && frame >= delay && (
        <span style={{ display: "inline-block", width: "0.55em", height: "1em", verticalAlign: "-0.12em", marginLeft: "0.06em", background: blinkOn ? style.colors.accent : "transparent" }} />
      )}
    </span>
  );
}

/**
 * The same word stacked: outlined copies, one filled. A typographic echo for
 * a single key word.
 */
export function Echo({ word, copies = 5, delay = 0, filled = 2, size }: { word: string; copies?: number; delay?: number; filled?: number; size: number }) {
  const frame = styledFrame(useCurrentFrame(), useLook().style);
  const { fps } = useVideoConfig();
  const { style } = useLook();
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 0.86 }}>
      {Array.from({ length: copies }, (_, i) => {
        const p = ramp(frame, delay + i * 3, Math.round(style.beat * fps), style.ease.out);
        const solid = i === filled;
        return (
          <div
            key={i}
            style={{
              fontSize: size,
              color: solid ? style.colors.accent : "transparent",
              WebkitTextStroke: solid ? undefined : `2px ${style.colors.ink}`,
              opacity: solid ? p : p * (0.25 + 0.75 * (1 - Math.abs(i - filled) / copies)),
              transform: `translateY(${(1 - p) * 40}px)`,
            }}
          >
            {word}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The font size at which `text` exactly fills `width` in the display face of
 * the current style, capped at `max`. Measured with the real font, which is
 * why LookProvider waits for fonts before drawing anything.
 */
export function useFitSize(text: string, width: number, max = 9999): number {
  const { style, fonts } = useLook();
  const role = style.fonts.display;
  const { fontSize } = fitText({
    text,
    withinWidth: width,
    fontFamily: fonts.display,
    fontWeight: role.weight,
    letterSpacing: `${role.tracking}em`,
    textTransform: role.uppercase ? "uppercase" : undefined,
    validateFontIsLoaded: true,
  });
  return Math.min(max, Math.floor(fontSize));
}
