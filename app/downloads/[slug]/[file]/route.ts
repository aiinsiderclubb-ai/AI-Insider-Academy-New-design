import { NextResponse } from "next/server";
import { downloadablesFor } from "@/content/downloadables";

export async function GET(_request: Request, context: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await context.params;
  const name = decodeURIComponent(file);
  const found = downloadablesFor(slug).find((item) => item.filename === name);
  if (!found) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(found.body, {
    headers: {
      "Content-Type": `${found.mime}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${found.filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
