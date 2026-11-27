import { useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Scenes are timed in seconds, not frames, so the same composition renders at
 * 24, 30, 60 or 120 fps. Rendering at 4× the delivery rate and blending the
 * frames afterwards is how this project gets real motion blur (see
 * `grade-finish`): the timing has to survive that.
 */
export function useTime() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
}

/** Seconds → frames at the composition's rate. */
export function useSeconds() {
  const { fps } = useVideoConfig();
  return (seconds: number) => Math.round(seconds * fps);
}
