import React, { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { ease as EASES, progress, rng, type EaseName } from "../lib/curves";
import type { Look } from "../lib/looks";
import { useTime } from "../lib/time";
import type { Vec3 } from "./camera";

/**
 * A streak of light travelling along a path: a head that glows and a tail
 * that fades to nothing. With bloom on, it reads as long-exposure light.
 */
export function LightTrail({
  look,
  path,
  start,
  duration = 1.4,
  length = 0.35,
  width = 4,
  glow = 4,
  ease = "quintInOut",
  color,
}: {
  look: Look;
  /** Control points; the trail follows a smooth curve through them. */
  path: Vec3[];
  start: number;
  duration?: number;
  /** Tail length as a fraction of the whole path. */
  length?: number;
  /** Line width in pixels at 1080p. */
  width?: number;
  glow?: number;
  ease?: EaseName;
  color?: string;
}) {
  const t = useTime();
  const pathKey = path.map((p) => p.join(",")).join(";");
  // Compared by value: an inline path is a new array on every frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const curve = useMemo(() => new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p))), [pathKey]);
  const head = EASES[ease](progress(t, start, start + duration)) * (1 + length);
  const tail = head - length;
  if (head <= 0 || tail >= 1) return null;
  const a = Math.max(0, tail);
  const b = Math.min(1, head);
  const steps = 64;
  const points: Vec3[] = [];
  const colors: [number, number, number][] = [];
  const c = new THREE.Color(color ?? look.accent);
  for (let i = 0; i <= steps; i++) {
    const u = a + ((b - a) * i) / steps;
    const p = curve.getPointAt(Math.min(1, Math.max(0, u)));
    points.push([p.x, p.y, p.z]);
    // Brightness rises toward the head; the tail end is black, which disappears with additive blending.
    const k = Math.pow((u - tail) / length, 2.2) * glow;
    colors.push([c.r * k, c.g * k, c.b * k]);
  }
  return (
    <Line
      points={points}
      vertexColors={colors}
      lineWidth={width}
      transparent
      blending={THREE.AdditiveBlending}
      depthWrite={false}
      toneMapped={false}
    />
  );
}

/**
 * Hyperspace streaks: lines rushing past the camera. `speed` in units per
 * second; ramp it with a track() for a speed-up into a cut.
 */
export function Streaks({
  look,
  count = 160,
  radius = 6,
  depth = 60,
  speed = 30,
  length = 3,
  glow = 2.2,
  seed = 21,
  opacity = 1,
}: {
  look: Look;
  count?: number;
  radius?: number;
  depth?: number;
  speed?: number | ((t: number) => number);
  length?: number;
  glow?: number;
  seed?: number;
  opacity?: number;
}) {
  const t = useTime();
  const lanes = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => {
      const a = r() * Math.PI * 2;
      const d = radius * (0.25 + Math.sqrt(r()) * 0.75);
      return { x: Math.cos(a) * d, y: Math.sin(a) * d, z0: r() * depth, hue: r() };
    });
  }, [count, radius, depth, seed]);
  // Distance travelled: integrate a constant or use the function as position.
  const travelled = typeof speed === "number" ? speed * t : speed(t);
  const positions = new Float32Array(count * 6);
  const colors = new Float32Array(count * 6);
  const a = new THREE.Color(look.accent);
  const b = new THREE.Color(look.accent2);
  lanes.forEach((l, i) => {
    const z = -(((l.z0 - travelled) % depth) + depth) % depth;
    positions.set([l.x, l.y, z, l.x, l.y, z - length], i * 6);
    const c = a.clone().lerp(b, l.hue).multiplyScalar(glow * opacity);
    colors.set([c.r, c.g, c.b, 0, 0, 0], i * 6);
  });
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </lineSegments>
  );
}
