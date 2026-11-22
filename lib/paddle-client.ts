"use client";

/**
 * Paddle.js, loaded once on demand. Paddle sells the order as merchant of
 * record; the API creates the transaction at our price and the browser only
 * opens Paddle's checkout for it.
 *
 * NEXT_PUBLIC_PADDLE_CLIENT_TOKEN — a client-side token (`test_…` in sandbox,
 * `live_…` in production); NEXT_PUBLIC_PADDLE_ENV — `sandbox` or `production`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type PaddleGlobal = any;

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

export interface PaddleEvent {
  name?: string;
  data?: { transaction_id?: string; status?: string } & Record<string, unknown>;
}

const SCRIPT = "https://cdn.paddle.com/paddle/v2/paddle.js";
let ready: Promise<PaddleGlobal> | null = null;
let listener: ((event: PaddleEvent) => void) | null = null;

export function paddleConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN);
}

/** Sets who hears checkout events (completed, closed); the last caller wins. */
export function onPaddleEvent(handler: ((event: PaddleEvent) => void) | null) {
  listener = handler;
}

export function loadPaddle(): Promise<PaddleGlobal> {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) {
      reject(new Error("Paddle client token is not configured"));
      return;
    }
    const init = () => {
      const Paddle = window.Paddle;
      if (!Paddle) {
        reject(new Error("Paddle.js did not load"));
        return;
      }
      if (process.env.NEXT_PUBLIC_PADDLE_ENV !== "production") Paddle.Environment.set("sandbox");
      Paddle.Initialize({ token, eventCallback: (event: PaddleEvent) => listener?.(event) });
      resolve(Paddle);
    };
    if (window.Paddle) {
      init();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = init;
    script.onerror = () => {
      ready = null;
      reject(new Error("Paddle.js did not load"));
    };
    document.head.appendChild(script);
  });
  return ready;
}

const PADDLE_LOCALES: Record<string, string> = { ru: "ru", ukr: "uk", en: "en" };

export async function openPaddleCheckout({
  transactionId,
  successUrl,
  locale,
  email,
}: {
  transactionId: string;
  successUrl?: string;
  locale: string;
  email?: string;
}) {
  const Paddle = await loadPaddle();
  Paddle.Checkout.open({
    transactionId,
    ...(email ? { customer: { email } } : {}),
    settings: {
      displayMode: "overlay",
      locale: PADDLE_LOCALES[locale] ?? "en",
      ...(successUrl ? { successUrl } : {}),
    },
  });
}
