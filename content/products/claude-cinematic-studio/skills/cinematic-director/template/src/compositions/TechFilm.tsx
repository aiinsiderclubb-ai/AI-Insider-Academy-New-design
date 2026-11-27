import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { LOOKS, lookOf, type Look } from "../lib/looks";
import { track } from "../lib/curves";
import { Stage } from "../three/Stage";
import { EXITS, REVEALS, Type3D } from "../three/Type3D";
import { GridFloor, Monolith, Rings } from "../three/Objects";
import { Burst, Dust } from "../three/Particles";
import { LightTrail, Streaks } from "../three/Trails";
import { HudReticle } from "../three/Hud";
import { dollyZoom, handheld, locked, orbit } from "../three/camera";
import { Sequence2 } from "../layers/Transitions";
import { Flash, Grain, Letterbox, LightLeak } from "../layers/Finish";

const lookEnum = z.enum(Object.keys(LOOKS) as [keyof typeof LOOKS, ...(keyof typeof LOOKS)[]]);

export const techFilmSchema = z.object({
  look: lookEnum,
  line1: z.string(),
  hudLabel: z.string(),
  hudValue: z.string(),
  brand: z.string(),
  tagline: z.string(),
  fps: z.number().optional(),
});

type P = z.infer<typeof techFilmSchema>;

/** Shot 1: hyperspace. Streaks accelerate, the word flies past the lens. */
function Warp({ look, line1 }: { look: Look; line1: string }) {
  const travel = track<number>([
    [0, 0],
    [2.2, 30, "expoIn"],
    [3.4, 95, "expoIn"],
  ]);
  return (
    <Stage look={look} camera={handheld(locked([0, 0.2, 6], [0, 0, -10], 28), 0.04, 1.2)} focusRange={6}>
      <Streaks look={look} speed={(t) => travel(t)} count={220} radius={7} length={4} />
      <GridFloor look={look} y={-1.6} speed={14} />
      <Type3D text={line1} look={look} size={0.62} depth={0.2} maxWidth={5} reveal={{ at: 0.5, ...REVEALS.flyIn }} exit={{ at: 2.6, ...EXITS.pastCamera }} />
    </Stage>
  );
}

/** Shot 2: the object. Orbit around a device; a HUD locks on; light trails wrap it. */
function ObjectShot({ look, hudLabel, hudValue }: { look: Look; hudLabel: string; hudValue: string }) {
  return (
    <Stage
      look={look}
      camera={handheld(orbit({ start: 3.2, end: 7.4, radius: 7.2, height: 0.6, fromDeg: -40, toDeg: 20, mm: 40, radiusTo: 6.2 }), 0.03)}
      focusRange={2}
    >
      <Monolith look={look} spin={12} tilt={[0, -82, -8]} size={[1.3, 2.5, 0.14]} />
      <Rings look={look} radius={2.2} count={3} appear={3.0} glow={2.2} />
      <LightTrail look={look} start={3.6} duration={1.6} path={[[-4, -1, 2], [-1.5, 0.6, 1.6], [1.6, 0.9, -1.2], [3.5, -0.2, -3]]} />
      <LightTrail look={look} start={4.4} duration={1.4} color={look.accent2} path={[[3.5, 1.6, 2], [1, -0.4, 1.4], [-1.8, -0.9, -1], [-4, 0.4, -3]]} />
      <HudReticle look={look} position={[0.2, 0.7, 0.4]} rotation={[0, -10, 0]} radius={0.5} appear={4.3} label={hudLabel} value={hudValue} />
      <Dust look={look} count={500} size={0.03} />
    </Stage>
  );
}

/** Shot 3: the lockup. Impact on the cut, title swings in, rings settle, vertigo push. */
function Lockup({ look, brand, tagline }: { look: Look; brand: string; tagline: string }) {
  return (
    <Stage look={look} camera={dollyZoom({ start: 7.2, end: 12, fromDist: 7.5, toDist: 5.2, height: 0.1 })} focusRange={2.5}>
      <Type3D text={brand} look={look} size={0.8} depth={0.3} bevel={0.03} maxWidth={5.2} reveal={{ at: 7.35, ...REVEALS.burst }} wobble={0.008} />
      <Type3D
        text={tagline}
        look={look}
        font={look.font.mono}
        size={0.15}
        depth={0.004}
        bevel={0}
        tracking={0.3}
        position={[0, -0.85, 0.2]}
        color="#000000"
        emissive={look.accent}
        emissiveIntensity={1.6}
        reveal={{ at: 8.4, duration: 0.05, stagger: 0.03, ease: "linear", pose: { opacity: 0 } }}
      />
      <Burst look={look} at={7.35} count={320} speed={5} />
      <Rings look={look} radius={2.6} count={3} appear={7.5} glow={2.4} />
      <GridFloor look={look} y={-1.5} speed={0.6} glow={0.8} />
      <Dust look={look} count={400} size={0.03} />
    </Stage>
  );
}

/**
 * Futuristic brand film, 12 s, three shots: warp → object → lockup. Cuts are
 * a zoom-through and a whip pan with a flash on the impact. Times are in
 * seconds, so the film renders at any fps (see grade-finish for 4× motion blur).
 */
export const TechFilm: React.FC<P> = ({ look: lookName, line1, hudLabel, hudValue, brand, tagline }) => {
  const look = lookOf(lookName);
  return (
    <AbsoluteFill style={{ background: look.background }}>
      <Sequence2
        at={3.2}
        kind="zoom"
        duration={0.4}
        a={<Warp look={look} line1={line1} />}
        b={
          <Sequence2
            at={7.2}
            kind="whip"
            duration={0.34}
            a={<ObjectShot look={look} hudLabel={hudLabel} hudValue={hudValue} />}
            b={<Lockup look={look} brand={brand} tagline={tagline} />}
          />
        }
      />
      <Flash at={7.35} frames={3} color={look.accent} peak={0.6} />
      <LightLeak at={3.0} duration={0.6} color={look.accent2} strength={0.5} />
      <Letterbox ratio={2.2} />
      <Grain amount={look.post.grain} />
    </AbsoluteFill>
  );
};
