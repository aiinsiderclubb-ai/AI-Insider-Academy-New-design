import { ease, lerp, noise1, progress, type EaseName, type Ease } from "../lib/curves";

export type Vec3 = [number, number, number];

/**
 * A camera move is three functions of time: where the camera is, what it looks
 * at, and its field of view. Rigs below are the moves a DP asks for by name;
 * `combine` lets a scene cut between them.
 */
export interface CameraMove {
  position: (t: number) => Vec3;
  target: (t: number) => Vec3;
  fov: (t: number) => number;
  /** Roll in radians — a slight dutch angle reads as tension. */
  roll?: (t: number) => number;
}

/** Lens in millimetres (full frame) → vertical field of view in degrees. */
export const lens = (mm: number) => (2 * Math.atan(24 / (2 * mm)) * 180) / Math.PI;

const mix = (a: Vec3, b: Vec3, k: number): Vec3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const pick = (e: EaseName | Ease | undefined, fallback: EaseName): Ease =>
  typeof e === "function" ? e : ease[e ?? fallback];

interface Timing {
  start?: number;
  end: number;
  ease?: EaseName | Ease;
}

/** Locked-off camera. Still frames are a choice too: they let the type move. */
export function locked(position: Vec3, target: Vec3 = [0, 0, 0], mm = 50): CameraMove {
  return { position: () => position, target: () => target, fov: () => lens(mm) };
}

/** Straight move on a dolly track, optionally re-aiming and zooming as it goes. */
export function dolly(
  o: Timing & { from: Vec3; to: Vec3; lookFrom?: Vec3; lookTo?: Vec3; mmFrom?: number; mmTo?: number },
): CameraMove {
  const e = pick(o.ease, "silk");
  const k = (t: number) => e(progress(t, o.start ?? 0, o.end));
  const lookFrom = o.lookFrom ?? [0, 0, 0];
  return {
    position: (t) => mix(o.from, o.to, k(t)),
    target: (t) => mix(lookFrom, o.lookTo ?? lookFrom, k(t)),
    fov: (t) => lens(lerp(o.mmFrom ?? 50, o.mmTo ?? o.mmFrom ?? 50, k(t))),
  };
}

/** Arc around a subject at a set height: the product-turntable move. */
export function orbit(
  o: Timing & { center?: Vec3; radius: number; height?: number; fromDeg: number; toDeg: number; mm?: number; radiusTo?: number },
): CameraMove {
  const e = pick(o.ease, "silk");
  const c = o.center ?? [0, 0, 0];
  const k = (t: number) => e(progress(t, o.start ?? 0, o.end));
  return {
    position: (t) => {
      const a = (lerp(o.fromDeg, o.toDeg, k(t)) * Math.PI) / 180;
      const r = lerp(o.radius, o.radiusTo ?? o.radius, k(t));
      return [c[0] + Math.sin(a) * r, c[1] + (o.height ?? 0), c[2] + Math.cos(a) * r];
    },
    target: () => c,
    fov: () => lens(o.mm ?? 50),
  };
}

/** Crane: rises (or drops) while tilting to keep the subject — the reveal move. */
export function crane(
  o: Timing & { x?: number; z: number; fromY: number; toY: number; target?: Vec3; mm?: number },
): CameraMove {
  const e = pick(o.ease, "silk");
  const k = (t: number) => e(progress(t, o.start ?? 0, o.end));
  return {
    position: (t) => [o.x ?? 0, lerp(o.fromY, o.toY, k(t)), o.z],
    target: () => o.target ?? [0, 0, 0],
    fov: () => lens(o.mm ?? 35),
  };
}

/**
 * Dolly-zoom (the "Vertigo" shot): the camera pulls back while the lens zooms
 * in so the subject stays the same size and the background breathes.
 */
export function dollyZoom(o: Timing & { subjectZ?: number; fromDist: number; toDist: number; height?: number }): CameraMove {
  const e = pick(o.ease, "sineInOut");
  const k = (t: number) => e(progress(t, o.start ?? 0, o.end));
  const z0 = o.subjectZ ?? 0;
  const d0 = o.fromDist;
  const fov0 = lens(35);
  const half0 = Math.tan(((fov0 / 2) * Math.PI) / 180) * d0;
  return {
    position: (t) => [0, o.height ?? 0, z0 + lerp(d0, o.toDist, k(t))],
    target: () => [0, o.height ?? 0, z0],
    fov: (t) => (2 * Math.atan(half0 / lerp(d0, o.toDist, k(t))) * 180) / Math.PI,
  };
}

/** Plays moves back to back: `[[0, moveA], [2.5, moveB]]` cuts to B at 2.5 s. */
export function cutBetween(moves: [start: number, move: CameraMove][]): CameraMove {
  const at = (t: number) => {
    let current = moves[0][1];
    for (const [start, move] of moves) if (t >= start) current = move;
    return current;
  };
  return {
    position: (t) => at(t).position(t),
    target: (t) => at(t).target(t),
    fov: (t) => at(t).fov(t),
    roll: (t) => at(t).roll?.(t) ?? 0,
  };
}

/**
 * Handheld / floating camera: smooth two-octave drift added on top of any
 * move. `amount` is in scene units; 0.03–0.08 is "operator on a gimbal".
 */
export function handheld(move: CameraMove, amount = 0.05, speed = 0.6, seed = 7): CameraMove {
  const drift = (t: number, s: number) => noise1(t * speed, seed + s) * 0.7 + noise1(t * speed * 2.3, seed + s + 50) * 0.3;
  return {
    ...move,
    position: (t) => {
      const p = move.position(t);
      return [p[0] + drift(t, 1) * amount, p[1] + drift(t, 2) * amount, p[2] + drift(t, 3) * amount * 0.5];
    },
    roll: (t) => (move.roll?.(t) ?? 0) + drift(t, 4) * amount * 0.08,
  };
}

/**
 * How fast the picture moves at time t: travel in units per second plus
 * turning (radians per second, weighted ×3 so a whip pan on the spot counts
 * as much as a fast dolly). Drives speed-linked effects like aberration.
 */
export function cameraSpeed(move: CameraMove, t: number, dt = 1 / 120) {
  const a = move.position(t);
  const b = move.position(t + dt);
  const travel = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / dt;
  const dir = (p: Vec3, q: Vec3) => {
    const v = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
    const n = Math.hypot(v[0], v[1], v[2]) || 1;
    return v.map((x) => x / n);
  };
  const d0 = dir(a, move.target(t));
  const d1 = dir(b, move.target(t + dt));
  const cos = Math.min(1, Math.max(-1, d0[0] * d1[0] + d0[1] * d1[1] + d0[2] * d1[2]));
  return travel + (Math.acos(cos) / dt) * 3;
}
