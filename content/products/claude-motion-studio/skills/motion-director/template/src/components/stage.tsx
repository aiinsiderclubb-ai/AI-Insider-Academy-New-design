import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ramp } from "../lib/motion";
import { useLook, useMonoType } from "./look";

/**
 * Film grain from an SVG noise filter whose seed changes every frame. Cheap,
 * deterministic, and enough to stop flat colour from looking like a slide.
 */
export function Grain({ amount }: { amount?: number }) {
  const frame = useCurrentFrame();
  const { style } = useLook();
  const opacity = amount ?? style.texture.grain;
  if (opacity <= 0) return null;
  const id = "grain-filter";
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "normal" }}>
      <svg width="100%" height="100%">
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 97} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
    </AbsoluteFill>
  );
}

function Scanlines() {
  const { style } = useLook();
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `repeating-linear-gradient(0deg, transparent 0px, transparent 3px, ${style.colors.ground}55 3px, ${style.colors.ground}55 4px)`,
      }}
    />
  );
}

/** The ground of every composition: colour, texture, and the content between. */
export function Stage({ children, grain }: { children: React.ReactNode; grain?: number }) {
  const { style } = useLook();
  return (
    <AbsoluteFill style={{ backgroundColor: style.colors.ground, overflow: "hidden" }}>
      {children}
      {style.texture.scanlines && <Scanlines />}
      <Grain amount={grain} />
    </AbsoluteFill>
  );
}

/** Timecode as HH:MM:SS:FF — reads as "made by someone who edits video". */
export function timecode(frame: number, fps: number): string {
  const ff = frame % fps;
  const total = Math.floor(frame / fps);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}:${pad(ff)}`;
}

/**
 * Small mono labels in the four corners, like the margins of a printed
 * poster. Pass `null` to leave a corner empty; "{tc}" becomes the timecode.
 */
export function Corners({
  tl,
  tr = "{tc}",
  bl,
  br,
  inset = 56,
  size = 20,
  delay = 0,
}: {
  tl?: string | null;
  tr?: string | null;
  bl?: string | null;
  br?: string | null;
  inset?: number;
  size?: number;
  delay?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mono = useMonoType();
  const opacity = ramp(frame, delay, 12);
  const fill = (value?: string | null) => (value ?? "").replace("{tc}", timecode(frame, fps));
  const base: React.CSSProperties = { ...mono, position: "absolute", fontSize: size, opacity, whiteSpace: "nowrap" };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {tl && <div style={{ ...base, left: inset, top: inset }}>{fill(tl)}</div>}
      {tr && <div style={{ ...base, right: inset, top: inset }}>{fill(tr)}</div>}
      {bl && <div style={{ ...base, left: inset, bottom: inset }}>{fill(bl)}</div>}
      {br && <div style={{ ...base, right: inset, bottom: inset }}>{fill(br)}</div>}
    </AbsoluteFill>
  );
}

/**
 * Hairline grid that draws itself in. Columns are the layout grid the
 * composition actually uses — show it only when the style calls for it.
 */
export function GridLines({
  columns = 6,
  rows = 0,
  inset = 56,
  delay = 0,
  duration = 24,
}: {
  columns?: number;
  rows?: number;
  inset?: number;
  delay?: number;
  duration?: number;
}) {
  const frame = useCurrentFrame();
  const { style } = useLook();
  const { width, height } = useVideoConfig();
  const lines: React.ReactNode[] = [];
  for (let i = 0; i <= columns; i++) {
    const p = ramp(frame, delay + i * 2, duration, style.ease.out);
    const x = inset + ((width - inset * 2) * i) / columns;
    lines.push(
      <div key={`c${i}`} style={{ position: "absolute", left: x, top: inset, width: 1, height: (height - inset * 2) * p, background: style.colors.line }} />,
    );
  }
  for (let j = 0; j <= rows; j++) {
    if (!rows) break;
    const p = ramp(frame, delay + j * 2, duration, style.ease.out);
    const y = inset + ((height - inset * 2) * j) / rows;
    lines.push(
      <div key={`r${j}`} style={{ position: "absolute", top: y, left: inset, height: 1, width: (width - inset * 2) * p, background: style.colors.line }} />,
    );
  }
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{lines}</AbsoluteFill>;
}
