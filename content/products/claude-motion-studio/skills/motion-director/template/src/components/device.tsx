import React from "react";
import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { mix, ramp } from "../lib/motion";
import { useLook, useMonoType } from "./look";

/**
 * Device frames, a cursor and callouts for product promos. Coordinates on a
 * screenshot are fractions (0–1) of its width and height, so the same shot
 * list works whatever size the screenshots were captured at.
 */

export type Zoom = { x: number; y: number; scale: number; at: number; hold?: number };

/** Scale and offset of the camera on a screenshot at the current frame. */
export function useZoom(zoom: Zoom | undefined, width: number, height: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style } = useLook();
  let scale = 1;
  let x = 0.5;
  let y = 0.5;
  if (zoom) {
    const start = Math.round(zoom.at * fps);
    const hold = Math.round((zoom.hold ?? 1.4) * fps);
    const move = Math.round(style.beat * fps * 1.8);
    const p = Math.min(ramp(frame, start, move, style.ease.inOut), 1 - ramp(frame, start + move + hold, move, style.ease.inOut));
    scale = mix(1, zoom.scale, p);
    x = mix(0.5, zoom.x, p);
    y = mix(0.5, zoom.y, p);
  }
  // Keep the zoomed point centred without showing past the image edges.
  const tx = Math.max(Math.min((0.5 - x) * width * scale, ((scale - 1) * width) / 2), (-(scale - 1) * width) / 2);
  const ty = Math.max(Math.min((0.5 - y) * height * scale, ((scale - 1) * height) / 2), (-(scale - 1) * height) / 2);
  /** Where a point on the screenshot (fractions) is in the window right now (fractions). */
  const map = (px: number, py: number) => ({
    x: 0.5 + (px - 0.5) * scale + tx / width,
    y: 0.5 + (py - 0.5) * scale + ty / height,
  });
  return { scale, tx, ty, map };
}

/**
 * A screenshot that can push in on a point. The zoom eases in, holds, eases
 * out; `x`/`y` is the point that ends up in the middle of the window.
 */
export function Screen({ src, zoom, width, height }: { src: string; zoom?: Zoom; width: number; height: number }) {
  const { scale, tx, ty } = useZoom(zoom, width, height);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <Img
        src={src}
        style={{ width, height, objectFit: "cover", objectPosition: "top center", transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: "center center" }}
      />
    </div>
  );
}

/** A desktop browser window: a slim bar with the address, then the page. */
export function BrowserFrame({ url, width, height, children }: { url?: string; width: number; height: number; children: React.ReactNode }) {
  const { style } = useLook();
  const mono = useMonoType();
  const bar = Math.round(height * 0.055);
  return (
    <div
      style={{
        width,
        height: height + bar,
        borderRadius: Math.min(style.radius + 6, 22),
        overflow: "hidden",
        background: style.colors.panel,
        border: `1px solid ${style.colors.line}`,
        boxShadow: "0 60px 120px -40px rgba(0,0,0,0.65), 0 20px 40px -20px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: 10, padding: "0 22px", borderBottom: `1px solid ${style.colors.line}` }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: style.colors.line }} />
        ))}
        {url && (
          <span style={{ ...mono, marginLeft: 22, fontSize: bar * 0.34, letterSpacing: "0.04em", textTransform: "none", color: style.colors.muted }}>
            {url}
          </span>
        )}
      </div>
      <div style={{ position: "relative", width, height }}>{children}</div>
    </div>
  );
}

/** A phone: rounded body, a narrow bezel, the screen inside. */
export function PhoneFrame({ width, children }: { width: number; children: React.ReactNode }) {
  const { style } = useLook();
  const height = width * 2.08;
  const bezel = width * 0.035;
  return (
    <div style={{ width, height, borderRadius: width * 0.14, background: "#0a0a0a", padding: bezel, boxShadow: `0 0 0 2px ${style.colors.line}, 0 60px 120px -40px rgba(0,0,0,0.7)` }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: width * 0.11, overflow: "hidden", background: style.colors.panel }}>{children}</div>
    </div>
  );
}

