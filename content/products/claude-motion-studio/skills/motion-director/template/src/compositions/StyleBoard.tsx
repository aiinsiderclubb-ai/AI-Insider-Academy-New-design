import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { LookProvider, useDisplayType, useLook, useMonoType } from "../components/look";
import { Corners, GridLines, Stage } from "../components/stage";
import { MaskLine, Marker, useFitSize } from "../components/type";
import { STYLE_IDS } from "../styles/styles";

/**
 * The same two lines in every style of the library, one after another. Used
 * by the motion-director skill to let someone choose a style by looking, and
 * to check a new style against the others.
 */

export type StyleBoardProps = { first: string; second: string; seconds: number };

function Panel({ first, second, index, total }: { first: string; second: string; index: number; total: number }) {
  const { width } = useVideoConfig();
  const { style } = useLook();
  const display = useDisplayType();
  const mono = useMonoType();
  const size = useFitSize(first.length > second.length ? first : second, width * 0.72, 200);
  return (
    <Stage>
      <GridLines columns={12} inset={72} duration={14} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 140px" }}>
        <div style={{ ...mono, fontSize: 22, marginBottom: 36 }}>
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} — {style.name}
        </div>
        <div style={{ ...display, fontSize: size }}>
          <div>
            <MaskLine delay={2} duration={10}>{first}</MaskLine>
          </div>
          <div>
            <MaskLine delay={5} duration={10}>
              <Marker delay={9} duration={8}>
                {second}
              </Marker>
            </MaskLine>
          </div>
        </div>
      </AbsoluteFill>
      <Corners tl="Style library" tr="{tc}" inset={72} size={18} />
    </Stage>
  );
}

export function StyleBoard({ first, second, seconds }: StyleBoardProps) {
  const { fps } = useVideoConfig();
  const length = Math.round(seconds * fps);
  return (
    <>
      {STYLE_IDS.map((id, i) => (
        <Sequence key={id} from={i * length} durationInFrames={length}>
          <LookProvider styleId={id}>
            <Panel first={first} second={second} index={i} total={STYLE_IDS.length} />
          </LookProvider>
        </Sequence>
      ))}
    </>
  );
}

export const styleBoardDefaults: StyleBoardProps = { first: "Один текст.", second: "Восемь стилей.", seconds: 1 };
