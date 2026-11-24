import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BrowserFrame, Callout, Cursor, Screen, useZoom, type CursorStop, type Zoom } from "../components/device";
import { LookProvider, useDisplayType, useLook, useMonoType } from "../components/look";
import { Corners, Stage } from "../components/stage";
import { MaskLine, Marker } from "../components/type";
import { BlockWipe } from "../components/wipe";
import { mix, ramp, sec } from "../lib/motion";

/**
 * A product promo from real screenshots. One browser window stays on screen;
 * each shot swaps the page inside it behind a colour wipe, the cursor shows
 * what to click, the camera pushes in on the part that matters, and a callout
 * names it. Ends on a card with the address.
 *
 * Screenshots go in public/ (e.g. public/shots/home.png). Times in a shot are
 * seconds from the start of the video. Points — cursor stops, zoom centre,
 * callout — are fractions of the screenshot (0,0 top left; 1,1 bottom right);
 * the cursor and callouts follow the camera when it zooms.
 */

export type PromoShot = {
  src: string;
  url: string;
  /** Start of the shot in seconds. */
  at: number;
  /** Small label over the window: "01 — Главная". */
  label: string;
  cursor: CursorStop[];
  clicks: number[];
  zoom?: Zoom;
  callout?: { x: number; y: number; text: string; at: number; side?: "left" | "right" };
};

export type ProductPromoProps = {
  style: string;
  brand: string;
  shots: PromoShot[];
  end: { at: number; title: string; marked: string; url: string };
};

const WINDOW_W = 1360;
const SCREEN_H = Math.round((WINDOW_W * 900) / 1440);

const resolve = (src: string) => (/^(https?:|data:)/.test(src) ? src : staticFile(src));

function Window({ shots, endAt }: { shots: PromoShot[]; endAt: number }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { style } = useLook();
  const mono = useMonoType();
  const enter = ramp(frame, 0, Math.round(fps * 1.1), style.ease.out);
  const leave = ramp(frame, endAt - 14, 14, style.ease.in);
  const starts = shots.map((shot) => sec(shot.at, fps));
  const current = Math.max(0, starts.filter((s) => s <= frame).length - 1);
  const shot = shots[current];
  const shotStart = starts[current];
  const shotEnd = starts[current + 1] ?? endAt;
  // A slow turn across each shot gives the flat screenshot some depth.
  const drift = (frame - shotStart) / Math.max(1, shotEnd - shotStart);
  const rotateY = mix(-5, 5, drift) * (current % 2 ? -1 : 1);
  const rotateX = mix(26, 4, enter) + leave * 10;
  const lift = (1 - enter) * 340 - leave * 120;
  const scale = mix(0.84, 1, enter) - leave * 0.08;
  const barH = Math.round(SCREEN_H * 0.055);
  const camera = useZoom(shot.zoom, WINDOW_W, SCREEN_H);
  const left = (width - WINDOW_W) / 2;
  const top = (height - SCREEN_H - barH) / 2 + 40;

  return (
    <AbsoluteFill style={{ perspective: 2200, opacity: 1 - leave }}>
      <div style={{ ...mono, position: "absolute", left, top: top - 64, fontSize: 22, opacity: enter }}>
        <MaskLine key={current} delay={shotStart + 4}>
          <span style={{ color: style.colors.accent }}>{String(current + 1).padStart(2, "0")}</span>
          {"  "}
          {shot.label}
        </MaskLine>
      </div>
      <div
        style={{
          position: "absolute",
          left,
          top,
          transform: `translateY(${lift}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
          transformOrigin: "50% 100%",
        }}
      >
        <BrowserFrame url={shot.url} width={WINDOW_W} height={SCREEN_H}>
          <Screen src={resolve(shot.src)} zoom={shot.zoom} width={WINDOW_W} height={SCREEN_H} />
          <Cursor stops={shot.cursor} clicks={shot.clicks} width={WINDOW_W} height={SCREEN_H} map={camera.map} />
        </BrowserFrame>
        {shot.callout && (
          <div style={{ position: "absolute", left: 0, top: barH, width: WINDOW_W, height: SCREEN_H }}>
            <Callout {...shot.callout} {...camera.map(shot.callout.x, shot.callout.y)} width={WINDOW_W} height={SCREEN_H} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

function EndCard({ title, marked, url }: { title: string; marked: string; url: string }) {
  const frame = useCurrentFrame();
  const { style } = useLook();
  const display = useDisplayType();
  const mono = useMonoType();
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px" }}>
      <div style={{ ...display, fontSize: 150 }}>
        <div>
          <MaskLine delay={4}>{title}</MaskLine>
        </div>
        <div style={{ marginTop: 10 }}>
          <MaskLine delay={9}>
            <Marker delay={12}>{marked}</Marker>
          </MaskLine>
        </div>
      </div>
      <div style={{ ...mono, fontSize: 30, marginTop: 64, color: style.colors.ink, textTransform: "none", letterSpacing: "0.04em", opacity: ramp(frame, 22, 10) }}>
        → {url}
      </div>
    </AbsoluteFill>
  );
}

function Promo({ brand, shots, end }: Omit<ProductPromoProps, "style">) {
  const { fps, durationInFrames } = useVideoConfig();
  const endAt = sec(end.at, fps);
  const starts = shots.map((shot) => sec(shot.at, fps));
  return (
    <Stage>
      <Sequence durationInFrames={endAt} layout="none">
        <Window shots={shots} endAt={endAt} />
      </Sequence>
      <Sequence from={endAt} durationInFrames={durationInFrames - endAt} layout="none">
        <EndCard title={end.title} marked={end.marked} url={end.url} />
      </Sequence>
      {starts.slice(1).map((s) => (
        <BlockWipe key={s} at={s} duration={12} bands={4} />
      ))}
      <Corners bl={brand} tr="{tc}" inset={56} size={18} />
    </Stage>
  );
}

export function ProductPromo({ style, ...rest }: ProductPromoProps) {
  return (
    <LookProvider styleId={style}>
      <Promo {...rest} />
    </LookProvider>
  );
}

/** Uses the wireframe screens that ship in public/shots; replace with real screenshots. */
export const productPromoDefaults: ProductPromoProps = {
  style: "signal",
  brand: "Product — Promo",
  shots: [
    {
      src: "shots/demo-home.svg",
      url: "example.com",
      at: 0,
      label: "Главная",
      cursor: [
        { x: 0.72, y: 0.95, at: 1.1 },
        { x: 0.12, y: 0.62, at: 2.1 },
      ],
      clicks: [2.3],
      zoom: { x: 0.25, y: 0.4, scale: 1.5, at: 2.7, hold: 1.1 },
      callout: { x: 0.46, y: 0.27, text: "Оффер в первом экране", at: 3.1 },
    },
    {
      src: "shots/demo-store.svg",
      url: "example.com/store",
      at: 5.2,
      label: "Каталог",
      cursor: [
        { x: 0.3, y: 0.9, at: 5.6 },
        { x: 0.67, y: 0.74, at: 6.5 },
      ],
      clicks: [6.7],
      zoom: { x: 0.72, y: 0.62, scale: 1.6, at: 7.0, hold: 0.8 },
      callout: { x: 0.6, y: 0.74, text: "Покупка в один клик", at: 7.3, side: "left" },
    },
  ],
  end: { at: 8.7, title: "Ваш продукт.", marked: "В движении.", url: "example.com" },
};
