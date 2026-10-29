import {
  AppConfigurationError,
  getAssistant,
} from "@/lib/orcha-server";
import { resolveVisitor, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const visitor = resolveVisitor(request);
    const sessions = await getAssistant().list({
      page: 1,
      pageSize: 100,
      metadata: { visitorId: visitor.id },
    });
    return Response.json(sessions, {
      headers: withVisitorCookie(
        { "Cache-Control": "no-store" },
        visitor.setCookie,
      ),
    });
  } catch (error) {
    const message =
      error instanceof AppConfigurationError
        ? error.message
        : "Conversations could not be loaded.";
    return Response.json(
      { error: message },
      { status: error instanceof AppConfigurationError ? 503 : 500 },
    );
  }
}
