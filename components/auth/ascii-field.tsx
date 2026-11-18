"use client";

import * as React from "react";

/**
 * A field of monospace characters that flows like slow smoke, drawn on a
 * canvas. The pointer burns an orange trail through it that cools over a
 * second or two.
 *
 * Under the hood: domain-warped value noise picks how dense each cell is,
 * and the density picks a character from a ramp (" .:-=+*#%@"). The trail is
 * a grid of heat that the pointer adds to and every frame lets decay.
 * Characters are stamped from a pre-rendered atlas, not typeset each frame,
 * so a few thousand cells stay cheap. It runs at 30 fps — the motion is meant
 * to be slow — stops while the tab is hidden, and draws one still frame for
 * visitors who prefer reduced motion.
 */

const RAMP = " .·:-=+*xX#%@";
const CELL_W = 10;
const CELL_H = 15;
const LEVELS = 8; // brightness steps per colour in the atlas
const FRAME_MS = 1000 / 30;

/* ------------------------------- value noise -------------------------------- */

function hash(x: number, y: number, z: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function noise(x: number, y: number, z: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const zf = smooth(z - zi);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const plane = (zz: number) =>
    lerp(
      lerp(hash(xi, yi, zz), hash(xi + 1, yi, zz), xf),
      lerp(hash(xi, yi + 1, zz), hash(xi + 1, yi + 1, zz), xf),
      yf,
    );
  return lerp(plane(zi), plane(zi + 1), zf);
}

function fbm(x: number, y: number, z: number) {
  return noise(x, y, z) * 0.57 + noise(x * 2.03, y * 2.03, z * 1.3) * 0.29 + noise(x * 4.1, y * 4.1, z * 1.7) * 0.14;
}

/* ---------------------------------- atlas ----------------------------------- */

/**
 * Every character in two colours at LEVELS opacities, on one sprite sheet:
 * row = colour × level, column = character.
 */
function buildAtlas(font: string, ratio: number) {
  const atlas = document.createElement("canvas");
  atlas.width = RAMP.length * CELL_W * ratio;
  atlas.height = 2 * LEVELS * CELL_H * ratio;
  const context = atlas.getContext("2d");
  if (!context) return null;
  context.scale(ratio, ratio);
  context.font = font;
  context.textBaseline = "middle";
  context.textAlign = "center";
  const colours = ["236, 226, 216", "255, 122, 26"];
  colours.forEach((colour, c) => {
    for (let level = 0; level < LEVELS; level++) {
      const alpha = c === 0 ? 0.08 + (level / (LEVELS - 1)) * 0.42 : 0.4 + (level / (LEVELS - 1)) * 0.6;
      context.fillStyle = `rgba(${colour}, ${alpha})`;
      const row = c * LEVELS + level;
      for (let i = 1; i < RAMP.length; i++) {
        context.fillText(RAMP[i], i * CELL_W + CELL_W / 2, row * CELL_H + CELL_H / 2 + 0.5);
      }
    }
  });
  return atlas;
}

function monoFont() {
  const probe = document.createElement("span");
  probe.className = "font-mono";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();
  return `500 12px ${family || "ui-monospace, monospace"}`;
}

/* --------------------------------- component -------------------------------- */

export function AsciiField({
  className,
  onPointer,
}: {
  className?: string;
  /** Pointer position over the field, 0–1 on each axis, for a readout. */
  onPointer?: (x: number, y: number) => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const onPointerRef = React.useRef(onPointer);
  React.useEffect(() => {
    onPointerRef.current = onPointer;
  }, [onPointer]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    let atlas: HTMLCanvasElement | null = null;
    let cols = 0;
    let rows = 0;
    let heat = new Float32Array(0);
    let frame = 0;
    let last = 0;
    let running = true;
    const pointer = { x: -1, y: -1, px: -1, py: -1 };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      cols = Math.ceil(rect.width / CELL_W);
      rows = Math.ceil(rect.height / CELL_H);
      heat = new Float32Array(cols * rows);
      if (still) draw(0);
    };

    const draw = (time: number) => {
      if (!atlas) return;
      const t = time / 1000;
      context.clearRect(0, 0, canvas.width, canvas.height);
      const sw = CELL_W * ratio;
      const sh = CELL_H * ratio;
      const aspect = CELL_H / CELL_W;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const index = row * cols + col;
          const x = col * 0.075;
          const y = row * 0.075 * aspect;
          // Domain warp: the field is sampled where another field points,
          // which turns plain noise into something like drifting smoke.
          const wx = fbm(x * 0.5 + 3.1, y * 0.5 - 1.7, t * 0.05);
          const wy = fbm(x * 0.5 - 2.3, y * 0.5 + 4.2, t * 0.05 + 10);
          const raw = fbm(x + wx * 2.4, y + wy * 2.4 - t * 0.12, t * 0.1);
          // Stretched so the whole ramp is in play, from blank to dense.
          const density = Math.min(1, Math.max(0, (raw - 0.43) * 2.7)) ** 1.5;

          const h = heat[index];
          const level = Math.min(0.999, density * 0.85 + h * 0.9);
          const char = Math.floor(level * (RAMP.length - 1));
          if (char <= 0) continue;

          // Orange belongs to the pointer's trail, and to the odd glint that
          // flickers in the thickest smoke — never to whole regions.
          const glint = density > 0.6 && hash(col, row, Math.floor(t * 3)) > 0.996;
          const hot = h > 0.1 || glint;
          const colour = hot ? 1 : 0;
          const shade = Math.min(LEVELS - 1, Math.floor((hot ? Math.max(h, 0.6) : level) * LEVELS));
          context.drawImage(
            atlas,
            Math.min(char, RAMP.length - 1) * sw,
            (colour * LEVELS + shade) * sh,
            sw,
            sh,
            col * sw,
            row * sh,
            sw,
            sh,
          );
        }
      }

      // Let the trail cool.
      for (let i = 0; i < heat.length; i++) heat[i] *= 0.92;
    };

    const loop = (time: number) => {
      if (!running) return;
      frame = requestAnimationFrame(loop);
      if (time - last < FRAME_MS) return;
      last = time;
      draw(time);
    };

    /** Heat along the segment the pointer just travelled, so fast strokes stay unbroken. */
    const burn = (fromX: number, fromY: number, toX: number, toY: number) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toY - fromY) / (CELL_W * 0.8)));
      for (let s = 0; s <= steps; s++) {
        const cx = (fromX + ((toX - fromX) * s) / steps) / CELL_W;
        const cy = (fromY + ((toY - fromY) * s) / steps) / CELL_H;
        const radius = 4;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const col = Math.round(cx + dx);
            const row = Math.round(cy + dy);
            if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
            const falloff = Math.exp(-(dx * dx + dy * dy * 1.6) / 5);
            const index = row * cols + col;
            heat[index] = Math.min(1, heat[index] + falloff * 0.22);
          }
        }
      }
    };

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (pointer.px >= 0) burn(pointer.px, pointer.py, x, y);
      pointer.px = x;
      pointer.py = y;
      onPointerRef.current?.(x / rect.width, y / rect.height);
    };
    const onLeave = () => {
      pointer.px = -1;
      pointer.py = -1;
    };
    const onVisibility = () => {
      running = document.visibilityState === "visible";
      cancelAnimationFrame(frame);
      if (running) frame = requestAnimationFrame(loop);
    };

    let cancelled = false;
    // Wait for the mono face, or the atlas is stamped in a fallback font.
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      atlas = buildAtlas(monoFont(), ratio);
      resize();
      if (still) return;
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
      document.addEventListener("visibilitychange", onVisibility);
      frame = requestAnimationFrame(loop);
    });

    const observer = new ResizeObserver(() => {
      if (atlas) resize();
    });
    observer.observe(host);

    return () => {
      cancelled = true;
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
