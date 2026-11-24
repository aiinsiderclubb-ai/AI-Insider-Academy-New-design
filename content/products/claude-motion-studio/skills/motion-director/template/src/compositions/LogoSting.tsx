import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { LookProvider, useDisplayType, useLook, useMonoType } from "../components/look";
import { Corners, Stage } from "../components/stage";
import { MaskLine, TrackIn } from "../components/type";
import { mix, ramp } from "../lib/motion";
import brandMark from "../../public/data/logo-sample.json";

/**
 * A logo sting: registration marks draw in, the logo's outlines trace
 * themselves, the fills land, the mark slides aside and the name rises next
 * to it. About four seconds — the length of an intro or an outro.
 *
 * `logo` comes from the logo-sting skill's svg_prepare.py, which turns an
 * SVG's shapes into plain paths with their fills.
 */

export type LogoPath = { d: string; fill: string | null; stroke: string | null; strokeWidth: number };
export type LogoData = { viewBox: [number, number, number, number]; paths: LogoPath[] };

export type LogoStingProps = {
  style: string;
  logo: LogoData;
  name: string;
  tagline: string;
  /** Use the style's accent for fills instead of the logo's own colours. */
  monochrome: boolean;
};

function Marks({ size }: { size: number }) {
  const frame = useCurrentFrame();
  const { style } = useLook();
  const p = ramp(frame, 0, 22, style.ease.out);
  const out = ramp(frame, 40, 14, style.ease.in);
  const reach = size * 0.9 * p;
  const line = (w: number, h: number, x: number, y: number) => (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: style.colors.line, opacity: 1 - out }} />
  );
  return (
    <>
      {line(reach * 2, 1, -reach, 0)}
      {line(1, reach * 2, 0, -reach)}
      <div style={{ position: "absolute", left: -size * 0.6, top: -size * 0.6, width: size * 1.2, height: size * 1.2, border: `1px solid ${style.colors.line}`, borderRadius: "50%", transform: `scale(${p})`, opacity: 1 - out }} />
    </>
  );
}

function Mark({ logo, size, monochrome }: { logo: LogoData; size: number; monochrome: boolean }) {
  const frame = useCurrentFrame();
  const { style } = useLook();
  const [, , vw, vh] = logo.viewBox;
  const unit = vw / size; // viewBox units per pixel
  return (
    <svg width={size} height={(size * vh) / vw} viewBox={logo.viewBox.join(" ")} style={{ overflow: "visible" }}>
      {logo.paths.map((path, i) => {
        // Filled shapes trace first; outline-only shapes are drawn on top once the fills are in.
        const outlineOnly = !path.fill && !monochrome;
        const draw = ramp(frame, outlineOnly ? 40 + i * 4 : 8 + i * 6, outlineOnly ? 18 : 26, style.ease.inOut);
        const fill = ramp(frame, 30 + i * 4, 12, style.ease.out);
        const evolved = evolvePath(draw, path.d);
        const colour = monochrome ? (i === 0 ? style.colors.accent : style.colors.onAccent) : path.fill ?? style.colors.ink;
        return (
          <g key={i}>
            {(path.fill || monochrome) && <path d={path.d} fill={colour} opacity={fill} />}
            <path
              d={path.d}
              fill="none"
              stroke={path.stroke && !monochrome ? path.stroke : style.colors.accent}
              strokeWidth={path.stroke ? path.strokeWidth : unit * 3}
              strokeDasharray={evolved.strokeDasharray}
              strokeDashoffset={evolved.strokeDashoffset}
              opacity={path.stroke ? 1 : 1 - fill}
            />
          </g>
        );
      })}
    </svg>
  );
}

function Sting({ logo, name, tagline, monochrome }: Omit<LogoStingProps, "style">) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const { style } = useLook();
  const display = useDisplayType();
  const mono = useMonoType();
  const size = 300;
  const slide = spring({ frame: frame - 46, fps, config: style.spring });
  const pop = spring({ frame: frame - 30, fps, config: { damping: 12, stiffness: 160 } });
  const nameSize = 176;
  // The mark starts centred, then moves left to make room for the name.
  const shift = mix(0, -Math.min(width * 0.24, name.length * nameSize * 0.28), slide);
  const exit = ramp(frame, fps * 4.4, 10, style.ease.in);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - exit }}>
      <div style={{ position: "relative", transform: `translateX(${shift}px)` }}>
        <div style={{ position: "absolute", left: size / 2, top: size / 2 }}>
          <Marks size={size} />
        </div>
        <div style={{ transform: `scale(${mix(0.92, 1, pop)})` }}>
          <Mark logo={logo} size={size} monochrome={monochrome} />
        </div>
        <div style={{ position: "absolute", left: size + 64, top: size / 2, transform: "translateY(-58%)", whiteSpace: "nowrap" }}>
          <div style={{ ...display, fontSize: nameSize, lineHeight: 1 }}>
            {name.split("").map((char, i) => (
              <MaskLine key={i} delay={52 + i * 2}>
                {char === " " ? " " : char}
              </MaskLine>
            ))}
          </div>
          <div style={{ ...mono, fontSize: 28, marginTop: 22, color: style.colors.accent }}>
            <TrackIn delay={70} from={0.6} to={0.16}>
              {tagline}
            </TrackIn>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function LogoSting({ style, ...rest }: LogoStingProps) {
  return (
    <LookProvider styleId={style}>
      <Stage>
        <Sting {...rest} />
        <Corners tl="Logo — Sting" tr="{tc}" inset={56} size={18} />
      </Stage>
    </LookProvider>
  );
}

export const logoStingDefaults: LogoStingProps = {
  style: "signal",
  logo: brandMark as LogoData,
  name: "Insider",
  tagline: "Motion Studio",
  monochrome: false,
};
