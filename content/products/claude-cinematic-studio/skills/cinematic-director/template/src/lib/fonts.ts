/*
 * TTF files for extruded 3D type. They come from npm (Google Fonts, SIL Open
 * Font License), so the project ships no binaries and every font has Cyrillic.
 * The bundler turns each import into a URL that the TTF loader reads.
 */
import interTight800 from "@expo-google-fonts/inter-tight/800ExtraBold/InterTight_800ExtraBold.ttf";
import interTight500 from "@expo-google-fonts/inter-tight/500Medium/InterTight_500Medium.ttf";
import unbounded800 from "@expo-google-fonts/unbounded/800ExtraBold/Unbounded_800ExtraBold.ttf";
import jetbrains500 from "@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf";
import playfair900 from "@expo-google-fonts/playfair-display/900Black/PlayfairDisplay_900Black.ttf";

export const FONTS = {
  "inter-tight-800": interTight800,
  "inter-tight-500": interTight500,
  "unbounded-800": unbounded800,
  "jetbrains-500": jetbrains500,
  "playfair-900": playfair900,
} as const;

export type FontName = keyof typeof FONTS;
