import { NextResponse } from "next/server";
import { archiveName, downloadablesFor, fileBytes } from "@/content/downloadables";
import { getProduct } from "@/lib/api/store";
import { getAccess } from "@/lib/api/session";
import { zip } from "@/lib/zip";

export async function GET(_request: Request, context: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await context.params;
  const name = decodeURIComponent(file);
  const files = downloadablesFor(slug);
  const wantsArchive = name === archiveName(slug);
  const found = files.find((item) => item.filename === name);
  if (!found && !wantsArchive) return new NextResponse("Not found", { status: 404 });

  const [access, record] = await Promise.all([getAccess(), getProduct(slug, "ru")]);
  if (!record || !access.productIds.has(record.product.id)) {
    return NextResponse.json(
      { error: "Purchase required" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (!found) {
    const archive = zip(files.map((item) => ({ name: `${slug}/${item.filename}`, data: fileBytes(item) })));
    return new NextResponse(new Uint8Array(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return new NextResponse(new Uint8Array(fileBytes(found)), {
    headers: {
      "Content-Type": `${found.mime}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${found.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
