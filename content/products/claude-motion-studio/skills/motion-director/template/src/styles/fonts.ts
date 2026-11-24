import { loadFont as geologica } from "@remotion/google-fonts/Geologica";
import { loadFont as golosText } from "@remotion/google-fonts/GolosText";
import { loadFont as ibmPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as interTight } from "@remotion/google-fonts/InterTight";
import { loadFont as jetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as manrope } from "@remotion/google-fonts/Manrope";
import { loadFont as onest } from "@remotion/google-fonts/Onest";
import { loadFont as playfairDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as robotoCondensed } from "@remotion/google-fonts/RobotoCondensed";
import { loadFont as robotoMono } from "@remotion/google-fonts/RobotoMono";
import { loadFont as rubik } from "@remotion/google-fonts/Rubik";
import { loadFont as spectral } from "@remotion/google-fonts/Spectral";
import { loadFont as unbounded } from "@remotion/google-fonts/Unbounded";
import type { FontFamilyId, FontRole, Style } from "./styles";

/**
 * Fonts come from Google Fonts at render time (the renderer needs internet the
 * first time). Only the weights a style uses are fetched, in Latin and
 * Cyrillic. To use a local font instead, put the file in public/fonts and load
 * it with @remotion/fonts — see the motion-director skill, references/fonts.md.
 */

// Each loader is typed with its own weight list; they share one call shape.
type Loader = (
  style?: "normal" | "italic",
  options?: { weights?: string[]; subsets?: string[] },
) => { fontFamily: string; waitUntilDone: () => Promise<unknown> };

const LOADERS: Record<FontFamilyId, Loader> = {
  Geologica: geologica as unknown as Loader,
  GolosText: golosText as unknown as Loader,
  IBMPlexMono: ibmPlexMono as unknown as Loader,
  InterTight: interTight as unknown as Loader,
  JetBrainsMono: jetBrainsMono as unknown as Loader,
  Manrope: manrope as unknown as Loader,
  Onest: onest as unknown as Loader,
  PlayfairDisplay: playfairDisplay as unknown as Loader,
  RobotoCondensed: robotoCondensed as unknown as Loader,
  RobotoMono: robotoMono as unknown as Loader,
  Rubik: rubik as unknown as Loader,
  Spectral: spectral as unknown as Loader,
  Unbounded: unbounded as unknown as Loader,
};

const loaded = new Map<string, { fontFamily: string; done: Promise<unknown> }>();

function load(role: FontRole, extraWeights: number[] = []) {
  const weights = [...new Set([role.weight, ...extraWeights])].map(String);
  const key = `${role.family}:${role.italic ? "i" : "n"}:${weights.join(",")}`;
  const hit = loaded.get(key);
  if (hit) return hit;
  const font = LOADERS[role.family](role.italic ? "italic" : "normal", {
    weights,
    subsets: ["latin", "cyrillic"],
  });
  const entry = { fontFamily: font.fontFamily, done: font.waitUntilDone() };
  loaded.set(key, entry);
  return entry;
}

export type StyleFonts = { display: string; text: string; mono: string };

/**
 * Starts loading a style's three faces. Returns their CSS font-family values
 * and a promise that settles when the files are in — text is measured (for
 * fitting words to the frame) only after that.
 */
export function loadStyleFonts(style: Style): { fonts: StyleFonts; ready: Promise<unknown> } {
  const display = load(style.fonts.display);
  const text = load(style.fonts.text, style.fonts.text.weight === 700 ? [] : [700]);
  const mono = load(style.fonts.mono);
  return {
    fonts: { display: display.fontFamily, text: text.fontFamily, mono: mono.fontFamily },
    ready: Promise.all([display.done, text.done, mono.done]),
  };
}
