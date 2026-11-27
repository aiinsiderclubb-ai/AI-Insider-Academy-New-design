import React, { useMemo } from "react";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { ease as EASES, lerp, progress, rng, type Ease, type EaseName } from "../lib/curves";
import type { FontName } from "../lib/fonts";
import type { Look } from "../lib/looks";
import { useTime } from "../lib/time";
import { useFont } from "./font";
import { useRedrawWhenReady } from "./sync";
import type { Vec3 } from "./camera";

/** Per-letter transform offsets. Rotations in degrees. */
export interface Pose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
  opacity: number;
}
const REST: Pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, opacity: 1 };

/**
 * A letter-by-letter move. `from` is where each letter starts (on reveal) or
 * where it goes (on exit), relative to its resting place.
 */
export interface LetterMove {
  at: number;
  duration?: number;
  stagger?: number;
  order?: "left" | "right" | "center" | "edges" | "random";
  ease?: EaseName | Ease;
  pose: Partial<Pose>;
}

/** Ready-made reveals; spread one and override what you need. */
export const REVEALS = {
  /** Letters rise out of depth and settle: the default premium title. */
  riseFromDepth: { duration: 1.1, stagger: 0.045, ease: "expoOut", pose: { z: -2.5, y: -0.4, rx: 55, opacity: 0 } },
  /** Each letter flips into place around X, like a split-flap board in 3D. */
  flip: { duration: 0.9, stagger: 0.05, ease: "quintOut", pose: { rx: -100, y: 0.25, opacity: 0 } },
  /** Letters fly past the camera and land: very fast, good on a beat. */
  flyIn: { duration: 0.7, stagger: 0.03, order: "random", ease: "snap", pose: { z: 6, scale: 1.6, opacity: 0 } },
  /** Turns in on Y from the side, like a door. */
  swing: { duration: 1, stagger: 0.04, ease: "silk", pose: { ry: -80, x: -0.3, opacity: 0 } },
  /** Grows from the middle outward: logos and short words. */
  burst: { duration: 0.8, stagger: 0.035, order: "center", ease: "backOut", pose: { scale: 0, opacity: 0 } },
} satisfies Record<string, Omit<LetterMove, "at">>;

export const EXITS = {
  /** Recedes into the dark: the classic end of a premium shot. */
  intoDepth: { duration: 0.8, stagger: 0.03, ease: "expoIn", pose: { z: -4, opacity: 0 } },
  /** Leaves past the camera; pair with a cut on the next beat. */
  pastCamera: { duration: 0.6, stagger: 0.02, order: "center", ease: "expoIn", pose: { z: 7, scale: 1.4, opacity: 0 } },
  /** Drops away with rotation, as if gravity switched on. */
  fall: { duration: 0.9, stagger: 0.035, order: "random", ease: "launch", pose: { y: -3, rx: 70, opacity: 0 } },
} satisfies Record<string, Omit<LetterMove, "at">>;

interface Glyph {
  char: string;
  geometry: THREE.BufferGeometry;
  center: Vec3;
  line: number;
}

/** Width of the widest line, in scene units. */
function measure(glyphs: Glyph[], size: number) {
  let widest = 0;
  const lines = new Map<number, [number, number]>();
  for (const g of glyphs) {
    const [lo, hi] = lines.get(g.line) ?? [Infinity, -Infinity];
    lines.set(g.line, [Math.min(lo, g.center[0] - size * 0.4), Math.max(hi, g.center[0] + size * 0.4)]);
  }
  for (const [lo, hi] of lines.values()) widest = Math.max(widest, hi - lo);
  return widest;
}

function layout(font: Font, text: string, size: number, depth: number, bevel: number, tracking: number, lineHeight: number) {
  const data = (font as unknown as { data: { glyphs: Record<string, { ha: number }>; resolution: number } }).data;
  const scale = size / data.resolution;
  const lines = text.split("\n");
  const glyphs: Glyph[] = [];
  lines.forEach((line, li) => {
    let x = 0;
    const rowStart = glyphs.length;
    for (const char of line) {
      const advance = (data.glyphs[char]?.ha ?? data.glyphs["?"]?.ha ?? size) * scale;
      if (char.trim()) {
        const geometry = new TextGeometry(char, {
          font,
          size,
          depth,
          curveSegments: 8,
          bevelEnabled: bevel > 0,
          bevelThickness: bevel,
          bevelSize: bevel * 0.6,
          bevelSegments: 4,
        });
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const cx = (box.min.x + box.max.x) / 2;
        const cy = size * 0.36;
        const cz = depth / 2;
        geometry.translate(-cx, -cy, -cz);
        glyphs.push({ char, geometry, center: [x + cx, -li * size * lineHeight, 0], line: li });
      }
      x += advance + tracking * size;
    }
    const width = x - tracking * size;
    for (let i = rowStart; i < glyphs.length; i++) glyphs[i].center[0] -= width / 2;
  });
  const offsetY = ((lines.length - 1) * size * lineHeight) / 2;
  glyphs.forEach((g) => (g.center[1] += offsetY));
  return glyphs;
}

