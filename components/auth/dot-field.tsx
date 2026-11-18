"use client";

import * as React from "react";

/**
 * The quiet background behind the sign-in form: a field of faint dots that
 * breathes with a slow diagonal wave and warms up around the pointer, the
 * dots nearest it easing aside as if making room.
 *
 * Canvas rather than DOM — a laptop screen holds well over a thousand dots.
 * It stops drawing while the tab is hidden, draws a single still frame for
 * visitors who prefer reduced motion, and reads its colours from the theme
 * tokens so it follows a theme switch.
 */

const GAP = 26;
const RADIUS = 170;
const PUSH = 9;

function readColour(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** `#rrggbb` → `r, g, b`, so alpha can be applied per dot. */
function rgb(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "255, 255, 255";
  const n = Number.parseInt(clean, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function DotField({ className }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let running = true;
    let ink = rgb(readColour("--ink", "#ffffff"));
    let accent = rgb(readColour("--accent", "#ff7a1a"));

    // The pointer as drawn trails the real one, so the warm spot glides.
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, strength: 0, target: 0 };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (still) draw(0);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      pointer.x += (pointer.tx - pointer.x) * 0.14;
      pointer.y += (pointer.ty - pointer.y) * 0.14;
      pointer.strength += (pointer.target - pointer.strength) * 0.08;

      const t = time / 1000;
      for (let y = GAP / 2; y < height; y += GAP) {
        for (let x = GAP / 2; x < width; x += GAP) {
          // The breathing: a slow wave rolling from top-left to bottom-right.
          const wave = still ? 0 : (Math.sin(x * 0.012 + y * 0.009 - t * 0.9) + 1) / 2;
          let alpha = 0.07 + wave * 0.1;
          let size = 1;
          let px = x;
          let py = y;
          let warm = 0;

          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < RADIUS && pointer.strength > 0.01) {
            const near = (1 - distance / RADIUS) ** 2 * pointer.strength;
            warm = near;
            alpha += near * 0.85;
            size += near * 1.6;
            const push = (near * PUSH) / Math.max(distance, 1);
            px += dx * push;
            py += dy * push;
          }

          context.fillStyle = warm > 0.02 ? `rgba(${accent}, ${Math.min(alpha, 0.9)})` : `rgba(${ink}, ${alpha})`;
          context.beginPath();
          context.arc(px, py, size, 0, Math.PI * 2);
          context.fill();
        }
      }
    };

    const loop = (time: number) => {
      if (!running) return;
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      pointer.tx = event.clientX - rect.left;
      pointer.ty = event.clientY - rect.top;
      if (pointer.x < -1000) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
      }
      pointer.target = 1;
    };
    const onLeave = () => {
      pointer.target = 0;
    };
    const onVisibility = () => {
      if (still) return;
      running = document.visibilityState === "visible";
      cancelAnimationFrame(frame);
      if (running) frame = requestAnimationFrame(loop);
    };
    // The theme toggle rewrites the tokens; pick the new colours up.
    const themeWatch = new MutationObserver(() => {
      ink = rgb(readColour("--ink", "#ffffff"));
      accent = rgb(readColour("--accent", "#ff7a1a"));
      if (still) draw(0);
    });

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    resize();
    if (!still) {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
      document.addEventListener("visibilitychange", onVisibility);
      frame = requestAnimationFrame(loop);
    }

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      themeWatch.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
