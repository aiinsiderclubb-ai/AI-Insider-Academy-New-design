import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { z } from "zod";
import { LOOKS, lookOf, type Look } from "../lib/looks";
import { ease, progress } from "../lib/curves";
import { useTime } from "../lib/time";
import { Stage } from "../three/Stage";
import { REVEALS, Type3D } from "../three/Type3D";
import { Dust } from "../three/Particles";
import { locked } from "../three/camera";
import { Cutout, Pinned, Plate, speedRamp } from "../layers/Footage";
import { Flash, Grain, LightLeak } from "../layers/Finish";

const lookEnum = z.enum(Object.keys(LOOKS) as [keyof typeof LOOKS, ...(keyof typeof LOOKS)[]]);

export const footageFxSchema = z.object({
  look: lookEnum,
  footage: z.string(),
  title: z.string(),
  callout: z.string(),
  calloutValue: z.string(),
  trackLabel: z.string(),
  fps: z.number().optional(),
});

/**
 * A tracked callout: a dot on the feature, a leader line, a label that types
 * on. `side` picks where the label goes — toward the emptier half of the frame.
 */
function Callout({ look, text, value, appear, side = "right" }: { look: Look; text: string; value: string; appear: number; side?: "left" | "right" }) {
  const t = useTime();
  const { width } = useVideoConfig();
  const k = ease.expoOut(progress(t, appear, appear + 0.8));
  if (k <= 0) return null;
  const line = 150 * (width / 1080) * k;
  const chars = Math.floor(progress(t, appear + 0.35, appear + 1.1) * text.length);
  const unit = width / 1080;
  const dir = side === "left" ? -1 : 1;
  return (
    <div style={{ position: "relative", width: 0, height: 0 }}>
      <div
        style={{
          position: "absolute",
          left: -9 * unit,
          top: -9 * unit,
          width: 18 * unit,
          height: 18 * unit,
          borderRadius: "50%",
          border: `${2 * unit}px solid ${look.accent}`,
          boxShadow: `0 0 ${18 * unit}px ${look.accent}`,
          transform: `scale(${0.4 + 0.6 * k})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: dir > 0 ? 12 * unit : -12 * unit - line,
          top: -1 * unit,
          width: line,
          height: 2 * unit,
          background: look.accent,
          boxShadow: `0 0 ${10 * unit}px ${look.accent}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          ...(dir > 0 ? { left: 24 * unit + line } : { right: 24 * unit + line }),
          textAlign: dir > 0 ? "left" : "right",
          top: -30 * unit,
          whiteSpace: "nowrap",
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
          color: "#fff",
          textShadow: `0 0 ${12 * unit}px ${look.accent}`,
        }}
      >
        <div style={{ fontSize: 28 * unit, letterSpacing: "0.12em", opacity: 0.8 }}>{text.slice(0, chars)}</div>
        <div style={{ fontSize: 54 * unit, fontWeight: 700, opacity: progress(t, appear + 0.9, appear + 1.2) }}>{value}</div>
      </div>
    </div>
  );
}

/**
 * Real footage with 3D in it, vertical, 6 s. The plate plays at real speed,
 * ramps into slow motion as the title rises BEHIND the product (3D type sits
 * between the plate and the product's cutout), a tracked callout locks onto a
 * feature, then the shot ramps out fast. Same edit works on any plate made by
 * footage-composite (frames.py + matte.py + track.py) or blender-3d.
 */
export const FootageFX: React.FC<z.infer<typeof footageFxSchema>> = ({ look: lookName, footage, title, callout, calloutValue, trackLabel }) => {
  const look = lookOf(lookName);
  const remap = speedRamp([
    [0, 1],
    [0.9, 1],
    [1.3, 0.28, "expoOut"],
    [3.9, 0.28],
    [4.4, 2.2, "expoIn"],
  ]);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Plate name={footage} remap={remap} />
      <Stage look={look} camera={locked([0, 0, 9], [0, 0, 0], 50)} transparent focusRange={6} aberrationBoost={0}>
        <Type3D
          text={title}
          look={look}
          size={1.05}
          depth={0.35}
          bevel={0.03}
          tracking={-0.02}
          maxWidth={2.4}
          position={[0, 1.1, -1]}
          reveal={{ at: 1.0, ...REVEALS.riseFromDepth, stagger: 0.07 }}
          exit={{ at: 4.3, duration: 0.5, stagger: 0.03, ease: "expoIn", pose: { y: 2.5, opacity: 0 } }}
        />
        <Dust look={look} count={350} size={0.045} glow={0.8} color="#ffffff" />
      </Stage>
      <Cutout name={footage} remap={remap} />
      <Pinned name={footage} label={trackLabel} remap={remap} followScale={false}>
        <Callout look={look} text={callout} value={calloutValue} appear={2.0} side="left" />
      </Pinned>
      <LightLeak at={4.25} duration={0.7} color={look.accent2} strength={0.45} />
      <Flash at={1.3} frames={2} peak={0.35} />
      <Grain amount={look.post.grain} />
    </AbsoluteFill>
  );
};
