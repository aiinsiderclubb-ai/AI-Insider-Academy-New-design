/**
 * The style library. A style is a complete set of decisions — colours, type,
 * easing, texture and how things are allowed to move — so a video made in one
 * style looks designed rather than assembled. Pick one per video; do not mix.
 *
 * Every family here has Cyrillic glyphs on Google Fonts, so Russian and
 * Ukrainian text renders in the intended face, not in a fallback.
 *
 * Descriptions for choosing a style live in the motion-director skill:
 * references/styles.md.
 */

export type Bezier = [number, number, number, number];

export type StyleId =
  | "signal"
  | "swiss-grid"
  | "editorial"
  | "terminal"
  | "bold-kinetic"
  | "data-noir"
  | "print-riso"
  | "quiet-line";

export type FontRole = {
  /** Google Fonts family, exactly as loadFont() exports it (see fonts.ts). */
  family: FontFamilyId;
  weight: number;
  /** Letter spacing in em at display sizes. */
  tracking: number;
  /** Line height at display sizes. */
  leading: number;
  italic?: boolean;
  uppercase?: boolean;
};

export type FontFamilyId =
  | "Geologica"
  | "GolosText"
  | "JetBrainsMono"
  | "InterTight"
  | "PlayfairDisplay"
  | "IBMPlexMono"
  | "Unbounded"
  | "Onest"
  | "RobotoCondensed"
  | "RobotoMono"
  | "Rubik"
  | "Spectral"
  | "Manrope";

export type Style = {
  id: StyleId;
  name: string;
  colors: {
    ground: string;
    /** A second ground for panels and cards. */
    panel: string;
    ink: string;
    muted: string;
    line: string;
    accent: string;
    /** Text set on the accent colour. */
    onAccent: string;
    /** Second accent, used sparingly: negative values, a second series. */
    accent2: string;
  };
  fonts: { display: FontRole; text: FontRole; mono: FontRole };
  ease: { out: Bezier; inOut: Bezier; in: Bezier };
  /** For spring() — damping high means no wobble. */
  spring: { damping: number; stiffness: number; mass: number };
  /** Base duration of one move, in seconds. Everything else scales from it. */
  beat: number;
  texture: { grain: number; scanlines: boolean; misregister: number };
  /** Animate on twos: hold every second frame, for a printed, hand-made feel. */
  onTwos: boolean;
  radius: number;
};

const mono = (family: FontFamilyId, weight = 500): FontRole => ({ family, weight, tracking: 0.02, leading: 1.3 });

