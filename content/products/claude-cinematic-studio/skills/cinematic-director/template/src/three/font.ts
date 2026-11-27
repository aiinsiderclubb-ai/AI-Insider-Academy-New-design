import { useEffect, useState } from "react";
import { TTFLoader } from "three/examples/jsm/loaders/TTFLoader.js";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { FONTS, type FontName } from "../lib/fonts";

const cache = new Map<FontName, Promise<Font>>();
const ready = new Map<FontName, Font>();

function load(name: FontName) {
  let pending = cache.get(name);
  if (!pending) {
    pending = new TTFLoader().loadAsync(FONTS[name]).then((json) => {
      const font = new Font(json as never);
      ready.set(name, font);
      return font;
    });
    cache.set(name, pending);
  }
  return pending;
}

/** The TTF as a three.js Font, or null until it is parsed. Pair with `useRedrawWhenReady`. */
export function useFont(name: FontName) {
  const [font, setFont] = useState<Font | null>(() => ready.get(name) ?? null);
  useEffect(() => {
    if (font) return;
    let alive = true;
    load(name)
      .then((f) => alive && setFont(f))
      .catch((err) => console.error(`Font ${name} failed to load`, err));
    return () => {
      alive = false;
    };
  }, [name, font]);
  return font;
}
