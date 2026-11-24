import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Corners, GridLines, Stage } from "../components/stage";
import { Echo, Marker, MaskLine, Slam, TrackIn, Typewriter, splitWords, useFitSize } from "../components/type";
import { LookProvider, useDisplayType, useLook, useMonoType } from "../components/look";
import { beatFrames, pulse, ramp, sec, snapToBeat } from "../lib/motion";

/**
 * A typographic reel: a sequence of cards, each one phrase with one move.
 * Cuts land on the beat when `beats` are given (from the beat-sync skill).
 *
 * Moves:
 *   rise   — lines rise out of masks; `highlight` puts a marker behind words
 *   slam   — one word fills the width and lands; the frame flips to the accent
 *   track  — letter spacing closes from wide to tight
 *   echo   — one word stacked in outline, one copy filled
 *   type   — a command typed in mono, then its output
 *   marker — two lines, the second on an accent block
 */

export type KineticCard = {
  text: string;
  mode: "rise" | "slam" | "track" | "echo" | "type" | "marker";
  /** Start, seconds. The card runs until the next one starts. */
  at: number;
  /** Word indexes (counted across all lines of the card) to mark. */
  highlight?: number[];
  /** Second line for `type` (the output) — optional. */
  note?: string;
};

export type KineticTypeProps = {
  style: string;
  /** Top-left label. */
  kicker: string;
  /** Bottom-right label. */
  signature: string;
  cards: KineticCard[];
  /** Beat times in seconds. Empty = no snapping, no pulse. */
  beats: number[];
};

const MARGIN = 80;
/**
 * Reels, TikTok and Shorts put their like/comment/share buttons on the right,
 * from about the middle of the frame down. Text that must be read stays left
 * of them: the right margin is wider than the left.
 */
const SAFE_RIGHT = 150;
const TEXT_WIDTH = (width: number) => width - MARGIN - SAFE_RIGHT;

