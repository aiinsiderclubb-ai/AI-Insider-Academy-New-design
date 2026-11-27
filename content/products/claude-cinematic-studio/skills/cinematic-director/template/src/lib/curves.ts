/**
 * Animation curves the way a motion designer sets them in the Graph Editor.
 *
 * Everything here is a pure function of time, so a frame renders the same on
 * every run and on every machine. No `Math.random()`, no clocks.
 */

export type Ease = (t: number) => number;

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Maps `v` from [a, b] to [0, 1], clamped. */
export const progress = (v: number, a: number, b: number) => (b === a ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a)));

/**
 * CSS / After Effects style cubic Bézier: control points (x1, y1) and (x2, y2),
 * ends fixed at (0, 0) and (1, 1). Solved for x with Newton steps and a
 * bisection fallback, the same way browsers do it.
 */
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)));
}

/**
 * Named curves. The `*InOut` ones are what a designer gets by dragging both
 * influence handles out in the speed graph; `snap` is the "fast in, long
 * settle" curve of premium product films; `anticipate` pulls back first.
 */
export const ease = {
  linear: (t: number) => t,
  sineInOut: bezier(0.37, 0, 0.63, 1),
  cubicOut: bezier(0.33, 1, 0.68, 1),
  cubicInOut: bezier(0.65, 0, 0.35, 1),
  quintOut: bezier(0.22, 1, 0.36, 1),
  quintInOut: bezier(0.83, 0, 0.17, 1),
  expoIn: bezier(0.7, 0, 0.84, 0),
  expoOut: bezier(0.16, 1, 0.3, 1),
  expoInOut: bezier(0.87, 0, 0.13, 1),
  /** Long, smooth settle: camera moves and hero reveals. */
  silk: bezier(0.45, 0, 0.1, 1),
  /** Hard start, very soft landing: type slams, snap zooms. */
  snap: bezier(0.05, 0.9, 0.1, 1),
  /** Gathers speed and leaves the frame: exits and whip pans. */
  launch: bezier(0.6, 0, 0.9, 0.3),
  anticipate: bezier(0.36, -0.35, 0.3, 1),
  backOut: bezier(0.34, 1.56, 0.64, 1),
} satisfies Record<string, Ease>;

export type EaseName = keyof typeof ease;

/**
 * A damped spring evaluated analytically at time `t` seconds after release.
 * Returns 0 → 1 with overshoot set by `damping` (1 = critical, no overshoot).
 * Real inertia: heavy objects (`mass`) start slower and swing longer.
 */
export function spring(t: number, { stiffness = 170, damping = 0.55, mass = 1 } = {}) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const z = clamp(damping, 0.01, 4);
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

/**
 * Inertia after a throw: velocity `v0` that decays with `friction` per second.
 * Distance travelled by time `t`. Use it when something is flicked and coasts.
 */
export function coast(t: number, v0: number, friction = 4) {
  if (t <= 0) return 0;
  return (v0 / friction) * (1 - Math.exp(-friction * t));
}

export type Key<T> = [time: number, value: T, ease?: EaseName | Ease];

const resolve = (e?: EaseName | Ease): Ease => (typeof e === "function" ? e : ease[e ?? "cubicInOut"]);

/**
 * Keyframes, like a property's stopwatch in After Effects. The ease on a key
 * shapes the segment that ends on it. Numbers and number tuples both work.
 *
 *   const y = track([[0, -2], [0.8, 0, "expoOut"], [2.4, 0.2, "sineInOut"]]);
 *   y(time)
 */
export function track<T extends number | readonly number[]>(keys: Key<T>[]) {
  const sorted = [...keys].sort((a, b) => a[0] - b[0]);
  return (t: number): T => {
    if (t <= sorted[0][0]) return sorted[0][1];
    const last = sorted[sorted.length - 1];
    if (t >= last[0]) return last[1];
    let i = 1;
    while (sorted[i][0] < t) i++;
    const [t0, v0] = sorted[i - 1];
    const [t1, v1, e] = sorted[i];
    const k = resolve(e)((t - t0) / (t1 - t0));
    if (typeof v0 === "number") return lerp(v0, v1 as number, k) as T;
    return (v0 as readonly number[]).map((a, j) => lerp(a, (v1 as readonly number[])[j], k)) as unknown as T;
  };
}

/** Deterministic pseudo-random numbers: the same seed gives the same sequence. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Smooth 1D value noise in [-1, 1] — for handheld camera drift and flicker.
 * Same input, same output; layer two octaves for organic motion.
 */
export function noise1(x: number, seed = 1) {
  const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u);
}