export const STYLES: Record<StyleId, Style> = {
  signal: {
    id: "signal",
    name: "Signal",
    colors: {
      ground: "#0b0a09",
      panel: "#161412",
      ink: "#ece2d8",
      muted: "#8a8178",
      line: "rgba(236, 226, 216, 0.14)",
      accent: "#ff7a1a",
      onAccent: "#120a03",
      accent2: "#ece2d8",
    },
    fonts: {
      display: { family: "Geologica", weight: 800, tracking: -0.055, leading: 0.92 },
      text: { family: "GolosText", weight: 500, tracking: -0.01, leading: 1.35 },
      mono: mono("JetBrainsMono"),
    },
    ease: { out: [0.16, 1, 0.3, 1], inOut: [0.76, 0, 0.24, 1], in: [0.7, 0, 0.84, 0] },
    spring: { damping: 200, stiffness: 120, mass: 1 },
    beat: 0.5,
    texture: { grain: 0.07, scanlines: false, misregister: 0 },
    onTwos: false,
    radius: 14,
  },
  "swiss-grid": {
    id: "swiss-grid",
    name: "Swiss Grid",
    colors: {
      ground: "#f1efea",
      panel: "#e6e3dc",
      ink: "#111111",
      muted: "#6d6a64",
      line: "rgba(17, 17, 17, 0.16)",
      accent: "#e5321c",
      onAccent: "#ffffff",
      accent2: "#111111",
    },
    fonts: {
      display: { family: "InterTight", weight: 800, tracking: -0.045, leading: 0.9 },
      text: { family: "InterTight", weight: 500, tracking: -0.01, leading: 1.3 },
      mono: mono("RobotoMono"),
    },
    ease: { out: [0.33, 1, 0.68, 1], inOut: [0.65, 0, 0.35, 1], in: [0.32, 0, 0.67, 0] },
    spring: { damping: 200, stiffness: 160, mass: 1 },
    beat: 0.4,
    texture: { grain: 0, scanlines: false, misregister: 0 },
    onTwos: false,
    radius: 0,
  },
  editorial: {
    id: "editorial",
    name: "Editorial",
    colors: {
      ground: "#f3ede3",
      panel: "#e9e1d3",
      ink: "#1c1a17",
      muted: "#7b7266",
      line: "rgba(28, 26, 23, 0.18)",
      accent: "#1f5c4a",
      onAccent: "#f3ede3",
      accent2: "#a3442a",
    },
    fonts: {
      display: { family: "PlayfairDisplay", weight: 500, tracking: -0.02, leading: 1.0, italic: false },
      text: { family: "GolosText", weight: 400, tracking: 0, leading: 1.45 },
      mono: mono("IBMPlexMono", 400),
    },
    ease: { out: [0.22, 1, 0.36, 1], inOut: [0.45, 0, 0.55, 1], in: [0.55, 0, 1, 0.45] },
    spring: { damping: 200, stiffness: 60, mass: 1.2 },
    beat: 0.9,
    texture: { grain: 0.05, scanlines: false, misregister: 0 },
    onTwos: false,
    radius: 2,
  },
  terminal: {
    id: "terminal",
    name: "Terminal",
    colors: {
      ground: "#070605",
      panel: "#12100c",
      ink: "#ffb547",
      muted: "#8c6a33",
      line: "rgba(255, 181, 71, 0.16)",
      accent: "#ffb547",
      onAccent: "#070605",
      accent2: "#ff5a36",
    },
    fonts: {
      display: { family: "JetBrainsMono", weight: 800, tracking: -0.04, leading: 1.0 },
      text: { family: "JetBrainsMono", weight: 500, tracking: 0, leading: 1.4 },
      mono: mono("JetBrainsMono"),
    },
    ease: { out: [0, 0, 1, 1], inOut: [0, 0, 1, 1], in: [0, 0, 1, 1] },
    spring: { damping: 200, stiffness: 300, mass: 0.6 },
    beat: 0.35,
    texture: { grain: 0.09, scanlines: true, misregister: 0 },
    onTwos: false,
    radius: 0,
  },
  "bold-kinetic": {
    id: "bold-kinetic",
    name: "Bold Kinetic",
    colors: {
      ground: "#e4ff3a",
      panel: "#d4ef28",
      ink: "#0c0c0c",
      muted: "#3d4410",
      line: "rgba(12, 12, 12, 0.2)",
      accent: "#0c0c0c",
      onAccent: "#e4ff3a",
      accent2: "#ff3d7f",
    },
    fonts: {
      display: { family: "Unbounded", weight: 900, tracking: -0.04, leading: 0.9, uppercase: true },
      text: { family: "Onest", weight: 600, tracking: -0.01, leading: 1.25 },
      mono: mono("RobotoMono", 600),
    },
    ease: { out: [0.34, 1.56, 0.64, 1], inOut: [0.68, -0.6, 0.32, 1.6], in: [0.36, 0, 0.66, -0.56] },
    spring: { damping: 11, stiffness: 170, mass: 0.8 },
    beat: 0.3,
    texture: { grain: 0.04, scanlines: false, misregister: 0 },
    onTwos: false,
    radius: 0,
  },
  "data-noir": {
    id: "data-noir",
    name: "Data Noir",
    colors: {
      ground: "#0c1014",
      panel: "#141a21",
      ink: "#e7edf2",
      muted: "#7d8a96",
      line: "rgba(231, 237, 242, 0.12)",
      accent: "#36d6c3",
      onAccent: "#04110f",
      accent2: "#ff6159",
    },
    fonts: {
      display: { family: "RobotoCondensed", weight: 700, tracking: -0.03, leading: 0.95 },
      text: { family: "RobotoCondensed", weight: 400, tracking: 0, leading: 1.3 },
      mono: mono("RobotoMono", 500),
    },
    ease: { out: [0.25, 1, 0.5, 1], inOut: [0.83, 0, 0.17, 1], in: [0.5, 0, 0.75, 0] },
    spring: { damping: 200, stiffness: 100, mass: 1 },
    beat: 0.6,
    texture: { grain: 0.04, scanlines: false, misregister: 0 },
    onTwos: false,
    radius: 4,
  },
  "print-riso": {
    id: "print-riso",
    name: "Print Riso",
    colors: {
      ground: "#efe8d8",
      panel: "#e6dcc6",
      ink: "#1d3fd6",
      muted: "#6f6a8f",
      line: "rgba(29, 63, 214, 0.25)",
      accent: "#ff4fa3",
      onAccent: "#efe8d8",
      accent2: "#1d3fd6",
    },
    fonts: {
      display: { family: "Rubik", weight: 900, tracking: -0.04, leading: 0.9 },
      text: { family: "Spectral", weight: 500, tracking: 0, leading: 1.35 },
      mono: mono("RobotoMono", 500),
    },
    ease: { out: [0.2, 0.9, 0.3, 1], inOut: [0.6, 0, 0.4, 1], in: [0.5, 0, 0.9, 0.5] },
    spring: { damping: 18, stiffness: 140, mass: 1 },
    beat: 0.5,
    texture: { grain: 0.16, scanlines: false, misregister: 6 },
    onTwos: true,
    radius: 0,
  },
  "quiet-line": {
    id: "quiet-line",
    name: "Quiet Line",
    colors: {
      ground: "#0f0f0f",
      panel: "#171717",
      ink: "#f2f2f2",
      muted: "#808080",
      line: "rgba(242, 242, 242, 0.22)",
      accent: "#f2f2f2",
      onAccent: "#0f0f0f",
      accent2: "#808080",
    },
    fonts: {
      display: { family: "Manrope", weight: 300, tracking: -0.04, leading: 1.0 },
      text: { family: "Manrope", weight: 500, tracking: 0, leading: 1.4 },
      mono: mono("IBMPlexMono", 400),
    },
    ease: { out: [0.22, 1, 0.36, 1], inOut: [0.37, 0, 0.63, 1], in: [0.64, 0, 0.78, 0] },
    spring: { damping: 200, stiffness: 50, mass: 1.4 },
    beat: 1.0,
    texture: { grain: 0.03, scanlines: false, misregister: 0 },
    onTwos: false,
    radius: 999,
  },
};

export const STYLE_IDS = Object.keys(STYLES) as StyleId[];

export function getStyle(id: string | undefined): Style {
  return STYLES[(id ?? "signal") as StyleId] ?? STYLES.signal;
}
