import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp } from "../lib/curves";

/**
 * Film grain that changes every frame but is identical on every render: the
 * SVG noise seed is the frame number. Overlaid in "overlay" mode so it lives
 * in the midtones like real grain, not as a grey veil.
 */
export function Grain({ amount = 0.08, size = 0.9 }: { amount?: number; size?: number }) {
  const frame = useCurrentFrame();
  if (amount <= 0) return null;
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: clamp(amount * 4, 0, 1), pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${frame}`}>
          <feTurbulence type="fractalNoise" baseFrequency={size} numOctaves={2} seed={frame % 997} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${frame})`} />
      </svg>
    </AbsoluteFill>
  );
}

/** Cinema bars. 2.39:1 inside a 16:9 frame is the anamorphic "film" read. */
export function Letterbox({ ratio = 2.39, color = "#000" }: { ratio?: number; color?: string }) {
  const { width, height } = useVideoConfig();
  const visible = width / ratio;
  const bar = Math.max(0, (height - visible) / 2);
  if (bar <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, background: color }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bar, background: color }} />
    </AbsoluteFill>
  );
}

/**
 * A white (or tinted) flash for impacts. `frames` is counted at 30 fps (2–4 at
 * most) and converted to seconds, so the flash lasts as long at 120 fps.
 */
export function Flash({ at, frames = 3, color = "#fff", peak = 0.85 }: { at: number; frames?: number; color?: string; peak?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = (frame / fps - at) / (frames / 30);
  if (k < 0 || k >= 1) return null;
  return <AbsoluteFill style={{ background: color, opacity: peak * (1 - k), mixBlendMode: "screen" }} />;
}

/**
 * Light leak: warm soft blobs drifting across the frame with screen blend.
 * Use sparingly between scenes — it reads as film, not as a filter.
 */
export function LightLeak({ at, duration = 0.9, color = "#ff8a3c", strength = 0.7 }: { at: number; duration?: number; color?: string; strength?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = (frame / fps - at) / duration;
  if (k < 0 || k > 1) return null;
  const env = Math.sin(k * Math.PI);
  const x = -20 + k * 140;
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: "screen",
        opacity: env * strength,
        background: `radial-gradient(40% 70% at ${x}% 40%, ${color} 0%, transparent 70%), radial-gradient(25% 45% at ${x - 25}% 70%, #fff3d6 0%, transparent 70%)`,
        filter: "blur(30px)",
      }}
    />
  );
}
