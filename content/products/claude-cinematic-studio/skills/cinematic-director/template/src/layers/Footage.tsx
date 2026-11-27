import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, Img, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ease as EASES, type EaseName } from "../lib/curves";

/**
 * Real footage as a numbered PNG sequence (made by `footage-composite`'s
 * frames.py). A sequence, not a video file, because the edit picks the exact
 * source frame for every output frame: speed ramps, freezes and reverses are
 * a function of time, and a cutout of the same frame lines up pixel for pixel.
 */
export interface PlateMeta {
  name: string;
  fps: number;
  count: number;
  width: number;
  height: number;
  /** Frames were interpolated N× by frames.py --slowmo: N source frames per real-time frame. */
  slowmo?: number;
}

const metaCache = new Map<string, Promise<PlateMeta>>();

export function usePlateMeta(name: string) {
  const [meta, setMeta] = useState<PlateMeta | null>(null);
  const [handle] = useState(() => delayRender(`Footage meta ${name}`));
  useEffect(() => {
    let p = metaCache.get(name);
    if (!p) {
      p = fetch(staticFile(`footage/${name}/meta.json`)).then((r) => r.json() as Promise<PlateMeta>);
      metaCache.set(name, p);
    }
    p.then((m) => {
      setMeta(m);
      continueRender(handle);
    }).catch((err) => {
      console.error(`footage/${name}/meta.json`, err);
      continueRender(handle);
    });
  }, [name, handle]);
  return meta;
}

/**
 * Time remap: maps output seconds to source seconds. `speedRamp` builds one
 * from speed keys, like After Effects' time remapping with eased keys:
 *
 *   speedRamp([[0, 1], [1.2, 1], [1.5, 0.15, "expoOut"], [2.6, 0.15], [2.9, 2.5, "expoIn"]])
 *
 * = real time, then slams into 15% slow motion, holds, and rockets out at 250%.
 * Source time is the integral of speed, so there is never a jump.
 */
export type Remap = (t: number) => number;
export const realtime: Remap = (t) => t;
export const freezeAt = (source: number, from: number): Remap => (t) => (t < from ? t - from + source : source);
export const reverse = (sourceEnd: number): Remap => (t) => Math.max(0, sourceEnd - t);

export function speedRamp(keys: [time: number, speed: number, ease?: EaseName][], offset = 0): Remap {
  const sorted = [...keys].sort((a, b) => a[0] - b[0]);
  const speedAt = (t: number) => {
    if (t <= sorted[0][0]) return sorted[0][1];
    const last = sorted[sorted.length - 1];
    if (t >= last[0]) return last[1];
    let i = 1;
    while (sorted[i][0] < t) i++;
    const [t0, s0] = sorted[i - 1];
    const [t1, s1, e] = sorted[i];
    const k = EASES[e ?? "cubicInOut"]((t - t0) / (t1 - t0));
    return s0 + (s1 - s0) * k;
  };
  // Integrate on a fixed 1/240 s grid: deterministic and smooth enough for any edit.
  const step = 1 / 240;
  const table: number[] = [0];
  return (t: number) => {
    if (t <= 0) return offset + t * speedAt(0);
    const n = Math.ceil(t / step);
    for (let i = table.length; i <= n; i++) table[i] = table[i - 1] + speedAt((i - 0.5) * step) * step;
    const i = Math.floor(t / step);
    const frac = t / step - i;
    return offset + table[i] + (table[Math.min(n, i + 1)] - table[i]) * frac;
  };
}

function frameFile(name: string, layer: "plate" | "cutout", index: number) {
  return staticFile(`footage/${name}/${layer}/frame_${String(index).padStart(5, "0")}.png`);
}

function useSourceFrame(meta: PlateMeta | null, remap: Remap, loop: boolean) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!meta) return 1;
  const sourceFps = meta.fps * (meta.slowmo ?? 1);
  let i = Math.round(remap(frame / fps) * sourceFps) + 1;
  if (loop) i = ((((i - 1) % meta.count) + meta.count) % meta.count) + 1;
  return Math.min(meta.count, Math.max(1, i));
}

/** The footage itself, filling the frame like `object-fit: cover`. */
export function Plate({
  name,
  remap = realtime,
  loop = false,
  layer = "plate",
  style,
}: {
  name: string;
  remap?: Remap;
  loop?: boolean;
  layer?: "plate" | "cutout";
  style?: React.CSSProperties;
}) {
  const meta = usePlateMeta(name);
  const index = useSourceFrame(meta, remap, loop);
  if (!meta) return null;
  return (
    <AbsoluteFill style={style}>
      <Img src={frameFile(name, layer, index)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );
}

/**
 * The subject cut out of the same frame, laid over everything between it and
 * the plate. Put 3D type between <Plate> and <Cutout> and it passes behind the
 * subject — the "text behind the person" shot, matched to the pixel.
 */
export function Cutout(props: Omit<React.ComponentProps<typeof Plate>, "layer">) {
  return <Plate {...props} layer="cutout" />;
}

export interface TrackPoint {
  f: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  confidence: number;
}

/** A track from track.py, sampled at the source frame on screen now. */
export function useTrack(name: string, label: string, remap: Remap = realtime) {
  const meta = usePlateMeta(name);
  const [track, setTrack] = useState<TrackPoint[] | null>(null);
  const [handle] = useState(() => delayRender(`Track ${name}/${label}`));
  useEffect(() => {
    fetch(staticFile(`footage/${name}/track-${label}.json`))
      .then((r) => r.json())
      .then((j: { frames: TrackPoint[] }) => {
        setTrack(j.frames);
        continueRender(handle);
      })
      .catch((err) => {
        console.error(err);
        continueRender(handle);
      });
  }, [name, label, handle]);
  const index = useSourceFrame(meta, remap, false);
  return useMemo(() => {
    if (!track?.length) return null;
    return track.find((p) => p.f === index) ?? track[Math.min(track.length - 1, index - 1)];
  }, [track, index]);
}

/**
 * Pins its children to a tracked point, as a 2D overlay. The frame is cropped
 * like `object-fit: cover`, so the normalised track maps through the same crop.
 */
export function Pinned({
  name,
  label,
  remap,
  children,
  followScale = true,
  followRotation = false,
}: {
  name: string;
  label: string;
  remap?: Remap;
  children: React.ReactNode;
  followScale?: boolean;
  followRotation?: boolean;
}) {
  const meta = usePlateMeta(name);
  const p = useTrack(name, label, remap);
  const { width, height } = useVideoConfig();
  if (!meta || !p) return null;
  const s = Math.max(width / meta.width, height / meta.height);
  const x = (p.x * meta.width - meta.width / 2) * s + width / 2;
  const y = (p.y * meta.height - meta.height / 2) * s + height / 2;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${followScale ? p.scale : 1}) rotate(${followRotation ? p.rotation : 0}deg)`,
      }}
    >
      {children}
    </div>
  );
}
