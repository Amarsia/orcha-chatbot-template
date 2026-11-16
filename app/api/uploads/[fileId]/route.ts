import { readFile } from "node:fs/promises";

import { resolveVisitorUpload, UploadError } from "@/lib/uploads";
import { resolveVisitor, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
): Promise<Response> {
  const { fileId } = await params;
  const visitor = resolveVisitor(request);

  try {
    const { meta, filePath } = await resolveVisitorUpload(visitor.id, fileId);
    const bytes = await readFile(filePath);
    const encodedName = encodeURIComponent(meta.name);
    const headers = withVisitorCookie(
      {
        "Content-Type": meta.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
      visitor.setCookie,
    );
    return new Response(bytes, { headers });
  } catch (error) {
    const status = error instanceof UploadError ? error.status : 404;
    const message = error instanceof Error ? error.message : "Attachment not found.";
    return Response.json(
      { error: message },
      { status, headers: withVisitorCookie(undefined, visitor.setCookie) },
    );
  }
}
