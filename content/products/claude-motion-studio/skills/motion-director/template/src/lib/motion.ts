import { Easing, interpolate } from "remotion";
import type { Bezier, Style } from "../styles/styles";

/**
 * Small, boring helpers that keep compositions readable. Times in props are
 * seconds (people think in seconds); everything inside is frames.
 */

export const bezier = (curve: Bezier) => Easing.bezier(...curve);

/** Seconds → frames, rounded so cuts land on whole frames. */
export const sec = (seconds: number, fps: number) => Math.round(seconds * fps);

/**
 * 0 → 1 over `duration` frames starting at `start`, eased and clamped.
 * The workhorse: almost every move in the library is `ramp` + interpolate.
 */
export function ramp(frame: number, start: number, duration: number, curve: Bezier = [0.16, 1, 0.3, 1]): number {
  if (duration <= 0) return frame >= start ? 1 : 0;
  return interpolate(frame, [start, start + duration], [0, 1], {
    easing: bezier(curve),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** In, hold, out: 0 → 1 → 0. For things that appear and leave. */
export function inOut(frame: number, start: number, end: number, fade: number, curve: Bezier): number {
  return Math.min(ramp(frame, start, fade, curve), 1 - ramp(frame, end - fade, fade, curve));
}

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Holds every second frame when the style animates on twos. */
export const styledFrame = (frame: number, style: Style) => (style.onTwos ? frame - (frame % 2) : frame);

/** Beat times in seconds → frames. Beats come from the beat-sync skill. */
export const beatFrames = (beats: number[] | undefined, fps: number) => (beats ?? []).map((b) => sec(b, fps));

/**
 * 1 on a beat, falling to 0 over `decay` frames. Drive scale, brightness or a
 * flash with it so the picture breathes with the music.
 */
export function pulse(frame: number, beats: number[], decay = 8): number {
  let value = 0;
  for (const beat of beats) {
    const age = frame - beat;
    if (age >= 0 && age < decay) value = Math.max(value, 1 - age / decay);
  }
  return value;
}

/** The beat at or before `frame`, for cutting on the beat. */
export function lastBeat(frame: number, beats: number[]): number {
  let found = -1;
  for (const beat of beats) if (beat <= frame) found = beat;
  return found;
}

/** Snaps a planned cut to the nearest beat within `tolerance` frames. */
export function snapToBeat(frame: number, beats: number[], tolerance = 4): number {
  let best = frame;
  let distance = tolerance + 1;
  for (const beat of beats) {
    const d = Math.abs(beat - frame);
    if (d < distance) {
      best = beat;
      distance = d;
    }
  }
  return best;
}

/** Deterministic pseudo-random in [0, 1) — never Math.random() in a render. */
export function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
