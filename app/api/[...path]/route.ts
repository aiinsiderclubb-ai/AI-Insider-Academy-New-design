import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, SESSION_COOKIE } from "@/lib/auth/cookies";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3001";

/** Paths that need the admin token rather than the visitor's. */
const ADMIN_PREFIXES = ["admin/", "governance/", "n8n/"];

/**
 * Same-origin proxy to the Express API.
 *
 * Client components call `/api/...` without ever holding a token: the bearer
 * lives in an httpOnly cookie and is attached here. That keeps the session out
 * of `localStorage`, where the previous client kept it.
 */
async function forward(request: NextRequest, segments: string[]) {
  const path = segments.join("/");
  const search = request.nextUrl.search;
  const target = `${API_ORIGIN}/api/${path}${search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", request.headers.get("accept") ?? "application/json");

  const useAdmin = ADMIN_PREFIXES.some((prefix) => path.startsWith(prefix));
  const token = request.cookies.get(useAdmin ? ADMIN_COOKIE : SESSION_COOKIE)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(target, { method, headers, body, cache: "no-store", redirect: "manual" });
  } catch {
    return NextResponse.json({ error: "Upstream unavailable", code: "network" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) responseHeaders.set("content-type", upstreamType);
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) responseHeaders.set("content-disposition", disposition);
  const location = upstream.headers.get("location");
  if (location) responseHeaders.set("location", location);

  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
