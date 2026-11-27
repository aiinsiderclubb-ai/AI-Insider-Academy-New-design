import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * While rendering, the 3D canvas only redraws when Remotion moves to a new
 * frame. Anything that appears later — a font that finished loading, the
 * post-processing chain that set itself up after the first draw — would be
 * missing from the screenshot. These hooks hold the frame, redraw once the
 * scene is complete, and then let Remotion take the picture.
 */
export function useRedrawWhenReady(ready: boolean, label: string) {
  const advance = useThree((s) => s.advance);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [handle] = useState(() => delayRender(label));
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!ready || done) return;
    const id = requestAnimationFrame(() => {
      // The timestamp is the frame's own time, so nothing reading the clock can vary between renders.
      advance((frame / fps) * 1000);
      setDone(true);
      continueRender(handle);
    });
    return () => cancelAnimationFrame(id);
  }, [ready, done, advance, handle, frame, fps]);
}

/** Redraws after every frame's React update has landed, then releases the frame. */
export function FrameSync() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    const handle = delayRender(`Redrawing 3D frame ${frame}`);
    const id = requestAnimationFrame(() => {
      advance((frame / fps) * 1000);
      continueRender(handle);
    });
    return () => {
      cancelAnimationFrame(id);
      continueRender(handle);
    };
  }, [frame, fps, advance]);
  return null;
}
