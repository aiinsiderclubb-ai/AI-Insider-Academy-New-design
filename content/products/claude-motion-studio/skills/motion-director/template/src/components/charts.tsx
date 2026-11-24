import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { ramp } from "../lib/motion";
import { useLook, useMonoType } from "./look";

/**
 * Chart primitives. They draw exactly the numbers they are given: scales,
 * ticks and formats are computed beforehand by the data-story skill's
 * csv_to_chart.py, so nothing here rounds or guesses.
 */

export type ChartSpec = {
  kind: "bar" | "line";
  labels: string[];
  series: { name: string; values: number[] }[];
  scale: { min: number; max: number; ticks: number[] };
  format: { decimals: number; prefix: string; suffix: string };
  highlight?: { series: number; index: number } | null;
};

/** Formats a number the way people in the given locale write it: 12 500,5. */
export function formatNumber(value: number, decimals: number, locale = "ru-RU"): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

/** A number that counts up to its value. Tabular figures, so it does not jitter. */
export function Counter({
  value,
  from = 0,
  delay = 0,
  duration,
  decimals = 0,
  prefix = "",
  suffix = "",
  locale,
  style: css,
}: {
  value: number;
  from?: number;
  delay?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style } = useLook();
  const p = ramp(frame, delay, duration ?? Math.round(fps * style.beat * 3), style.ease.out);
  const current = from + (value - from) * p;
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...css }}>
      {prefix}
      {formatNumber(current, decimals, locale)}
      {suffix}
    </span>
  );
}

const toY = (value: number, spec: ChartSpec, height: number) =>
  height - ((value - spec.scale.min) / (spec.scale.max - spec.scale.min || 1)) * height;

function Axis({ spec, width, height, delay }: { spec: ChartSpec; width: number; height: number; delay: number }) {
  const frame = useCurrentFrame();
  const { style } = useLook();
  const mono = useMonoType();
  return (
    <>
      {spec.scale.ticks.map((tick, i) => {
        const p = ramp(frame, delay + i * 2, 18, style.ease.out);
        const y = toY(tick, spec, height);
        return (
          <div key={tick} style={{ position: "absolute", left: 0, top: y, width: width * p, height: 1, background: style.colors.line }}>
            <span style={{ ...mono, position: "absolute", right: "100%", top: -11, paddingRight: 18, fontSize: 18, opacity: p, letterSpacing: "0.04em" }}>
              {formatNumber(tick, spec.format.decimals)}
            </span>
          </div>
        );
      })}
    </>
  );
}

export type Delta = { from: number; to: number; label: string; at: number };

/**
 * Vertical bars that grow in sequence; the highlighted one takes the accent.
 * `delta` draws a dashed level from one bar to another and brackets the
 * difference with a label, at `at` seconds.
 */
export function Bars({ spec, width, height, delay = 0, step = 4, delta }: { spec: ChartSpec; width: number; height: number; delay?: number; step?: number; delta?: Delta }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style } = useLook();
  const mono = useMonoType();
  const values = spec.series[0]?.values ?? [];
  const slot = width / values.length;
  const barWidth = slot * 0.62;
  const zero = toY(Math.max(spec.scale.min, 0), spec, height);
  return (
    <div style={{ position: "relative", width, height }}>
      <Axis spec={spec} width={width} height={height} delay={delay} />
      {values.map((value, i) => {
        const p = ramp(frame, delay + 10 + i * step, Math.round(fps * style.beat * 1.8), style.ease.out);
        const top = toY(value, spec, height);
        const hot = spec.highlight ? spec.highlight.index === i : i === values.length - 1;
        const h = (zero - top) * p;
        return (
          <div key={i} style={{ position: "absolute", left: i * slot + (slot - barWidth) / 2, width: barWidth, top: zero - h, height: Math.max(h, 0) }}>
            <div style={{ position: "absolute", inset: 0, background: hot ? style.colors.accent : style.colors.ink, opacity: hot ? 1 : 0.18, borderRadius: `${Math.min(style.radius, 6)}px ${Math.min(style.radius, 6)}px 0 0` }} />
            <span style={{ ...mono, position: "absolute", top: -42, left: 0, right: 0, textAlign: "center", fontSize: 22, color: hot ? style.colors.accent : style.colors.ink, opacity: ramp(frame, delay + 24 + i * step, 10), letterSpacing: "0.02em" }}>
              {formatNumber(value * p, spec.format.decimals)}
            </span>
            <span style={{ ...mono, position: "absolute", top: h + 18, left: -20, right: -20, textAlign: "center", fontSize: 18 }}>{spec.labels[i]}</span>
          </div>
        );
      })}
      {delta && <DeltaMark spec={spec} delta={delta} slot={slot} height={height} />}
    </div>
  );
}

