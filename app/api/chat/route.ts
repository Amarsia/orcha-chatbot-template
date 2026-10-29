import { appConfig } from "@/config/app";
import {
  AppConfigurationError,
  getAssistant,
} from "@/lib/orcha-server";
import { resolveVisitor, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ChatRequest = {
  message?: unknown;
  sessionId?: unknown;
};

const encoder = new TextEncoder();

function ndjson(value: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(value)}\n`);
}

function sessionName(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length > 52
    ? `${normalized.slice(0, 49).trimEnd()}…`
    : normalized;
}

export async function POST(request: Request): Promise<Response> {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const currentSessionId =
    typeof body.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim()
      : undefined;

  if (!message) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }
  if (message.length > 20_000) {
    return Response.json(
      { error: "Message must be 20,000 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const assistant = getAssistant();
    const visitor = resolveVisitor(request);
    if (currentSessionId) {
      const session = await assistant.get(currentSessionId);
      if (session.metadata.visitorId !== visitor.id) {
        return Response.json(
          { error: "Conversation not found." },
          { status: 404 },
        );
      }
    }
    const execution = currentSessionId
      ? assistant.resume(currentSessionId, { content: message })
      : assistant.run({
          content: message,
          name: sessionName(message) || appConfig.name,
          metadata: { visitorId: visitor.id },
        });

    let clientClosed = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (value: unknown) => {
          if (!clientClosed) controller.enqueue(ndjson(value));
        };

        write({
            type: "session",
            sessionId: execution.sessionId,
        });

        void (async () => {
          try {
            for await (const snapshot of execution.stream) {
              write({ type: "snapshot", snapshot });
            }

            const result = await execution.result;
            write({ type: "result", result });
          } catch (error) {
            write({
              type: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "The assistant could not complete this response.",
            });
          } finally {
            if (!clientClosed) controller.close();
          }
        })();
      },
      cancel() {
        clientClosed = true;
      },
    });

    return new Response(stream, {
      headers: withVisitorCookie(
        {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
        visitor.setCookie,
      ),
    });
  } catch (error) {
    const message =
      error instanceof AppConfigurationError
        ? error.message
        : "The assistant could not be started.";
    return Response.json(
      { error: message },
      { status: error instanceof AppConfigurationError ? 503 : 500 },
    );
  }
}
