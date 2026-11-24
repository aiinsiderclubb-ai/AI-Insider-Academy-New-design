import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ramp } from "../lib/motion";
import { useLook } from "./look";

/**
 * A block of colour that sweeps across the frame, covers it and uncovers it.
 * Cut the content underneath at `at` (the moment the frame is covered) and the
 * change of scene is hidden inside the sweep.
 *
 *   <Sequence durationInFrames={cut}>…scene A…</Sequence>
 *   <Sequence from={cut}>…scene B…</Sequence>
 *   <BlockWipe at={cut} />
 */
export function BlockWipe({
  at,
  duration = 16,
  direction = "right",
  color,
  bands = 1,
}: {
  /** Frame when the screen is fully covered — put the cut here. */
  at: number;
  /** Frames for covering, and again for uncovering. */
  duration?: number;
  direction?: "right" | "left" | "up" | "down";
  color?: string;
  /** Several staggered bands instead of one block. */
  bands?: number;
}) {
  const frame = useCurrentFrame();
  const { style } = useLook();
  if (frame < at - duration || frame > at + duration + bands * 2) return null;
  const horizontal = direction === "right" || direction === "left";
  return (
    <AbsoluteFill style={{ pointerEvents: "none", flexDirection: horizontal ? "column" : "row" }}>
      {Array.from({ length: bands }, (_, i) => {
        const lag = i * 2;
        const cover = ramp(frame, at - duration + lag, duration, style.ease.inOut);
        const uncover = ramp(frame, at + lag, duration, style.ease.inOut);
        // Grows from the leading edge, then shrinks towards the trailing edge.
        const start = uncover * 100;
        const end = cover * 100;
        const forward = direction === "right" || direction === "down";
        const from = forward ? start : 100 - end;
        const size = Math.max(0, end - start);
        return (
          <div key={i} style={{ position: "relative", flex: 1 }}>
            <div
              style={{
                position: "absolute",
                background: color ?? style.colors.accent,
                ...(horizontal ? { top: 0, bottom: 0, left: `${from}%`, width: `${size}%` } : { left: 0, right: 0, top: `${from}%`, height: `${size}%` }),
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