/** One line of a rise card, sized so it fills the width on its own. */
function FitLine({ line, first, row, length, highlight }: { line: string; first: number; row: number; length: number; highlight?: number[] }) {
  const { width } = useVideoConfig();
  const words = splitWords(line);
  const whole = words.every((_, w) => highlight?.includes(first + w));
  // A fully marked line is set slightly smaller so the marker fits inside the margins.
  const size = useFitSize(line, TEXT_WIDTH(width) - (whole ? 40 : 0), 330);
  if (whole) {
    return (
      <div style={{ fontSize: size, whiteSpace: "nowrap", margin: "0.06em 0" }}>
        <Marker delay={row * 4 + 10}>
          {words.map((word, w) => (
            <React.Fragment key={w}>
              <MaskLine delay={row * 4 + w * 2} exitAt={length - 12 + row}>
                {word}
              </MaskLine>
              {w < words.length - 1 ? " " : null}
            </React.Fragment>
          ))}
        </Marker>
      </div>
    );
  }
  return (
    <div style={{ fontSize: size, whiteSpace: "nowrap" }}>
      {words.map((word, w) => {
        const marked = highlight?.includes(first + w);
        return (
          <React.Fragment key={w}>
            <MaskLine delay={row * 4 + w * 2} exitAt={length - 12 + row}>
              {marked ? <Marker delay={row * 4 + 12}>{word}</Marker> : word}
            </MaskLine>
            {w < words.length - 1 ? " " : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function RiseCard({ card, length }: { card: KineticCard; length: number }) {
  const display = useDisplayType();
  const lines = card.text.split("\n");
  const firsts = lines.map((_, l) => lines.slice(0, l).reduce((n, line) => n + splitWords(line).length, 0));
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${SAFE_RIGHT}px 0 ${MARGIN}px` }}>
      <div style={{ ...display }}>
        {lines.map((line, l) => (
          <FitLine key={l} line={line} first={firsts[l]} row={l} length={length} highlight={card.highlight} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

function SlamCard({ card, beats }: { card: KineticCard; beats: number[] }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const { style } = useLook();
  const display = useDisplayType();
  const mono = useMonoType();
  const size = useFitSize(card.text, width - MARGIN * 2);
  const rule = ramp(frame, 6, 14, style.ease.out);
  const breathe = 1 + pulse(frame, beats, 10) * 0.025;
  return (
    <AbsoluteFill style={{ backgroundColor: style.colors.accent, justifyContent: "center", alignItems: "center" }}>
      <div style={{ ...display, fontSize: size, color: style.colors.onAccent, transform: `scale(${breathe})`, whiteSpace: "nowrap" }}>
        <Slam from={1.9}>{card.text}</Slam>
      </div>
      <div style={{ position: "absolute", left: MARGIN, right: MARGIN, top: "50%", marginTop: size * 0.62, height: 6, background: style.colors.onAccent, transform: `scaleX(${rule})`, transformOrigin: "left" }} />
      {card.note && (
        <div style={{ ...mono, position: "absolute", left: MARGIN, top: "50%", marginTop: size * 0.62 + 34, fontSize: 30, color: style.colors.onAccent, opacity: ramp(frame, 10, 10) }}>{card.note}</div>
      )}
    </AbsoluteFill>
  );
}

function TrackCard({ card }: { card: KineticCard }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const { style } = useLook();
  const display = useDisplayType();
  const mono = useMonoType();
  const size = useFitSize(card.text, TEXT_WIDTH(width), 260);
  const rule = ramp(frame, 4, 24, style.ease.out);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${SAFE_RIGHT}px 0 ${MARGIN}px` }}>
      {card.note && <div style={{ ...mono, fontSize: 26, marginBottom: 28, opacity: ramp(frame, 2, 8) }}>{card.note}</div>}
      <div style={{ height: 3, background: style.colors.accent, width: `${rule * 100}%`, marginBottom: 36 }} />
      <div style={{ ...display, fontSize: size, whiteSpace: "nowrap" }}>
        <TrackIn from={0.55}>{card.text}</TrackIn>
      </div>
      <div style={{ height: 3, background: style.colors.accent, width: `${rule * 100}%`, marginTop: 44, marginLeft: `${(1 - rule) * 100}%` }} />
    </AbsoluteFill>
  );
}

function EchoCard({ card }: { card: KineticCard }) {
  const { width } = useVideoConfig();
  const display = useDisplayType();
  const size = useFitSize(card.text, TEXT_WIDTH(width), 420);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${SAFE_RIGHT}px 0 ${MARGIN}px` }}>
      <div style={{ ...display }}>
        <Echo word={card.text} size={size} copies={5} filled={2} />
      </div>
    </AbsoluteFill>
  );
}

function TypeCard({ card }: { card: KineticCard }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { style, fonts } = useLook();
  const mono = useMonoType();
  const typed = Math.round((card.text.length / 22) * fps) + 6;
  const cells = 18;
  const done = Math.round(ramp(frame, typed + 2, 26, style.ease.inOut) * cells);
  const shown = frame > typed;
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${MARGIN}px`, fontFamily: fonts.mono, color: style.colors.ink }}>
      <div style={{ fontWeight: 500, fontSize: 66, lineHeight: 1.3 }}>
        <span style={{ color: style.colors.accent }}>{"$ "}</span>
        <Typewriter text={card.text} delay={4} cps={22} cursor={frame < typed + 8} />
      </div>
      <div style={{ fontSize: 44, marginTop: 40, opacity: shown ? 1 : 0, letterSpacing: "0.02em" }}>
        <span style={{ color: style.colors.accent }}>{"█".repeat(done)}</span>
        <span style={{ color: style.colors.line }}>{"█".repeat(cells - done)}</span>
        <span style={{ marginLeft: 24, fontVariantNumeric: "tabular-nums" }}>{String(Math.round((done / cells) * 100)).padStart(3, " ")}%</span>
      </div>
      {card.note && (
        <div style={{ ...mono, marginTop: 40, fontSize: 30, color: style.colors.accent, opacity: done === cells ? ramp(frame, typed + 28, 6) : 0 }}>{card.note}</div>
      )}
    </AbsoluteFill>
  );
}

function MarkerCard({ card, length }: { card: KineticCard; length: number }) {
  const { width } = useVideoConfig();
  const display = useDisplayType();
  const [first, second = ""] = card.text.split("\n");
  const size = useFitSize(first.length > second.length ? first : second, TEXT_WIDTH(width) - 40, 190);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${SAFE_RIGHT}px 0 ${MARGIN}px` }}>
      <div style={{ ...display, fontSize: size }}>
        <div>
          <MaskLine exitAt={length - 10}>{first}</MaskLine>
        </div>
        <div style={{ marginTop: size * 0.12 }}>
          <MaskLine delay={6} exitAt={length - 9}>
            <Marker delay={14}>{second}</Marker>
          </MaskLine>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Progress({ starts, total }: { starts: number[]; total: number }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { style } = useLook();
  const mono = useMonoType();
  const span = width - MARGIN * 2;
  const current = starts.filter((s) => s <= frame).length;
  return (
    <div style={{ position: "absolute", left: MARGIN, top: height - MARGIN - 70, width: span }}>
      <div style={{ position: "relative", height: 2, background: style.colors.line }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: (span * frame) / total, background: style.colors.accent }} />
        {starts.map((s) => (
          <div key={s} style={{ position: "absolute", left: (span * s) / total, top: -6, width: 2, height: 14, background: s <= frame ? style.colors.accent : style.colors.line }} />
        ))}
      </div>
      <div style={{ ...mono, marginTop: 18, fontSize: 22 }}>
        {String(Math.max(current, 1)).padStart(2, "0")} / {String(starts.length).padStart(2, "0")}
      </div>
    </div>
  );
}

function Reel({ kicker, signature, cards, beats }: Omit<KineticTypeProps, "style">) {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const { style } = useLook();
  const beatList = beatFrames(beats, fps);
  const starts = cards.map((card) => snapToBeat(sec(card.at, fps), beatList));
  const onAccent = cards.some((card, i) => card.mode === "slam" && frame >= starts[i] && frame < (starts[i + 1] ?? durationInFrames));
  return (
    <Stage>
      <GridLines columns={4} inset={MARGIN} />
      {cards.map((card, i) => {
        const from = starts[i];
        const length = (starts[i + 1] ?? durationInFrames) - from;
        return (
          <Sequence key={i} from={from} durationInFrames={length} layout="none">
            {card.mode === "rise" && <RiseCard card={card} length={length} />}
            {card.mode === "slam" && <SlamCard card={card} beats={beatList.map((b) => b - from)} />}
            {card.mode === "track" && <TrackCard card={card} />}
            {card.mode === "echo" && <EchoCard card={card} />}
            {card.mode === "type" && <TypeCard card={card} />}
            {card.mode === "marker" && <MarkerCard card={card} length={length} />}
          </Sequence>
        );
      })}
      <div style={{ opacity: onAccent ? 0 : 1 }}>
        <Corners tl={kicker} tr="{tc}" br={signature} inset={MARGIN} size={22} />
        <Progress starts={starts} total={durationInFrames} />
      </div>
    </Stage>
  );
}

export function KineticType({ style, ...rest }: KineticTypeProps) {
  return (
    <LookProvider styleId={style}>
      <Reel {...rest} />
    </LookProvider>
  );
}

export const kineticTypeDefaults: KineticTypeProps = {
  style: "signal",
  kicker: "AI Insider — Motion Studio",
  signature: "N°001",
  beats: [],
  cards: [
    { mode: "rise", at: 0, text: "Видео,\nкоторое\nне стыдно\nпоказать.", highlight: [2, 3] },
    { mode: "slam", at: 2.2, text: "РИТМ", note: "Монтаж — в долю такта" },
    { mode: "track", at: 3.6, text: "без шаблонов", note: "02 — Свой стиль" },
    { mode: "echo", at: 5.0, text: "ШРИФТ" },
    { mode: "type", at: 6.6, text: "npx remotion render", note: "✓ 300 кадров · 1080×1920" },
    { mode: "marker", at: 8.2, text: "Меньше хайпа.\nБольше систем." },
  ],
};
