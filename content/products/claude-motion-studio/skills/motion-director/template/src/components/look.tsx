import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useDelayRender } from "remotion";
import { loadStyleFonts, type StyleFonts } from "../styles/fonts";
import { getStyle, type Style } from "../styles/styles";

/**
 * The style and its loaded fonts, available to every component below a
 * composition. Components read colours and type from here instead of taking
 * them as props, so switching `style` in a composition's props restyles all
 * of it at once.
 */
type Look = { style: Style; fonts: StyleFonts };

const LookContext = createContext<Look | null>(null);

export function LookProvider({ styleId, children }: { styleId?: string; children: React.ReactNode }) {
  const style = getStyle(styleId);
  const { fonts, ready } = useMemo(() => loadStyleFonts(style), [style]);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading fonts for style "${style.id}"`));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    ready.then(() => {
      setLoaded(true);
      continueRender(handle);
    }, cancelRender);
  }, [ready, handle, continueRender, cancelRender]);
  // Nothing is drawn until the faces are in: text fitted to a fallback font
  // would be the wrong size in the final frame.
  if (!loaded) return null;
  return <LookContext.Provider value={{ style, fonts }}>{children}</LookContext.Provider>;
}

export function useLook(): Look {
  const look = useContext(LookContext);
  if (!look) throw new Error("Wrap the composition in <LookProvider>.");
  return look;
}

/** CSS for the display face of the current style. */
export function useDisplayType(): React.CSSProperties {
  const { style, fonts } = useLook();
  const role = style.fonts.display;
  return {
    fontFamily: fonts.display,
    fontWeight: role.weight,
    letterSpacing: `${role.tracking}em`,
    lineHeight: role.leading,
    fontStyle: role.italic ? "italic" : "normal",
    textTransform: role.uppercase ? "uppercase" : "none",
    color: style.colors.ink,
    // Print styles: a second ink slightly off register, like a two-colour press.
    textShadow: style.texture.misregister ? `${style.texture.misregister}px ${style.texture.misregister * 0.6}px 0 ${style.colors.accent}` : undefined,
  };
}

export function useMonoType(): React.CSSProperties {
  const { style, fonts } = useLook();
  return {
    fontFamily: fonts.mono,
    fontWeight: style.fonts.mono.weight,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: style.colors.muted,
    fontVariantNumeric: "tabular-nums",
  };
}

export function useTextType(): React.CSSProperties {
  const { style, fonts } = useLook();
  const role = style.fonts.text;
  return {
    fontFamily: fonts.text,
    fontWeight: role.weight,
    letterSpacing: `${role.tracking}em`,
    lineHeight: role.leading,
    color: style.colors.ink,
  };
}
