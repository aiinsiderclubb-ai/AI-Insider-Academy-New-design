import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { LOOKS, lookOf } from "../lib/looks";
import { Stage } from "../three/Stage";
import { EXITS, REVEALS, Type3D } from "../three/Type3D";
import { MirrorFloor, Rings } from "../three/Objects";
import { Dust } from "../three/Particles";
import { cutBetween, dolly, handheld, orbit } from "../three/camera";
import { Grain, Letterbox } from "../layers/Finish";

export const heroTitleSchema = z.object({
  look: z.enum(Object.keys(LOOKS) as [keyof typeof LOOKS, ...(keyof typeof LOOKS)[]]),
  kicker: z.string(),
  title: z.string(),
  subtitle: z.string(),
});

/**
 * Premium title film, 8 s. Dolly in through dust while the title rises out of
 * depth, rings draw on, the camera eases into a slow orbit, then the type
 * recedes into the dark. One continuous shot: no cuts, all camera.
 */
export const HeroTitle: React.FC<z.infer<typeof heroTitleSchema>> = ({ look: lookName, kicker, title, subtitle }) => {
  const look = lookOf(lookName);
  const camera = handheld(
    cutBetween([
      [0, dolly({ from: [-1.8, 1.1, 12], to: [-0.6, 0.45, 7.6], end: 4.2, lookFrom: [0, 0.05, 0], mmFrom: 40, mmTo: 50 })],
      [4.2, orbit({ start: 4.2, end: 8, center: [0, 0.05, 0], radius: 7.62, height: 0.4, fromDeg: -4.5, toDeg: 8, mm: 50, radiusTo: 6.9, ease: "sineInOut" })],
    ]),
    0.025,
    0.5,
  );
  return (
    <AbsoluteFill style={{ background: look.background }}>
      <Stage look={look} camera={camera} focusRange={2.2}>
        <Type3D
          text={kicker}
          look={look}
          font={look.font.text}
          size={0.16}
          depth={0.01}
          bevel={0}
          tracking={0.35}
          position={[0, 0.72, 0]}
          reveal={{ at: 0.3, duration: 1.2, stagger: 0.03, ease: "expoOut", pose: { y: -0.15, opacity: 0 } }}
          exit={{ at: 6.6, ...EXITS.intoDepth }}
        />
        <Type3D
          text={title}
          look={look}
          size={0.56}
          depth={0.26}
          bevel={0.025}
          tracking={0.01}
          maxWidth={5.4}
          reveal={{ at: 0.6, ...REVEALS.riseFromDepth, stagger: 0.06 }}
          exit={{ at: 6.8, ...EXITS.intoDepth }}
          wobble={0.01}
        />
        <Type3D
          text={subtitle}
          look={look}
          font={look.font.text}
          size={0.2}
          depth={0.01}
          bevel={0}
          tracking={0.04}
          position={[0, -0.72, 0.15]}
          reveal={{ at: 3.4, duration: 1, stagger: 0.02, ease: "quintOut", pose: { y: 0.12, opacity: 0, rx: -30 } }}
          exit={{ at: 6.5, ...EXITS.intoDepth }}
        />
        <Rings look={look} radius={2.6} count={2} appear={1.6} glow={1.6} />
        <Dust look={look} count={700} size={0.035} glow={0.9} color="#ffffff" />
        <MirrorFloor look={look} y={-1.15} />
      </Stage>
      <Letterbox ratio={2.39} />
      <Grain amount={look.post.grain} />
    </AbsoluteFill>
  );
};
