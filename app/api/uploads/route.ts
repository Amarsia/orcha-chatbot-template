import { saveVisitorUpload, UploadError } from "@/lib/uploads";
import { resolveVisitor, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const visitor = resolveVisitor(request);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Expected multipart/form-data request." },
      { status: 400, headers: withVisitorCookie(undefined, visitor.setCookie) },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "No file provided." },
      { status: 400, headers: withVisitorCookie(undefined, visitor.setCookie) },
    );
  }

  try {
    const meta = await saveVisitorUpload(visitor.id, file);
    return Response.json(
      {
        id: meta.id,
        name: meta.name,
        mimeType: meta.mimeType,
        size: meta.size,
        url: `/api/uploads/${encodeURIComponent(meta.id)}`,
      },
      { headers: withVisitorCookie(undefined, visitor.setCookie) },
    );
  } catch (error) {
    const status = error instanceof UploadError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Could not upload file.";
    return Response.json(
      { error: message },
      { status, headers: withVisitorCookie(undefined, visitor.setCookie) },
    );
  }
}
