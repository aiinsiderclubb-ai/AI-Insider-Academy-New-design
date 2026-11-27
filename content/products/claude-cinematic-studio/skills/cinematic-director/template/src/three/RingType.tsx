import React, { useMemo } from "react";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { FontName } from "../lib/fonts";
import type { Look } from "../lib/looks";
import { ease, progress } from "../lib/curves";
import { useTime } from "../lib/time";
import { useFont } from "./font";
import { hdr } from "./Objects";
import { useRedrawWhenReady } from "./sync";
import type { Vec3 } from "./camera";

const deg = Math.PI / 180;

/**
 * Text wrapped around a vertical ring that turns around the subject. Letters
 * on the far side are hidden by the object itself — the depth buffer does the
 * "passes behind" moment that would need a mask in After Effects.
 */
export function RingType({
  text,
  look,
  font,
  radius = 2.2,
  size = 0.32,
  depth = 0.04,
  speed = 25,
  tilt = [8, 0, -6],
  position = [0, 0, 0],
  appear = 0,
  glow = 0,
  repeat = "auto",
}: {
  text: string;
  look: Look;
  font?: FontName;
  radius?: number;
  size?: number;
  depth?: number;
  /** Degrees per second. Negative turns the other way. */
  speed?: number;
  tilt?: Vec3;
  position?: Vec3;
  appear?: number;
  /** Emissive strength; 0 = metal like the rest of the type. */
  glow?: number;
  /** Copies of the text around the ring; "auto" fits as many as close the circle. */
  repeat?: number | "auto";
}) {
  const t = useTime();
  const loaded = useFont(font ?? look.font.display);
  const glyphs = useMemo(() => {
    if (!loaded) return [];
    const data = (loaded as unknown as { data: { glyphs: Record<string, { ha: number }>; resolution: number } }).data;
    const scale = size / data.resolution;
    const advanceOf = (char: string) => (data.glyphs[char]?.ha ?? data.resolution * 0.5) * scale + size * 0.04;
    const unit = `${text}  ·  `;
    const unitArc = Array.from(unit).reduce((sum, c) => sum + advanceOf(c), 0);
    const circumference = Math.PI * 2 * radius;
    // The whole number of copies closest to filling the ring (at least one), then the
    // spacing is evened out (squeezed at most 20%) so the ring closes without a gap.
    const copies = repeat === "auto" ? Math.max(1, Math.round(circumference / unitArc)) : repeat;
    const full = Array.from({ length: copies }, () => unit).join("");
    const total = Array.from(full).reduce((sum, c) => sum + advanceOf(c), 0);
    const stretch = Math.max(circumference / total, 0.8);
    let arc = 0;
    const out: { geometry: TextGeometry | null; angle: number }[] = [];
    for (const char of full) {
      const advance = advanceOf(char) * stretch;
      const angle = (arc + advance / 2) / radius;
      let geometry: TextGeometry | null = null;
      if (char.trim()) {
        geometry = new TextGeometry(char, { font: loaded, size, depth, curveSegments: 6, bevelEnabled: false });
        geometry.computeBoundingBox();
        const b = geometry.boundingBox!;
        geometry.translate(-(b.min.x + b.max.x) / 2, -size * 0.36, -depth / 2);
      }
      out.push({ geometry, angle });
      arc += advance;
    }
    return out;
  }, [loaded, text, size, depth, radius, repeat]);
  useRedrawWhenReady(glyphs.length > 0, `ring type "${text.slice(0, 20)}"`);
  const k = ease.expoOut(progress(t, appear, appear + 1.4));
  if (k <= 0) return null;
  const turn = t * speed * deg;
  return (
    <group position={position} rotation={[tilt[0] * deg, tilt[1] * deg, tilt[2] * deg]} scale={[1, k, 1]}>
      {glyphs.map((g, i) =>
        g.geometry ? (
          // Later letters sit further right on the front arc, so it reads left to right;
          // the ring turns so the words travel leftward, like a ticker.
          <mesh
            key={i}
            geometry={g.geometry}
            position={[Math.sin(g.angle - turn) * radius, 0, Math.cos(g.angle - turn) * radius]}
            rotation={[0, g.angle - turn, 0]}
          >
            <meshPhysicalMaterial
              color={look.type.color}
              metalness={look.type.metalness}
              roughness={look.type.roughness}
              clearcoat={look.type.clearcoat}
              emissive={glow ? hdr(look.accent, 1) : look.type.emissive}
              emissiveIntensity={glow || look.type.emissiveIntensity}
            />
          </mesh>
        ) : null,
      )}
    </group>
  );
}