function orderIndex(order: LetterMove["order"], i: number, n: number, seed: number) {
  switch (order) {
    case "right":
      return n - 1 - i;
    case "center":
      return Math.abs(i - (n - 1) / 2);
    case "edges":
      return (n - 1) / 2 - Math.abs(i - (n - 1) / 2);
    case "random": {
      const r = rng(seed + i * 977)();
      return r * n;
    }
    default:
      return i;
  }
}

function poseAt(move: LetterMove | undefined, t: number, i: number, n: number, entering: boolean): Pose {
  if (!move) return entering ? REST : { ...REST, opacity: 1 };
  const start = move.at + orderIndex(move.order, i, n, 11) * (move.stagger ?? 0.04);
  const e = typeof move.ease === "function" ? move.ease : EASES[move.ease ?? "expoOut"];
  const k = e(progress(t, start, start + (move.duration ?? 1)));
  const away = { ...REST, ...move.pose };
  const w = entering ? 1 - k : k;
  return {
    x: away.x * w,
    y: away.y * w,
    z: away.z * w,
    rx: away.rx * w,
    ry: away.ry * w,
    rz: away.rz * w,
    scale: lerp(1, away.scale, w),
    opacity: lerp(1, away.opacity, w),
  };
}

/**
 * Extruded, bevelled 3D type. Each letter is its own mesh with its pivot at
 * its centre, so letters can tumble, fly and stagger independently, and they
 * sit in the same depth buffer as everything else in the shot.
 */
export function Type3D({
  text,
  look,
  font,
  size = 1,
  depth = 0.25,
  bevel = 0.02,
  tracking = 0.02,
  lineHeight = 1.15,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  reveal,
  exit,
  color,
  emissive,
  emissiveIntensity,
  metalness,
  roughness,
  wobble = 0,
  maxWidth,
}: {
  text: string;
  look: Look;
  font?: FontName;
  size?: number;
  depth?: number;
  bevel?: number;
  /** Letter spacing as a fraction of size. */
  tracking?: number;
  lineHeight?: number;
  position?: Vec3;
  /** Degrees. */
  rotation?: Vec3;
  reveal?: LetterMove;
  exit?: LetterMove;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
  /** Slow idle float per letter after landing, in scene units. Keeps a hold alive. */
  wobble?: number;
  /**
   * Widest line allowed, in scene units. Longer text is scaled down to fit, so
   * a wide font or a long word never runs off the frame. See space-type/sizing.
   */
  maxWidth?: number;
}) {
  const t = useTime();
  const loaded = useFont(font ?? look.font.display);
  const glyphs = useMemo(
    () => (loaded ? layout(loaded, text, size, depth, bevel, tracking, lineHeight) : []),
    [loaded, text, size, depth, bevel, tracking, lineHeight],
  );
  useRedrawWhenReady(glyphs.length > 0 || !text.trim(), `3D type "${text.slice(0, 20)}"`);
  const deg = Math.PI / 180;
  const fit = maxWidth && glyphs.length ? Math.min(1, maxWidth / measure(glyphs, size)) : 1;
  return (
    <group position={position} rotation={[rotation[0] * deg, rotation[1] * deg, rotation[2] * deg]} scale={fit}>
      {glyphs.map((g, i) => {
        const a = poseAt(reveal, t, i, glyphs.length, true);
        const b = poseAt(exit, t, i, glyphs.length, false);
        const opacity = a.opacity * b.opacity;
        if (opacity <= 0.001) return null;
        const float = wobble ? Math.sin(t * 1.3 + i * 0.7) * wobble : 0;
        return (
          <mesh
            key={i}
            geometry={g.geometry}
            position={[g.center[0] + a.x + b.x, g.center[1] + a.y + b.y + float, g.center[2] + a.z + b.z]}
            rotation={[(a.rx + b.rx) * deg, (a.ry + b.ry) * deg, (a.rz + b.rz) * deg]}
            scale={a.scale * b.scale}
          >
            <meshPhysicalMaterial
              color={color ?? look.type.color}
              metalness={metalness ?? look.type.metalness}
              roughness={roughness ?? look.type.roughness}
              clearcoat={look.type.clearcoat}
              clearcoatRoughness={0.1}
              emissive={emissive ?? look.type.emissive}
              emissiveIntensity={emissiveIntensity ?? look.type.emissiveIntensity}
              transparent={opacity < 1}
              opacity={opacity}
              envMapIntensity={1.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}
