import "server-only";
import { unstable_rethrow } from "next/navigation";
import { readAdminToken, readSessionToken } from "@/lib/auth/cookies";

export const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Russian copy supplied by the API, when it has one. */
    readonly messageRu?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Options = {
  /** Attach the visitor's bearer token — required for anything under /me. */
  auth?: boolean;
  /** Attach the admin bearer token instead. */
  admin?: boolean;
  /** Seconds; `false` opts out of the data cache entirely. */
  revalidate?: number | false;
  tags?: string[];
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Return `null` instead of throwing when the API answers 401/403/404. */
  soft?: boolean;
};

/**
 * Server-side call into the existing Express API.
 *
 * Every response passes through here, so a raw provider string can never reach
 * a screen: failures become `ApiError` with a stable code that the UI maps to
 * its own localised copy.
 */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { auth = false, admin = false, revalidate, tags, method = "GET", body, soft = false } = options;

  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";

  if (admin) {
    const token = await readAdminToken();
    if (!token) {
      if (soft) return null as T;
      throw new ApiError(401, "no_admin_session", "Admin session missing");
    }
    headers.authorization = `Bearer ${token}`;
  } else if (auth) {
    const token = await readSessionToken();
    if (!token) {
      if (soft) return null as T;
      throw new ApiError(401, "no_session", "Session missing");
    }
    headers.authorization = `Bearer ${token}`;
  }

  const cache =
    revalidate === false || auth || admin || method !== "GET"
      ? { cache: "no-store" as const }
      : { next: { revalidate: revalidate ?? 300, tags } };

  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      ...cache,
    });
  } catch {
    if (soft) return null as T;
    throw new ApiError(0, "network", `Cannot reach the API at ${API_ORIGIN}`);
  }

  if (!response.ok) {
    if (soft && [401, 403, 404, 423].includes(response.status)) return null as T;
    const payload = (await safeJson(response)) as Record<string, unknown> | null;
    const code = String(payload?.code ?? `http_${response.status}`);
    const message = String(payload?.error ?? response.statusText ?? "Request failed");
    const messageRu = typeof payload?.errorRu === "string" ? payload.errorRu : undefined;
    throw new ApiError(response.status, code, message, messageRu);
  }

  if (response.status === 204) return undefined as T;
  return (await safeJson(response)) as T;
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 200) };
  }
}

/**
 * Never let one slow or broken panel take the whole page down.
 *
 * The fallback is returned, but the failure is not swallowed: a degraded panel
 * looks exactly like an empty one on screen, so without this line a dead
 * backend reaches production as "the dashboard is blank" and nothing else.
 *
 * A missing session is not a failure — `soft` requests answer `null` for
 * 401/403/404 by design, and those never reach the catch.
 */
export async function tryApi<T>(path: string, options: Options = {}, fallback: T): Promise<T> {
  try {
    const value = await api<T>(path, options);
    return value ?? fallback;
  } catch (error) {
    // `notFound()`, `redirect()` and the request-time bailout that `cookies()`
    // throws while a route is being probed for static rendering are all
    // control flow, not failures. Swallowing them here would strand a route
    // on fallback data and print a scary line for a healthy build.
    unstable_rethrow(error);
    reportApiFailure(path, options, error);
    return fallback;
  }
}

/**
 * Where a swallowed failure goes.
 *
 * `console.error` on the server is picked up by every host's log drain, which
 * is the point — one line, one path, one reason. Swap the body for the
 * project's error reporter when there is one; the call sites do not change.
 */
function reportApiFailure(path: string, options: Options, error: unknown): void {
  const method = options.method ?? "GET";
  const detail =
    error instanceof ApiError
      ? `${error.status || "network"} ${error.code}: ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error);

  console.error(`[api] ${method} ${path} failed, serving fallback — ${detail}`);
}
