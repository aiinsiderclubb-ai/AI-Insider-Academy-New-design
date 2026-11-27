import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ease, progress } from "../lib/curves";

/**
 * Cuts between two scenes. Both render only during the overlap, so heavy 3D
 * shots do not cost anything outside their own time.
 *
 *  - `cut`: hard cut on the frame — the default, and usually the right one.
 *  - `whip`: whip pan — both shots slide with directional blur, the cut hidden in the blur.
 *  - `zoom`: zoom-through — A punches in past the lens, B arrives from behind it.
 *  - `flash`: a 2-frame white-out at the cut, for impacts.
 *  - `fade`: dip through black, for a change of time or place.
 *
 * In-camera transitions (whip the 3D camera itself, fly through an object)
 * look better still; reach for these when the two shots are separate scenes.
 */
export type TransitionKind = "cut" | "whip" | "zoom" | "flash" | "fade";

export function Sequence2({
  a,
  b,
  at,
  kind = "cut",
  duration = 0.36,
  direction = 1,
}: {
  a: React.ReactNode;
  b: React.ReactNode;
  /** Seconds where B takes over (the middle of the transition). */
  at: number;
  kind?: TransitionKind;
  duration?: number;
  /** 1 = moves left (camera pans right), -1 = moves right. */
  direction?: 1 | -1;
}) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const half = kind === "cut" || kind === "flash" ? 0 : duration / 2;
  const before = t < at;

  if (kind === "cut" || kind === "flash") {
    return (
      <AbsoluteFill>
        {before ? a : b}
        {kind === "flash" && t >= at && t < at + 2 / 30 && <AbsoluteFill style={{ background: "#fff", opacity: 0.9 * (1 - (t - at) * 15) }} />}
      </AbsoluteFill>
    );
  }

  const k = progress(t, at - half, at + half);
  const inside = t >= at - half && t < at + half;

  if (kind === "fade") {
    // Dip through black: A fades down to the cut, B fades up from it.
    return (
      <AbsoluteFill>
        {before ? a : b}
        {inside && <AbsoluteFill style={{ background: "#000", opacity: 1 - Math.abs(k * 2 - 1) }} />}
      </AbsoluteFill>
    );
  }

  if (kind === "whip") {
    // Outside the transition only one scene is mounted, so heavy 3D costs nothing extra.
    if (!inside) return <AbsoluteFill>{before ? a : b}</AbsoluteFill>;
    const e = ease.expoInOut(k);
    const blur = Math.sin(k * Math.PI) * 90;
    const id = `whip-${frame}`;
    const style = (shift: number): React.CSSProperties => ({
      transform: `translateX(${shift}px)`,
      filter: blur > 0.5 ? `url(#${id})` : undefined,
    });
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <svg width="0" height="0" style={{ position: "absolute" }}>
          <filter id={id} x="-20%" y="0" width="140%" height="100%">
            <feGaussianBlur stdDeviation={`${blur} 0`} />
          </filter>
        </svg>
        <AbsoluteFill style={style(-e * width * direction)}>{a}</AbsoluteFill>
        <AbsoluteFill style={style((1 - e) * width * direction)}>{b}</AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // zoom-through: A punches in past the lens and blows out; B settles from slightly larger.
  if (!inside) return <AbsoluteFill>{before ? a : b}</AbsoluteFill>;
  const inA = ease.expoIn(progress(t, at - half, at));
  const outB = ease.expoOut(progress(t, at, at + half));
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {before ? (
        <AbsoluteFill style={{ transform: `scale(${1 + inA * 2.2})`, filter: `blur(${inA * 14}px) brightness(${1 + inA * 1.5})` }}>{a}</AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ transform: `scale(${1.6 - outB * 0.6})`, filter: `blur(${(1 - outB) * 14}px) brightness(${1 + (1 - outB) * 1.2})` }}>{b}</AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
