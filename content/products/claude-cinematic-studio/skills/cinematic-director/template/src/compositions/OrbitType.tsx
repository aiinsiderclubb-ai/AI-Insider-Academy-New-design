import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { LOOKS, lookOf } from "../lib/looks";
import { ease, progress } from "../lib/curves";
import { Stage } from "../three/Stage";
import { GlassCore, Rings } from "../three/Objects";
import { RingType } from "../three/RingType";
import { Dust } from "../three/Particles";
import { HudReticle } from "../three/Hud";
import { REVEALS, Type3D } from "../three/Type3D";
import { crane, cutBetween, handheld, orbit } from "../three/camera";
import { Grain } from "../layers/Finish";

const lookEnum = z.enum(Object.keys(LOOKS) as [keyof typeof LOOKS, ...(keyof typeof LOOKS)[]]);

export const orbitTypeSchema = z.object({
  look: lookEnum,
  ring: z.string(),
  ring2: z.string(),
  title: z.string(),
  label: z.string(),
  value: z.string(),
  fps: z.number().optional(),
});

/**
 * Type in orbit, 9 s. A glass core turns at the centre; two rings of words
 * travel around it — in front, then behind, refracted by the glass on the far
 * side. The camera cranes down into a slow orbit, a HUD reads out a value,
 * and the title lands under the core.
 */
export const OrbitType: React.FC<z.infer<typeof orbitTypeSchema>> = ({ look: lookName, ring, ring2, title, label, value }) => {
  const look = lookOf(lookName);
  const base = handheld(
    cutBetween([
      [0, crane({ end: 3.2, z: 6.2, fromY: 3.2, toY: 0.5, target: [0, -0.1, 0], mm: 35 })],
      [3.2, orbit({ start: 3.2, end: 9, center: [0, -0.1, 0], radius: 6.2, height: 0.35, fromDeg: 0, toDeg: 28, mm: 35, radiusTo: 5.6, ease: "sineInOut" })],
    ]),
    0.03,
  );
  // Tilt the aim down from the core to the title as it lands.
  const aimDown = (t: number) => -0.75 * ease.silk(progress(t, 4.6, 6.4));
  const camera = { ...base, target: (t: number) => { const p = base.target(t); return [p[0], p[1] + aimDown(t), p[2]] as [number, number, number]; } };
  return (
    <AbsoluteFill style={{ background: look.background }}>
      <Stage look={look} camera={camera} focusRange={3.5}>
        <GlassCore look={look} shape="knot" radius={1.05} spin={18} />
        <RingType text={ring} look={look} radius={2.3} size={0.3} speed={22} tilt={[12, 0, -8]} appear={0.4} glow={0.35} />
        <RingType text={ring2} look={look} font={look.font.mono} radius={3.1} size={0.12} speed={-14} tilt={[-10, 0, 8]} appear={1.2} glow={1.2} />
        <Rings look={look} radius={3.4} count={2} appear={2} glow={2} />
        <HudReticle look={look} position={[2.1, 1.1, -0.3]} rotation={[0, -20, 0]} radius={0.4} appear={4.2} label={label} value={value} />
        <Type3D text={title} look={look} size={0.34} depth={0.1} position={[0, -2.05, 0.6]} reveal={{ at: 5.2, ...REVEALS.flip }} />
        <Dust look={look} count={600} size={0.04} />
      </Stage>
      <Grain amount={look.post.grain} />
    </AbsoluteFill>
  );
};
