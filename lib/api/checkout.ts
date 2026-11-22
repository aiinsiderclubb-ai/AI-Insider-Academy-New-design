import "server-only";
import { cache } from "react";
import { tryApi } from "./http";
import { getFeatureFlags } from "./public";

export type ProviderId = "paddle" | "gumroad" | "stripe" | "liqpay" | "tribute" | "demo";

export interface CheckoutStatus {
  /** Sales are globally paused until launch. */
  prelaunch: boolean;
  providers: ProviderId[];
}

/**
 * Availability is resolved before the user picks anything, so a closed till is
 * shown on the product card — never as a failure on the last step.
 */
export const getCheckoutStatus = cache(async (): Promise<CheckoutStatus> => {
  const [tribute, paddle, gumroad, flags] = await Promise.all([
    tryApi<{ enabled?: boolean; prelaunch?: boolean }>("/payments/tribute/status", { revalidate: 30 }, {}),
    tryApi<{ enabled?: boolean; prelaunch?: boolean }>("/payments/paddle/status", { revalidate: 30 }, {}),
    tryApi<{ enabled?: boolean; prelaunch?: boolean }>("/payments/gumroad/status", { revalidate: 30 }, {}),
    getFeatureFlags(),
  ]);

  const prelaunch = Boolean(tribute.prelaunch || paddle.prelaunch || gumroad.prelaunch);
  if (prelaunch) return { prelaunch, providers: [] };

  // Paddle is the till once it is configured on both sides: the API holds the
  // key, the site the client token. It sells every item, so the others step aside.
  if (paddle.enabled && process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) {
    return { prelaunch, providers: flags.demoPurchases ? ["paddle", "demo"] : ["paddle"] };
  }

  // Gumroad likewise, once the API holds its access token: the buyer pays on
  // Gumroad's checkout and the ping opens access.
  if (gumroad.enabled) {
    return { prelaunch, providers: flags.demoPurchases ? ["gumroad", "demo"] : ["gumroad"] };
  }

  const providers: ProviderId[] = [];
  if (flags.stripe !== false) providers.push("stripe");
  if (flags.liqpay !== false) providers.push("liqpay");
  if (tribute.enabled) providers.push("tribute");
  if (flags.demoPurchases) providers.push("demo");

  return { prelaunch, providers };
});
