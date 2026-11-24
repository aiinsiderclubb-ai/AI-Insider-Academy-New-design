import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Bars, Counter, Line, type ChartSpec, type Delta } from "../components/charts";
import { LookProvider, useDisplayType, useLook, useMonoType, useTextType } from "../components/look";
import { Corners, GridLines, Stage } from "../components/stage";
import { MaskLine, Words } from "../components/type";
import { ramp } from "../lib/motion";

/**
 * One number, one chart, one sentence. The left column says what the data
 * means; the right column shows it. `chart` is produced by the data-story
 * skill's csv_to_chart.py from a CSV, so every number on screen is one that
 * the script checked.
 */

export type DataStoryProps = {
  style: string;
  kicker: string;
  title: string;
  /** Word indexes in the title to put on a marker. */
  highlight: number[];
  number: { value: number; decimals: number; prefix: string; suffix: string; label: string };
  chart: ChartSpec;
  /** Bar charts: bracket the change between two bars. */
  delta?: Delta;
  source: string;
};

const M = 96;

function Story({ kicker, title, highlight, number, chart, delta, source }: Omit<DataStoryProps, "style">) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { style } = useLook();
  const display = useDisplayType();
  const text = useTextType();
  const mono = useMonoType();
  const column = (width - M * 2) / 12;
  const chartLeft = M + column * 5.4;
  const chartWidth = width - M - chartLeft - 40;
  const chartHeight = height * 0.54;
  const ruleIn = ramp(frame, 40, 20, style.ease.out);
  return (
    <Stage>
      <GridLines columns={12} inset={M} duration={30} />
      <Corners tl={kicker} tr="{tc}" bl={source} br="AI Insider — Motion Studio" inset={M / 2 + 8} size={18} />

      {/* Left column: the claim and the number. */}
      <AbsoluteFill style={{ left: M, top: M + 60, width: column * 4.9 }}>
        <div style={{ ...display, fontSize: 84, lineHeight: 1.0 }}>
          <Words text={title} delay={6} step={2} highlight={highlight} gap="0.22em" />
        </div>
        <div style={{ height: 2, background: style.colors.ink, marginTop: 56, width: `${ruleIn * 100}%`, opacity: 0.6 }} />
        <div style={{ ...display, fontSize: 210, lineHeight: 1, marginTop: 34, color: style.colors.accent }}>
          <MaskLine delay={34}>
            <Counter value={number.value} decimals={number.decimals} prefix={number.prefix} suffix={number.suffix} delay={40} />
          </MaskLine>
        </div>
        <div style={{ ...text, fontSize: 34, marginTop: 14, color: style.colors.muted, opacity: ramp(frame, 56, 12) }}>{number.label}</div>
      </AbsoluteFill>

      {/* Right column: the chart. */}
      <div style={{ position: "absolute", left: chartLeft + 60, top: (height - chartHeight) / 2 + 40 }}>
        <div style={{ ...mono, fontSize: 18, position: "absolute", top: -80, left: 0, opacity: ramp(frame, 20, 10) }}>
          {chart.series[0]?.name}
        </div>
        {chart.kind === "bar" ? (
          <Bars spec={chart} width={chartWidth - 220} height={chartHeight} delay={20} step={5} delta={delta} />
        ) : (
          <Line spec={chart} width={chartWidth - 200} height={chartHeight} delay={20} />
        )}
      </div>
    </Stage>
  );
}

export function DataStory({ style, ...rest }: DataStoryProps) {
  return (
    <LookProvider styleId={style}>
      <Story {...rest} />
    </LookProvider>
  );
}

export const dataStoryDefaults: DataStoryProps = {
  style: "signal",
  kicker: "Данные · кейс агентства",
  title: "Часы на ручную рутину каждую неделю",
  highlight: [2],
  number: { value: 29, decimals: 0, prefix: "−", suffix: " ч", label: "в неделю вернули команде за полгода" },
  chart: {
    kind: "bar",
    labels: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"],
    series: [{ name: "Часов в неделю", values: [38, 35, 31, 22, 14, 9] }],
    scale: { min: 0, max: 40, ticks: [0, 10, 20, 30, 40] },
    format: { decimals: 0, prefix: "", suffix: " ч" },
    highlight: { series: 0, index: 5 },
  },
  delta: { from: 0, to: 5, label: "−76%", at: 4.2 },
  source: "Источник: пример данных",
};

export const dataStoryLineDefaults: DataStoryProps = {
  style: "data-noir",
  kicker: "Данные · выручка",
  title: "Повторные продажи после запуска бота",
  highlight: [1],
  number: { value: 41.7, decimals: 1, prefix: "+", suffix: "%", label: "к недельной выручке за 24 недели" },
  chart: {
    kind: "line",
    labels: ["Нед 1", "Нед 4", "Нед 8", "Нед 12", "Нед 16", "Нед 20", "Нед 24"],
    series: [
      { name: "Выручка, тыс. €", values: [12, 12.6, 13.1, 14.8, 15.9, 16.4, 17] },
      { name: "До бота", values: [12, 12.2, 12.1, 12.4, 12.3, 12.1, 12] },
    ],
    scale: { min: 10, max: 18, ticks: [10, 12, 14, 16, 18] },
    format: { decimals: 1, prefix: "", suffix: "" },
    highlight: null,
  },
  source: "Источник: пример данных",
};
