import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { LOOKS, lookOf } from "../lib/looks";
import { Stage } from "../three/Stage";
import { EXITS, REVEALS, Type3D } from "../three/Type3D";
import { Burst } from "../three/Particles";
import { Streaks } from "../three/Trails";
import { cutBetween, dolly, type CameraMove } from "../three/camera";
import { Flash, Grain } from "../layers/Finish";

const lookEnum = z.enum(Object.keys(LOOKS) as [keyof typeof LOOKS, ...(keyof typeof LOOKS)[]]);

export const kineticSpotSchema = z.object({
  look: lookEnum,
  words: z.array(z.string()).min(2).max(6),
  final: z.string(),
  bpm: z.number().min(60).max(180),
  fps: z.number().optional(),
});

/**
 * Sport-style vertical spot. One word per bar, each slammed in on the beat
 * with a different camera angle — the cuts happen inside the 3D space, so
 * the words stay in one world. Accent word in the acid colour, flash and
 * particle burst on every downbeat, the final line holds.
 */
export const KineticSpot: React.FC<z.infer<typeof kineticSpotSchema>> = ({ look: lookName, words, final, bpm }) => {
  const look = lookOf(lookName);
  const bar = (60 / bpm) * 2; // a word every two beats
  const angles: [number, number, number][] = [
    [0, 0, 7],
    [-1.6, 1.0, 6.4],
    [1.7, -0.8, 6.6],
    [-0.9, -1.3, 6.2],
    [1.4, 1.3, 6.8],
    [0, 0.4, 6],
  ];
  const shots: [number, CameraMove][] = words.map((_, i) => {
    const a = angles[i % angles.length];
    const start = i * bar;
    // Each cut lands on a new angle and pushes in hard, then settles: a snap zoom.
    return [start, dolly({ start, end: start + bar, from: [a[0] * 1.3, a[1] * 1.3, a[2] + 2.4], to: [a[0], a[1], a[2]], lookTo: [0, 0, 0], ease: "snap", mmFrom: 24, mmTo: 32, lookFrom: [0, 0, 0] })];
  });
  const finalAt = words.length * bar;
  shots.push([finalAt, dolly({ start: finalAt, end: finalAt + bar * 2, from: [0, 0, 9], to: [0, 0, 7.2], ease: "silk", mmFrom: 30, mmTo: 32 })]);
  return (
    <AbsoluteFill style={{ background: look.background }}>
      <Stage look={look} camera={cutBetween(shots)} focusRange={4} aberrationBoost={2}>
        {/* Echoes: dim copies of each word stacked above and below, further back —
            they fill the tall frame and give the hit depth and parallax. */}
        {words.map((w, i) =>
          [-2, -1, 1, 2].map((k) => (
            <Type3D
              key={`${i}e${k}`}
              text={w}
              look={look}
              size={0.95}
              depth={0.2}
              bevel={0}
              tracking={-0.01}
              maxWidth={2.3 + Math.abs(k) * 0.35}
              position={[0, k * 0.78, -Math.abs(k) * 1.1]}
              color="#5a5a5a"
              metalness={0.2}
              roughness={0.8}
              reveal={{ at: i * bar + Math.abs(k) * 0.05, ...REVEALS.burst, duration: 0.3, stagger: 0.015 }}
              exit={{ at: (i + 1) * bar - 0.12, ...EXITS.pastCamera, duration: 0.12, stagger: 0 }}
            />
          )),
        )}
        {words.map((w, i) => (
          <Type3D
            key={i}
            text={w}
            look={look}
            size={0.95}
            depth={0.5}
            bevel={0.03}
            tracking={-0.01}
            maxWidth={2.3}
            color={i % 2 ? look.accent : undefined}
            reveal={{ at: i * bar, ...(i % 2 ? REVEALS.flyIn : REVEALS.burst), duration: 0.32, stagger: 0.02 }}
            exit={{ at: (i + 1) * bar - 0.12, ...EXITS.pastCamera, duration: 0.12, stagger: 0 }}
          />
        ))}
        <Type3D text={final.replace(" ", "\n")} look={look} size={0.8} depth={0.35} lineHeight={1.05} maxWidth={2.3} position={[0, 0, 0]} reveal={{ at: finalAt, ...REVEALS.riseFromDepth, duration: 0.7 }} />
        {words.map((_, i) => (
          <Burst key={i} look={look} at={i * bar} count={180} speed={6} life={0.9} seed={i + 3} color={i % 2 ? look.accent : "#ffffff"} />
        ))}
        <Streaks look={look} speed={22} count={120} radius={5} length={2.5} glow={1.2} />
      </Stage>
      {words.map((_, i) => (
        <Flash key={i} at={i * bar} frames={2} peak={0.55} color={i % 2 ? look.accent : "#ffffff"} />
      ))}
      <Grain amount={look.post.grain} />
    </AbsoluteFill>
  );
};
