"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const ENDPOINT = "/api/seen";

/**
 * Tells the API which page was opened, once per navigation.
 *
 * No cookie and no id: the API counts unique visitors from a daily-salted hash
 * of the request, so nothing is stored in the browser. The referrer and
 * `utm_source` go with the first page of the visit only — that is the landing,
 * the one a source can be credited for.
 */
export function PageViewBeacon({ locale }: { locale: string }) {
  const pathname = usePathname();
  const landing = useRef(true);

  useEffect(() => {
    if (!pathname || /\/studio(\/|$)/.test(pathname)) return;
    const first = landing.current;
    landing.current = false;
    const body = JSON.stringify({
      path: pathname,
      locale,
      referrer: first ? document.referrer : "",
      utmSource: first ? new URLSearchParams(window.location.search).get("utm_source") ?? "" : "",
    });
    try {
      if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    } catch {
      // Fall through to fetch.
    }
    fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(
      () => {},
    );
  }, [pathname, locale]);

  return null;
}
