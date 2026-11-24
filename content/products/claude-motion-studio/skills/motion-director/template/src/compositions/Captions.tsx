import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionTrack, type CaptionMode, type CaptionTimeline } from "../components/captions";
import { LookProvider, useDisplayType, useLook, useMonoType } from "../components/look";
import { Corners, Stage } from "../components/stage";
import { MaskLine } from "../components/type";
import { mix, ramp, sec } from "../lib/motion";
import sample from "../../public/data/captions-sample.json";

/**
 * Captions for a vertical video. Three grounds:
 *   video   — your footage (public/…mp4), captions burnt on top
 *   image   — a still with a slow push-in
 *   graphic — no footage: chapter numbers and titles carry the picture
 *
 * Captions sit between 55% and 72% of the height: above the caption and
 * buttons that Reels, TikTok and Shorts draw over the bottom of the frame.
 * The timeline comes from the captions-explainer skill (srt_to_timeline.py).
 */

export type Chapter = { at: number; title: string };

export type CaptionsProps = {
  style: string;
  background: { type: "video" | "image" | "graphic"; src?: string };
  timeline: CaptionTimeline;
  chapters: Chapter[];
  mode: CaptionMode;
  label: string;
};

const resolve = (src: string) => (/^(https?:|data:)/.test(src) ? src : staticFile(src));

function Chapters({ chapters }: { chapters: Chapter[] }) {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const { style } = useLook();
  const display = useDisplayType();
  const starts = chapters.map((c) => sec(c.at, fps));
  const index = Math.max(0, starts.filter((s) => s <= frame).length - 1);
  const chapter = chapters[index];
  if (!chapter) return null;
  const local = frame - starts[index];
  const end = (starts[index + 1] ?? durationInFrames + 10) - starts[index];
  const number = String(index + 1).padStart(2, "0");
  const grow = ramp(local, 0, 20, style.ease.out);
  return (
    <AbsoluteFill style={{ padding: "220px 80px 0" }}>
      <div
        style={{
          ...display,
          fontSize: 520,
          lineHeight: 0.8,
          color: "transparent",
          WebkitTextStroke: `3px ${style.colors.accent}`,
          transform: `translateX(${mix(-60, 0, grow)}px)`,
          opacity: grow * (local > end - 8 ? Math.max(0, (end - local) / 8) : 1),
        }}
      >
        {number}
      </div>
      <div key={index} style={{ ...display, fontSize: 92, marginTop: 40, width: width - 160 }}>
        <MaskLine delay={starts[index] + 6} exitAt={starts[index] + end - 10}>
          {chapter.title}
        </MaskLine>
      </div>
    </AbsoluteFill>
  );
}

/**
 * A row of level bars that moves while a word is being spoken — the voice
 * made visible when there is no footage.
 */
function VoiceMeter({ timeline }: { timeline: CaptionTimeline }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const { style } = useLook();
  const t = frame / fps;
  const words = timeline.pages.flatMap((p) => p.words);
  const speaking = words.some((w) => t >= w.start && t < w.end) ? 1 : 0;
  const bars = 36;
  const span = width - 140;
  return (
    <div style={{ position: "absolute", left: 70, width: span, top: "44%", height: 120, display: "flex", alignItems: "center", gap: 8 }}>
      {Array.from({ length: bars }, (_, i) => {
        const wave = 0.5 + 0.5 * Math.sin(frame * 0.55 + i * 1.7) * Math.sin(frame * 0.23 + i * 0.6);
        const h = 6 + speaking * wave * 110 * (0.35 + 0.65 * Math.sin((Math.PI * (i + 0.5)) / bars));
        return <div key={i} style={{ flex: 1, height: h, borderRadius: 3, background: i % 6 === 0 ? style.colors.accent : style.colors.ink, opacity: i % 6 === 0 ? 1 : 0.32 }} />;
      })}
    </div>
  );
}

function Ground({ background }: { background: CaptionsProps["background"] }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { style } = useLook();
  if (background.type === "video" && background.src) {
    return <OffthreadVideo src={resolve(background.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted={false} />;
  }
  if (background.type === "image" && background.src) {
    const scale = 1.04 + (frame / durationInFrames) * 0.1;
    return <Img src={resolve(background.src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />;
  }
  return <AbsoluteFill style={{ background: style.colors.ground }} />;
}

function Layout({ background, timeline, chapters, mode, label }: Omit<CaptionsProps, "style">) {
  const { height } = useVideoConfig();
  const { style } = useLook();
  const mono = useMonoType();
  const footage = background.type !== "graphic";
  return (
    <Stage grain={footage ? 0.04 : undefined}>
      <Ground background={background} />
      {footage && (
        <AbsoluteFill style={{ background: `linear-gradient(180deg, transparent 35%, ${style.colors.ground}cc 75%, ${style.colors.ground} 100%)` }} />
      )}
      {!footage && <Chapters chapters={chapters} />}
      {!footage && <VoiceMeter timeline={timeline} />}
      <AbsoluteFill style={{ top: height * 0.55, height: height * 0.17, bottom: "auto", alignItems: "center", justifyContent: "center", padding: "0 150px 0 70px" }}>
        {/* Right padding keeps captions clear of the platform's buttons. */}
        <CaptionTrack timeline={timeline} mode={mode} size={90} maxWidth={860} />
      </AbsoluteFill>
      <Corners tl={label} tr="{tc}" inset={70} size={22} />
      <div style={{ ...mono, position: "absolute", left: 70, top: height * 0.55 - 50, fontSize: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: style.colors.accent }} />
        REC
      </div>
    </Stage>
  );
}

export function Captions({ style, ...rest }: CaptionsProps) {
  return (
    <LookProvider styleId={style}>
      <Layout {...rest} />
    </LookProvider>
  );
}

export const captionsDefaults: CaptionsProps = {
  style: "signal",
  background: { type: "graphic" },
  timeline: sample as CaptionTimeline,
  chapters: [
    { at: 0, title: "Зачем субтитры" },
    { at: 4.6, title: "Как их сделать" },
  ],
  mode: "pop",
  label: "Explainer — 9:16",
};
