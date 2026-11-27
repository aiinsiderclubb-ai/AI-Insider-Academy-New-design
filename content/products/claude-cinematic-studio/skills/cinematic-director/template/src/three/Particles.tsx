import React, { useMemo } from "react";
import * as THREE from "three";
import { rng } from "../lib/curves";
import type { Look } from "../lib/looks";
import { useTime } from "../lib/time";
import { hdr } from "./Objects";
import type { Vec3 } from "./camera";

/** Soft round sprite so points read as specks of light, not squares. */
function useDot() {
  return useMemo(() => {
    const size = 64;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

/**
 * Atmosphere: dust in a light beam. Positions come from a seed and drift as a
 * function of time, so every render is identical and the camera can fly
 * through them for parallax.
 */
export function Dust({
  look,
  count = 900,
  box = [16, 9, 14],
  center = [0, 0, -2],
  size = 0.05,
  drift = [0.05, 0.12, 0.02],
  glow = 1.4,
  seed = 3,
  color,
}: {
  look: Look;
  count?: number;
  box?: Vec3;
  center?: Vec3;
  size?: number;
  /** Units per second. */
  drift?: Vec3;
  glow?: number;
  seed?: number;
  color?: string;
}) {
  const t = useTime();
  const dot = useDot();
  const boxKey = box.join(",");
  const base = useMemo(() => {
    const r = rng(seed);
    return Float32Array.from({ length: count * 3 }, (_, i) => (r() - 0.5) * box[i % 3]);
    // box is compared by value: an inline [16, 9, 14] is a new array every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, boxKey, seed]);
  const positions = useMemo(() => {
    const out = new Float32Array(base.length);
    for (let i = 0; i < base.length; i++) {
      const axis = i % 3;
      const half = box[axis] / 2;
      const wobble = Math.sin(t * 0.7 + i * 1.7) * 0.06;
      let v = base[i] + drift[axis] * t + wobble;
      v = ((((v + half) % box[axis]) + box[axis]) % box[axis]) - half;
      out[i] = v + center[axis];
    }
    return out;
  }, [base, t, box, drift, center]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={dot}
        size={size}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color={hdr(color ?? look.accent, glow)}
        toneMapped={false}
      />
    </points>
  );
}

/**
 * A burst: particles thrown from a point at `at` seconds, slowed by drag and
 * pulled by gravity, fading as they go. Put it on an impact frame.
 */
export function Burst({
  look,
  at,
  origin = [0, 0, 0],
  count = 260,
  speed = 4,
  drag = 2.2,
  gravity = -1.2,
  life = 1.6,
  size = 0.06,
  seed = 9,
  color,
}: {
  look: Look;
  at: number;
  origin?: Vec3;
  count?: number;
  speed?: number;
  drag?: number;
  gravity?: number;
  life?: number;
  size?: number;
  seed?: number;
  color?: string;
}) {
  const t = useTime() - at;
  const dot = useDot();
  const dirs = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => {
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const v = speed * (0.35 + r() * 0.65);
      return [Math.cos(a) * s * v, u * v, Math.sin(a) * s * v] as Vec3;
    });
  }, [count, speed, seed]);
  if (t < 0 || t > life) return null;
  const travel = (1 - Math.exp(-drag * t)) / drag;
  const positions = new Float32Array(count * 3);
  dirs.forEach((d, i) => {
    positions[i * 3] = origin[0] + d[0] * travel;
    positions[i * 3 + 1] = origin[1] + d[1] * travel + 0.5 * gravity * t * t;
    positions[i * 3 + 2] = origin[2] + d[2] * travel;
  });
  const fade = 1 - t / life;
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={dot}
        size={size}
        sizeAttenuation
        transparent
        opacity={fade}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color={hdr(color ?? look.accent, 3)}
        toneMapped={false}
      />
    </points>
  );
}