export type CursorStop = { x: number; y: number; at: number };

/**
 * A pointer that travels between stops with the style's easing, and shows a
 * ring when it clicks. Stops are in seconds and fractions of the frame it sits in.
 */
export function Cursor({
  stops,
  clicks = [],
  width,
  height,
  map = (x, y) => ({ x, y }),
}: {
  stops: CursorStop[];
  clicks?: number[];
  width: number;
  height: number;
  /** Screenshot → window mapping from useZoom, so the pointer rides the camera. */
  map?: (x: number, y: number) => { x: number; y: number };
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style } = useLook();
  if (!stops.length) return null;
  const frames = stops.map((s) => Math.round(s.at * fps));
  let x = stops[0].x;
  let y = stops[0].y;
  for (let i = 1; i < stops.length; i++) {
    const p = ramp(frame, frames[i - 1], frames[i] - frames[i - 1], style.ease.inOut);
    if (frame >= frames[i - 1]) {
      x = mix(stops[i - 1].x, stops[i].x, p);
      y = mix(stops[i - 1].y, stops[i].y, p);
    }
  }
  ({ x, y } = map(x, y));
  const visible = ramp(frame, frames[0] - 6, 6);
  let press = 0;
  let ring = 0;
  for (const click of clicks) {
    const c = Math.round(click * fps);
    const age = frame - c;
    if (age >= -3 && age < 4) press = 1;
    if (age >= 0 && age < 18) ring = age / 18;
  }
  return (
    <div style={{ position: "absolute", left: x * width, top: y * height, opacity: visible, pointerEvents: "none" }}>
      {ring > 0 && (
        <div
          style={{
            position: "absolute",
            left: -40 * (0.4 + ring),
            top: -40 * (0.4 + ring),
            width: 80 * (0.4 + ring),
            height: 80 * (0.4 + ring),
            borderRadius: "50%",
            border: `4px solid ${style.colors.accent}`,
            opacity: 1 - ring,
          }}
        />
      )}
      <svg width={44} height={44} viewBox="0 0 24 24" style={{ transform: `scale(${press ? 0.86 : 1})`, transformOrigin: "4px 3px", filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.45))" }}>
        <path d="M4 3 L4 19 L8.6 14.6 L11.6 21 L14.4 19.8 L11.4 13.5 L18 13.5 Z" fill="#ffffff" stroke="#0a0a0a" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/**
 * A label with a leader line pointing at a spot. The line draws first, then
 * the label rises — the eye follows the line to the thing.
 */
export function Callout({
  x,
  y,
  text,
  at,
  side = "right",
  length = 160,
  width,
  height,
}: {
  x: number;
  y: number;
  text: string;
  at: number;
  side?: "left" | "right";
  length?: number;
  width: number;
  height: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, fonts } = useLook();
  const start = Math.round(at * fps);
  const line = ramp(frame, start, Math.round(fps * style.beat), style.ease.out);
  const label = ramp(frame, start + 8, Math.round(fps * style.beat), style.ease.out);
  const dir = side === "right" ? 1 : -1;
  return (
    <div style={{ position: "absolute", left: x * width, top: y * height, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: -9, top: -9, width: 18, height: 18, borderRadius: 9, background: style.colors.accent, transform: `scale(${interpolate(line, [0, 0.3, 1], [0, 1.3, 1])})` }} />
      <div style={{ position: "absolute", top: 0, left: dir > 0 ? 0 : -length * line, width: length * line, height: 2, background: style.colors.accent }} />
      <div
        style={{
          position: "absolute",
          top: -30,
          left: dir > 0 ? length + 16 : undefined,
          right: dir < 0 ? length + 16 : undefined,
          whiteSpace: "nowrap",
          fontFamily: fonts.text,
          fontWeight: 700,
          fontSize: 40,
          color: style.colors.onAccent,
          background: style.colors.accent,
          padding: "6px 18px 8px",
          borderRadius: Math.min(style.radius, 10),
          opacity: label,
          transform: `translateY(${(1 - label) * 24}px)`,
        }}
      >
        {text}
      </div>
    </div>
  );
}
