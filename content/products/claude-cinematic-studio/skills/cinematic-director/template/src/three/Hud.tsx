import React, { useMemo } from "react";
import * as THREE from "three";
import { ease, progress } from "../lib/curves";
import type { Look } from "../lib/looks";
import { useTime } from "../lib/time";
import { hdr } from "./Objects";
import { Type3D } from "./Type3D";
import type { Vec3 } from "./camera";

const deg = Math.PI / 180;

function ringTicks(radius: number, count: number, long: number, every: number) {
  const pts: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const l = i % every === 0 ? long : long * 0.45;
    pts.push(Math.cos(a) * radius, Math.sin(a) * radius, 0, Math.cos(a) * (radius + l), Math.sin(a) * (radius + l), 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/**
 * A targeting HUD in 3D space: tick ring, rotating arcs, corner brackets and
 * a mono readout. It sits at a depth, so the camera moves around it like a
 * hologram rather than a sticker on the lens.
 */
export function HudReticle({
  look,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  radius = 1.4,
  appear = 0,
  label,
  value,
  glow = 2.2,
}: {
  look: Look;
  position?: Vec3;
  rotation?: Vec3;
  radius?: number;
  appear?: number;
  label?: string;
  value?: string;
  glow?: number;
}) {
  const t = useTime();
  const ticks = useMemo(() => ringTicks(radius, 120, radius * 0.08, 10), [radius]);
  const k = ease.expoOut(progress(t, appear, appear + 1.1));
  if (k <= 0) return null;
  const color = hdr(look.accent, glow);
  const dim = hdr(look.accent, glow * 0.35);
  const local = t - appear;
  return (
    <group position={position} rotation={[rotation[0] * deg, rotation[1] * deg, rotation[2] * deg]} scale={0.6 + 0.4 * k}>
      <lineSegments geometry={ticks} rotation={[0, 0, local * 0.15]}>
        <lineBasicMaterial color={dim} toneMapped={false} transparent opacity={k} />
      </lineSegments>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[0, 0, local * (0.6 - i * 0.45) + i * 2.1]}>
          <ringGeometry args={[radius * (0.8 - i * 0.07), radius * (0.8 - i * 0.07) + 0.012, 128, 1, 0, Math.PI * (0.35 + i * 0.25) * k]} />
          <meshBasicMaterial color={i === 1 ? hdr(look.accent2, glow) : color} toneMapped={false} side={THREE.DoubleSide} transparent opacity={k} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => {
        const a = i * 90 + 45;
        const r = radius * 1.25 * (1.4 - 0.4 * k);
        return (
          <group key={i} position={[Math.cos(a * deg) * r, Math.sin(a * deg) * r, 0]} rotation={[0, 0, (a + 135) * deg]}>
            <mesh position={[0.09, 0, 0]}>
              <planeGeometry args={[0.18, 0.012]} />
              <meshBasicMaterial color={color} toneMapped={false} transparent opacity={k} />
            </mesh>
            <mesh position={[0, 0.09, 0]}>
              <planeGeometry args={[0.012, 0.18]} />
              <meshBasicMaterial color={color} toneMapped={false} transparent opacity={k} />
            </mesh>
          </group>
        );
      })}
      {label && (
        <Type3D
          text={label}
          look={look}
          font={look.font.mono}
          size={radius * 0.085}
          depth={0.002}
          bevel={0}
          position={[radius * 1.45, radius * 0.55, 0]}
          color="#000000"
          emissive={look.accent}
          emissiveIntensity={2}
          reveal={{ at: appear + 0.3, duration: 0.05, stagger: 0.025, ease: "linear", pose: { opacity: 0 } }}
        />
      )}
      {value && (
        <Type3D
          text={value}
          look={look}
          font={look.font.mono}
          size={radius * 0.16}
          depth={0.002}
          bevel={0}
          position={[radius * 1.6, radius * 0.3, 0]}
          color="#000000"
          emissive={look.accent2}
          emissiveIntensity={2.5}
          reveal={{ at: appear + 0.5, duration: 0.05, stagger: 0.04, ease: "linear", pose: { opacity: 0 } }}
        />
      )}
    </group>
  );
}
