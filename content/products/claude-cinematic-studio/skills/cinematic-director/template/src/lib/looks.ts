import type { FontName } from "./fonts";

/**
 * A look is a whole art direction in one object: background, light, the
 * material of the type, post-processing and grain. Scenes read the look and
 * never hard-code colours, so one prop restyles a film.
 */
export interface Look {
  name: string;
  /** What the look is for — shown to the agent in `cinematic-director`. */
  brief: string;
  background: string;
  fog: { color: string; near: number; far: number } | null;
  accent: string;
  /** A second accent for light trails and HUD. */
  accent2: string;
  font: { display: FontName; text: FontName; mono: FontName };
  type: {
    color: string;
    metalness: number;
    roughness: number;
    clearcoat: number;
    /** Self-glow of the letters; with bloom it reads as light, not paint. */
    emissive: string;
    emissiveIntensity: number;
  };
  light: {
    /** Strip lights reflected in metal: the "studio softbox" read. */
    strips: number;
    stripIntensity: number;
    key: number;
    rim: string;
    rimIntensity: number;
    ambient: number;
  };
  post: {
    bloom: number;
    bloomThreshold: number;
    /** Chromatic aberration at rest; scenes raise it on fast moves. */
    aberration: number;
    grain: number;
    vignette: number;
    /** Depth of field strength (bokeh scale). 0 turns DOF off. */
    bokeh: number;
  };
}

export const LOOKS = {
  keynote: {
    name: "Keynote",
    brief: "Premium product launch. Titanium type in black space, soft strip lights gliding over it, slow camera, very little colour.",
    background: "#050506",
    fog: { color: "#050506", near: 9, far: 26 },
    accent: "#f5f5f7",
    accent2: "#8ab4ff",
    font: { display: "inter-tight-800", text: "inter-tight-500", mono: "jetbrains-500" },
    type: { color: "#d9dade", metalness: 1, roughness: 0.22, clearcoat: 1, emissive: "#000000", emissiveIntensity: 0 },
    light: { strips: 4, stripIntensity: 3.2, key: 1.2, rim: "#9fb8ff", rimIntensity: 2.2, ambient: 0.08 },
    post: { bloom: 0.55, bloomThreshold: 0.75, aberration: 0.0006, grain: 0.05, vignette: 0.55, bokeh: 3 },
  },
  chrome: {
    name: "Chrome",
    brief: "Luxury and fashion. Mirror chrome, deep blue night, hard reflections and long highlights.",
    background: "#03040c",
    fog: { color: "#03040c", near: 8, far: 24 },
    accent: "#cfe3ff",
    accent2: "#4c7dff",
    font: { display: "unbounded-800", text: "inter-tight-500", mono: "jetbrains-500" },
    type: { color: "#ffffff", metalness: 1, roughness: 0.06, clearcoat: 1, emissive: "#000000", emissiveIntensity: 0 },
    light: { strips: 6, stripIntensity: 4.5, key: 0.6, rim: "#4c7dff", rimIntensity: 3.5, ambient: 0.04 },
    post: { bloom: 0.9, bloomThreshold: 0.7, aberration: 0.0012, grain: 0.06, vignette: 0.6, bokeh: 4 },
  },
  kinetic: {
    name: "Kinetic",
    brief: "Sport and energy. Matte black, one acid accent, hard cuts, big type that hits like a drum.",
    background: "#0a0a0a",
    fog: null,
    accent: "#d7ff1e",
    accent2: "#ffffff",
    font: { display: "unbounded-800", text: "inter-tight-800", mono: "jetbrains-500" },
    type: { color: "#f4f4f0", metalness: 0.1, roughness: 0.55, clearcoat: 0.2, emissive: "#000000", emissiveIntensity: 0 },
    light: { strips: 2, stripIntensity: 2, key: 2.4, rim: "#d7ff1e", rimIntensity: 3, ambient: 0.25 },
    post: { bloom: 0.35, bloomThreshold: 0.85, aberration: 0.0015, grain: 0.11, vignette: 0.45, bokeh: 0 },
  },
  neon: {
    name: "Neon Tech",
    brief: "Futuristic brand film. Graphite and cyan, glowing lines, HUD, grid floor, light trails, haze.",
    background: "#02060a",
    fog: { color: "#02080e", near: 6, far: 22 },
    accent: "#38f0ff",
    accent2: "#7a5cff",
    font: { display: "unbounded-800", text: "inter-tight-500", mono: "jetbrains-500" },
    type: { color: "#c9f6ff", metalness: 0.8, roughness: 0.3, clearcoat: 0.6, emissive: "#38f0ff", emissiveIntensity: 0.18 },
    light: { strips: 3, stripIntensity: 2.4, key: 0.5, rim: "#38f0ff", rimIntensity: 4, ambient: 0.05 },
    post: { bloom: 1.4, bloomThreshold: 0.45, aberration: 0.002, grain: 0.07, vignette: 0.65, bokeh: 2.5 },
  },
  editorial: {
    name: "Editorial",
    brief: "Film title and storytelling. Serif in warm gold, slow drift, deep shadows, film grain.",
    background: "#0b0806",
    fog: { color: "#0b0806", near: 7, far: 20 },
    accent: "#e8c48a",
    accent2: "#ff9b5c",
    font: { display: "playfair-900", text: "inter-tight-500", mono: "jetbrains-500" },
    type: { color: "#e3c07f", metalness: 0.95, roughness: 0.32, clearcoat: 0.5, emissive: "#000000", emissiveIntensity: 0 },
    light: { strips: 2, stripIntensity: 2.6, key: 1.4, rim: "#ff9b5c", rimIntensity: 2, ambient: 0.06 },
    post: { bloom: 0.6, bloomThreshold: 0.7, aberration: 0.0008, grain: 0.12, vignette: 0.7, bokeh: 3.5 },
  },
} satisfies Record<string, Look>;

export type LookName = keyof typeof LOOKS;
export const lookOf = (name: LookName): Look => LOOKS[name];