function DeltaMark({ spec, delta, slot, height }: { spec: ChartSpec; delta: Delta; slot: number; height: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, fonts } = useLook();
  const values = spec.series[0]?.values ?? [];
  const start = Math.round(delta.at * fps);
  const level = ramp(frame, start, Math.round(fps * style.beat * 1.6), style.ease.inOut);
  const bracket = ramp(frame, start + 12, Math.round(fps * style.beat * 1.2), style.ease.out);
  const label = ramp(frame, start + 22, Math.round(fps * style.beat), style.ease.out);
  const x0 = delta.from * slot + slot / 2;
  const x1 = delta.to * slot + slot / 2 + slot * 0.42;
  const y0 = toY(values[delta.from], spec, height);
  const y1 = toY(values[delta.to], spec, height);
  return (
    <>
      <div style={{ position: "absolute", left: x0, top: y0, width: (x1 - x0) * level, borderTop: `2px dashed ${style.colors.accent}` }} />
      <div style={{ position: "absolute", left: x1, top: y0, width: 2, height: (y1 - y0) * bracket, background: style.colors.accent }} />
      <div style={{ position: "absolute", left: x1 - 10, top: y1, width: 12, height: 2, background: style.colors.accent, opacity: bracket }} />
      <div
        style={{
          position: "absolute",
          left: x1 + 22,
          top: (y0 + y1) / 2 - 34,
          fontFamily: fonts.display,
          fontWeight: style.fonts.display.weight,
          letterSpacing: `${style.fonts.display.tracking}em`,
          fontSize: 56,
          color: style.colors.onAccent,
          background: style.colors.accent,
          padding: "2px 14px 6px",
          borderRadius: Math.min(style.radius, 8),
          opacity: label,
          transform: `translateX(${(1 - label) * -20}px)`,
          whiteSpace: "nowrap",
        }}
      >
        {delta.label}
      </div>
    </>
  );
}

/** A line that draws itself, with a dot riding its tip and a value tag at the end. */
export function Line({ spec, width, height, delay = 0, duration }: { spec: ChartSpec; width: number; height: number; delay?: number; duration?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style } = useLook();
  const mono = useMonoType();
  const length = duration ?? Math.round(fps * style.beat * 5);
  return (
    <div style={{ position: "relative", width, height }}>
      <Axis spec={spec} width={width} height={height} delay={delay} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {spec.series.map((series, s) => {
          const points = series.values.map((v, i) => [(i / (series.values.length - 1 || 1)) * width, toY(v, spec, height)] as const);
          const d = points.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
          const p = ramp(frame, delay + 12 + s * 8, length, style.ease.inOut);
          const evolved = evolvePath(p, d);
          const colour = s === 0 ? style.colors.accent : style.colors.ink;
          // Position of the tip: interpolate along the polyline by index.
          const f = p * (points.length - 1);
          const i0 = Math.min(points.length - 2, Math.floor(f));
          const t = f - i0;
          const tip = points.length > 1 ? [points[i0][0] + (points[i0 + 1][0] - points[i0][0]) * t, points[i0][1] + (points[i0 + 1][1] - points[i0][1]) * t] : points[0];
          const value = series.values[i0] + (series.values[Math.min(i0 + 1, series.values.length - 1)] - series.values[i0]) * t;
          return (
            <g key={series.name}>
              <path d={d} fill="none" stroke={colour} strokeWidth={s === 0 ? 6 : 3} strokeLinejoin="round" strokeLinecap="round" opacity={s === 0 ? 1 : 0.45} strokeDasharray={evolved.strokeDasharray} strokeDashoffset={evolved.strokeDashoffset} />
              {s > 0 && (
                <foreignObject x={points[points.length - 1][0] + 18} y={points[points.length - 1][1] - 16} width={260} height={40}>
                  <div style={{ ...mono, fontSize: 18, opacity: ramp(frame, delay + 12 + s * 8 + length, 10) }}>{series.name}</div>
                </foreignObject>
              )}
              {s === 0 && p > 0 && (
                <>
                  <circle cx={tip[0]} cy={tip[1]} r={12} fill={style.colors.ground} stroke={colour} strokeWidth={5} />
                  <foreignObject x={tip[0] + 22} y={tip[1] - 64} width={300} height={60}>
                    <div style={{ ...mono, fontSize: 26, color: colour, letterSpacing: "0.02em" }}>
                      {spec.format.prefix}
                      {formatNumber(value, spec.format.decimals)}
                      {spec.format.suffix}
                    </div>
                  </foreignObject>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", top: height + 20, left: 0, right: 0, display: "flex", justifyContent: "space-between" }}>
        {spec.labels.map((label, i) => (
          <span key={i} style={{ ...mono, fontSize: 18, opacity: ramp(frame, delay + i, 10) }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
