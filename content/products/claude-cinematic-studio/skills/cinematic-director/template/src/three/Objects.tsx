import React, { useMemo } from "react";
import * as THREE from "three";
import { MeshReflectorMaterial, MeshTransmissionMaterial, RoundedBox } from "@react-three/drei";
import type { Look } from "../lib/looks";
import { useTime } from "../lib/time";
import type { Vec3 } from "./camera";

const deg = Math.PI / 180;
/** A colour pushed above 1.0 so bloom picks it up as a light source, not paint. */
export const hdr = (color: string, power = 3) => new THREE.Color(color).multiplyScalar(power);

/**
 * Hero objects. They are stand-ins until you have a real product: a model
 * from Blender (see `blender-3d`) drops into the same place. What matters is
 * that type and graphics share their space and pass in front and behind.
 */

/** Brushed-metal slab with rounded edges: phone, card, device, monolith. */
export function Monolith({
  look,
  size = [1.4, 2.6, 0.16],
  position = [0, 0, 0],
  spin = 0,
  tilt = [0, 0, 0],
  color,
}: {
  look: Look;
  size?: Vec3;
  position?: Vec3;
  /** Degrees per second around Y. */
  spin?: number;
  tilt?: Vec3;
  color?: string;
}) {
  const t = useTime();
  return (
    <group position={position} rotation={[tilt[0] * deg, (tilt[1] + spin * t) * deg, tilt[2] * deg]}>
      <RoundedBox args={size} radius={Math.min(...size) * 0.45} smoothness={6}>
        <meshPhysicalMaterial color={color ?? look.type.color} metalness={1} roughness={0.28} clearcoat={1} clearcoatRoughness={0.05} />
      </RoundedBox>
      {/* The "screen": a darker glass inset on the front face. */}
      <mesh position={[0, 0, size[2] / 2 + 0.002]}>
        <planeGeometry args={[size[0] * 0.88, size[1] * 0.92]} />
        <meshPhysicalMaterial color="#020203" metalness={0.2} roughness={0.05} clearcoat={1} />
      </mesh>
    </group>
  );
}

/** Refractive glass sphere or knot: bends what is behind it, including type. */
export function GlassCore({
  look,
  shape = "sphere",
  radius = 1,
  position = [0, 0, 0],
  spin = 12,
}: {
  look: Look;
  shape?: "sphere" | "knot" | "torus";
  radius?: number;
  position?: Vec3;
  spin?: number;
}) {
  const t = useTime();
  return (
    <mesh position={position} rotation={[0.3, spin * t * deg, 0.15]}>
      {shape === "sphere" && <sphereGeometry args={[radius, 96, 96]} />}
      {shape === "knot" && <torusKnotGeometry args={[radius * 0.62, radius * 0.22, 220, 32]} />}
      {shape === "torus" && <torusGeometry args={[radius, radius * 0.32, 64, 160]} />}
      <MeshTransmissionMaterial
        samples={6}
        resolution={512}
        thickness={radius * 0.9}
        roughness={0.04}
        transmission={1}
        ior={1.45}
        chromaticAberration={0.06}
        anisotropicBlur={0.1}
        distortion={0.15}
        distortionScale={0.4}
        temporalDistortion={0}
        color={look.accent}
        backside
      />
    </mesh>
  );
}

/**
 * Orbital rings around the subject, nearly flat like a planet's, each an open
 * arc that keeps travelling. They cross in front of and behind the subject,
 * which is what sells the depth.
 */
export function Rings({
  look,
  count = 3,
  radius = 2,
  position = [0, 0, 0],
  speed = 30,
  glow = 2.5,
  appear = 0,
  arc = 0.62,
  tilt = 76,
}: {
  look: Look;
  count?: number;
  radius?: number;
  position?: Vec3;
  /** Degrees per second the arcs travel around. */
  speed?: number;
  glow?: number;
  /** Seconds when the rings draw on. */
  appear?: number;
  /** How much of the circle each ring covers. */
  arc?: number;
  /** Degrees from vertical: 90 is a flat ring seen edge-on at eye level. */
  tilt?: number;
}) {
  const t = useTime();
  return (
    <group position={position}>
      {Array.from({ length: count }, (_, i) => {
        const grow = Math.min(1, Math.max(0, (t - appear - i * 0.2) / 1.4));
        const length = Math.PI * 2 * arc * (1 - Math.pow(1 - grow, 3));
        if (length <= 0.001) return null;
        const dir = i % 2 ? -1 : 1;
        return (
          <group key={i} rotation={[(tilt - i * 7) * deg, (i * 14 - 8) * deg, (i % 2 ? 7 : -5) * deg]}>
            <mesh rotation={[0, 0, (i * 120 + dir * speed * (t - appear)) * deg]}>
              <torusGeometry args={[radius * (1 + i * 0.1), 0.006 + i * 0.002, 8, 256, length]} />
              <meshBasicMaterial color={hdr(i % 2 ? look.accent2 : look.accent, glow)} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Glossy black floor that mirrors the scene, blurred like polished stone. */
export function MirrorFloor({ look, y = -1.2, size = 40 }: { look: Look; y?: number; size?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[size, size]} />
      <MeshReflectorMaterial
        resolution={1024}
        blur={[300, 80]}
        mixBlur={0.8}
        mixStrength={6}
        mirror={0.85}
        roughness={1}
        depthScale={0.4}
        minDepthThreshold={0.5}
        maxDepthThreshold={1.4}
        color={look.background}
        metalness={0}
        envMapIntensity={0.05}
      />
    </mesh>
  );
}

/**
 * Neon line grid on the floor that scrolls toward camera: speed, data, the
 * future. Fades into the fog so it never shows a hard edge.
 */
export function GridFloor({
  look,
  y = -1.2,
  cell = 1,
  extent = 40,
  speed = 2,
  glow = 1.6,
}: {
  look: Look;
  y?: number;
  cell?: number;
  extent?: number;
  /** Units per second the grid travels toward camera. */
  speed?: number;
  glow?: number;
}) {
  const t = useTime();
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const n = Math.round(extent / cell);
    for (let i = -n; i <= n; i++) {
      pts.push(i * cell, 0, -extent, i * cell, 0, extent);
      pts.push(-extent, 0, i * cell, extent, 0, i * cell);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [cell, extent]);
  return (
    <lineSegments geometry={geometry} position={[0, y, (t * speed) % cell]}>
      <lineBasicMaterial color={hdr(look.accent, glow)} toneMapped={false} transparent opacity={0.55} />
    </lineSegments>
  );
}
