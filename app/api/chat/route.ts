import type { AgentContentInput, MessageContentInput } from "orchajs";

import { appConfig } from "@/config/app";
import {
  AppConfigurationError,
  getAssistant,
} from "@/lib/orcha-server";
import {
  extractActivitiesFromEvents,
  readAllSessionEvents,
} from "@/lib/session-timeline";
import { resolveVisitorUpload, UploadError } from "@/lib/uploads";
import { resolveVisitor, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type AttachmentInput = { id?: unknown };

type ChatRequest = {
  message?: unknown;
  sessionId?: unknown;
  attachments?: unknown;
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
  const rawAttachments = Array.isArray(body.attachments)
    ? (body.attachments as AttachmentInput[])
    : [];

  if (message.length > 20_000) {
    return Response.json(
      { error: "Message must be 20,000 characters or fewer." },
      { status: 400 },
    );
  }
  if (rawAttachments.length > 10) {
    return Response.json(
      { error: "At most 10 attachments can be sent per message." },
      { status: 400 },
    );
  }
  if (!message && rawAttachments.length === 0) {
    return Response.json(
      { error: "Please enter a message or attach a file." },
      { status: 400 },
    );
  }

  try {
    const visitor = resolveVisitor(request);
    const contentItems: MessageContentInput[] = [];
    let firstFileName = "";

    for (const item of rawAttachments) {
      const id = typeof item?.id === "string" ? item.id.trim() : "";
      if (!id) {
        return Response.json({ error: "Invalid attachment reference." }, { status: 400 });
      }
      const { meta, filePath } = await resolveVisitorUpload(visitor.id, id);
      if (!firstFileName) firstFileName = meta.name;
      contentItems.push({
        type: "file",
        filePath,
        mimeType: meta.mimeType,
      });
    }

    if (message) {
      contentItems.push({ type: "text", text: message });
    }

    const content: AgentContentInput =
      rawAttachments.length === 0 && message ? message : contentItems;

    const assistant = getAssistant();
    let baselineSequence = 0;
    if (currentSessionId) {
      const session = await assistant.get(currentSessionId);
      if (session.metadata.visitorId !== visitor.id) {
        return Response.json(
          { error: "Conversation not found." },
          { status: 404 },
        );
      }
      const prior = await assistant.events(currentSessionId, { page: 1, pageSize: 1 });
      baselineSequence = prior.throughSequence;
    }

    const titleSource = message || (firstFileName ? `Attachment: ${firstFileName}` : appConfig.name);
    const execution = currentSessionId
      ? assistant.resume(currentSessionId, { content })
      : assistant.run({
          content,
          name: sessionName(titleSource) || appConfig.name,
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

        let lastActivitiesJson = "";
        let syncing = false;
        const syncActivities = async () => {
          if (clientClosed || syncing) return;
          syncing = true;
          try {
            const allEvents = await readAllSessionEvents(assistant, execution.sessionId);
            const runEvents = allEvents.filter((event) => event.sequence > baselineSequence);
            const activities = extractActivitiesFromEvents(runEvents);
            const serialized = JSON.stringify(activities);
            if (activities.length > 0 && serialized !== lastActivitiesJson) {
              lastActivitiesJson = serialized;
              write({ type: "activities", activities });
            }
          } catch {
            // Session may not have persisted its first events yet
          } finally {
            syncing = false;
          }
        };

        const pollTimer = setInterval(() => {
          void syncActivities();
        }, 300);

        void (async () => {
          try {
            for await (const snapshot of execution.stream) {
              write({ type: "snapshot", snapshot });
              if (
                snapshot &&
                typeof snapshot === "object" &&
                "status" in snapshot &&
                snapshot.status === "waiting_for_subagent"
              ) {
                void syncActivities();
              }
            }

            const result = await execution.result;
            clearInterval(pollTimer);
            await syncActivities();
            write({ type: "result", result });
          } catch (error) {
            clearInterval(pollTimer);
            await syncActivities();
            write({
              type: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "The assistant could not complete this response.",
            });
          } finally {
            clearInterval(pollTimer);
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
    if (error instanceof UploadError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const errMsg =
      error instanceof AppConfigurationError
        ? error.message
        : "The assistant could not be started.";
    return Response.json(
      { error: errMsg },
      { status: error instanceof AppConfigurationError ? 503 : 500 },
    );
  }
}
