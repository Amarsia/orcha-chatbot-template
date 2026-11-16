import {
  AppConfigurationError,
  getAssistant,
} from "@/lib/orcha-server";
import {
  buildMessagesFromEvents,
  readAllSessionEvents,
} from "@/lib/session-timeline";
import { resolveVisitor, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { sessionId } = await context.params;
  if (!sessionId.startsWith("ses_")) {
    return Response.json({ error: "Invalid conversation ID." }, { status: 400 });
  }

  try {
    const visitor = resolveVisitor(request);
    const assistant = getAssistant();
    const session = await assistant.get(sessionId);
    if (session.metadata.visitorId !== visitor.id) {
      return Response.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    const events = await readAllSessionEvents(assistant, sessionId);
    const messages = await buildMessagesFromEvents(events, visitor.id);

    return Response.json(
      { ...session, messages },
      {
        headers: withVisitorCookie(
          { "Cache-Control": "no-store" },
          visitor.setCookie,
        ),
      },
    );
  } catch (error) {
    const message =
      error instanceof AppConfigurationError
        ? error.message
        : "Conversation could not be loaded.";
    return Response.json(
      { error: message },
      { status: error instanceof AppConfigurationError ? 503 : 404 },
    );
  }
}
