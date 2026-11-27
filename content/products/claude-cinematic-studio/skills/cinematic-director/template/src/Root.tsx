import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { HeroTitle, heroTitleSchema } from "./compositions/HeroTitle";
import { OrbitType, orbitTypeSchema } from "./compositions/OrbitType";
import { TechFilm, techFilmSchema } from "./compositions/TechFilm";
import { KineticSpot, kineticSpotSchema } from "./compositions/KineticSpot";
import { FootageFX, footageFxSchema } from "./compositions/FootageFX";

/**
 * Every composition is timed in seconds. Its frame rate comes from the `fps`
 * prop (default 30), so the same film renders at 24, 30, 60 — or at 120 to be
 * blended down to 30 with real motion blur by grade-finish/finish.py.
 */
function seconds<T extends Record<string, unknown>>(length: number | ((props: T) => number)): CalculateMetadataFunction<T> {
  return ({ props }) => {
    const fps = typeof props.fps === "number" ? props.fps : 30;
    const s = typeof length === "function" ? length(props) : length;
    return { fps, durationInFrames: Math.round(s * fps) };
  };
}

export const Root: React.FC = () => (
  <>
    <Composition
      id="HeroTitle"
      component={HeroTitle}
      schema={heroTitleSchema}
      calculateMetadata={seconds(8)}
      durationInFrames={240}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ look: "keynote" as const, kicker: "ПРЕДСТАВЛЯЕМ", title: "НОВАЯ ЭРА", subtitle: "Скорость, которую видно" }}
    />
    <Composition
      id="OrbitType"
      component={OrbitType}
      schema={orbitTypeSchema}
      calculateMetadata={seconds(9)}
      durationInFrames={270}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        look: "neon" as const,
        ring: "ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ",
        ring2: "NEURAL CORE · 2026 · ONLINE",
        title: "ЯДРО",
        label: "СИНХРОНИЗАЦИЯ",
        value: "99.8%",
      }}
    />
    <Composition
      id="TechFilm"
      component={TechFilm}
      schema={techFilmSchema}
      calculateMetadata={seconds(12)}
      durationInFrames={360}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        look: "neon" as const,
        line1: "БУДУЩЕЕ",
        hudLabel: "ОБЪЕКТ 01",
        hudValue: "ЗАХВАЧЕН",
        brand: "INSIDER",
        tagline: "СИСТЕМЫ НОВОГО ПОКОЛЕНИЯ",
      }}
    />
    <Composition
      id="KineticSpot"
      component={KineticSpot}
      schema={kineticSpotSchema}
      calculateMetadata={seconds((p) => (p.words.length + 2) * (120 / p.bpm))}
      durationInFrames={210}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ look: "kinetic" as const, words: ["БЫСТРЕЕ", "ВЫШЕ", "СИЛЬНЕЕ", "СЕЙЧАС"], final: "ТВОЙ ХОД", bpm: 128 }}
    />
    <Composition
      id="FootageFX"
      component={FootageFX}
      schema={footageFxSchema}
      calculateMetadata={seconds(6)}
      durationInFrames={180}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        look: "keynote" as const,
        footage: "device",
        title: "ТИТАН",
        callout: "КАМЕРА 48 МП",
        calloutValue: "ƒ/1.6",
        trackLabel: "camera",
      }}
    />
  </>
);
