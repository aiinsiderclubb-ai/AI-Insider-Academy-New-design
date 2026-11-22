"use client";

/**
 * Runs before first paint on a full page load, hence inline:
 *
 * 1. drops `no-js`, which is what keeps scroll-reveal elements visible when
 *    scripting never arrives — without it a failed hydration leaves the page
 *    blank at `opacity: 0`;
 * 2. applies the stored theme, so a light-mode visitor never sees a dark
 *    flash, and moves the `theme-color` tag with it.
 *
 * On the server the tag is a real script, so the browser runs it while parsing
 * the HTML. On the client it is `text/plain`: React never executes a script it
 * renders itself, and marking it plain stops the dev overlay from treating that
 * as an error. The copy already ran from the server HTML.
 */
const themeBootstrap = `(function(){var d=document.documentElement;d.classList.remove("no-js");try{var t=localStorage.getItem("aia-theme");if(t==="dark"||t==="light"){d.setAttribute("data-theme",t);if(t==="light"){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#f4f2ee")}}}catch(e){}})()`;

export function ThemeBootstrap() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeBootstrap }}
    />
  );
}
