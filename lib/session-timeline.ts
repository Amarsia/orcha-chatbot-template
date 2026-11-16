import "server-only";

import type { AgentRuntime, SessionEvent } from "orchajs";

import type { ChatActivity, ChatAttachment, ChatMessage } from "@/lib/chat-types";
import { attachmentFromStoredFilePath } from "@/lib/uploads";

export async function readAllSessionEvents(
  assistant: AgentRuntime,
  sessionId: string,
): Promise<SessionEvent[]> {
  const events: SessionEvent[] = [];
  let page = 1;
  let throughSequence: number | undefined;

  while (true) {
    const res = await assistant.events(sessionId, {
      page,
      pageSize: 100,
      ...(throughSequence !== undefined ? { throughSequence } : {}),
    });
    if (throughSequence === undefined) {
      throughSequence = res.throughSequence;
    }
    events.push(...res.events);
    if (!res.hasMore || res.events.length === 0) break;
    page += 1;
  }

  return events;
}

function mergeDefined<T extends Record<string, unknown>>(prev: T, next: T): T {
  const merged: Record<string, unknown> = { ...prev };
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as T;
}

function upsertActivity(list: ChatActivity[], next: ChatActivity): void {
  const idx = list.findIndex((item) => item.id === next.id);
  if (idx >= 0) {
    list[idx] = mergeDefined(list[idx], next);
  } else {
    list.push(next);
  }
}

export function applyEventToActivities(
  activities: ChatActivity[],
  event: SessionEvent,
): void {
  const data = (event.data ?? {}) as Record<string, unknown>;

  if (event.type === "message.created" && data.role === "assistant") {
    const blocks = Array.isArray(data.content) ? data.content : [];
    blocks.forEach((rawBlock, index) => {
      if (!rawBlock || typeof rawBlock !== "object") return;
      const block = rawBlock as Record<string, unknown>;
      if (
        block.type === "reasoning" &&
        typeof block.text === "string" &&
        block.text.trim()
      ) {
        upsertActivity(activities, {
          id: `reasoning-${event.sequence}-${index}`,
          kind: "reasoning",
          text: block.text,
          status: "completed",
          createdAt: event.timestamp,
        });
      }
    });
    return;
  }

  if (event.type === "action.requested") {
    const callId = String(data.callId ?? event.sequence);
    upsertActivity(activities, {
      id: `action-${callId}`,
      kind: "action",
      callId,
      name: String(data.name ?? "action"),
      status: "running",
      arguments:
        typeof data.arguments === "object" && data.arguments !== null
          ? (data.arguments as Record<string, unknown>)
          : undefined,
      createdAt: event.timestamp,
    });
    return;
  }

  if (event.type === "action.completed") {
    const callId = String(data.callId ?? event.sequence);
    upsertActivity(activities, {
      id: `action-${callId}`,
      kind: "action",
      callId,
      name: String(data.name ?? "action"),
      status: "completed",
      output: data.output,
      durationMs: typeof data.durationMs === "number" ? data.durationMs : undefined,
      createdAt: event.timestamp,
    });
    return;
  }

  if (event.type === "action.failed") {
    const callId = String(data.callId ?? event.sequence);
    const errObj = data.error as { message?: unknown } | undefined;
    upsertActivity(activities, {
      id: `action-${callId}`,
      kind: "action",
      callId,
      name: String(data.name ?? "action"),
      status: "failed",
      error: typeof errObj?.message === "string" ? errObj.message : "Action failed.",
      durationMs: typeof data.durationMs === "number" ? data.durationMs : undefined,
      createdAt: event.timestamp,
    });
    return;
  }

  if (event.type === "subagent.initiated" || event.type === "subagent.resumed") {
    const callId = String(data.callId ?? event.sequence);
    upsertActivity(activities, {
      id: `subagent-${callId}`,
      kind: "subagent",
      callId,
      agent: String(data.agent ?? "subagent"),
      childSessionId: String(data.sessionId ?? ""),
      status: "running",
      createdAt: event.timestamp,
    });
    return;
  }

  if (
    event.type === "subagent.completed" ||
    event.type === "subagent.paused" ||
    event.type === "subagent.failed"
  ) {
    const callId = String(data.callId ?? event.sequence);
    const rawStatus = String(data.status ?? "");
    const status =
      event.type === "subagent.failed" || rawStatus === "failed"
        ? "failed"
        : rawStatus === "waiting_for_client_action"
          ? "waiting"
          : event.type === "subagent.paused" || rawStatus === "paused"
            ? "paused"
            : "completed";
    const errObj = data.error as { message?: unknown } | undefined;
    upsertActivity(activities, {
      id: `subagent-${callId}`,
      kind: "subagent",
      callId,
      agent: String(data.agent ?? "subagent"),
      childSessionId: String(data.sessionId ?? ""),
      status,
      output: data.output,
      error: typeof errObj?.message === "string" ? errObj.message : undefined,
      createdAt: event.timestamp,
    });
    return;
  }

  if (event.type === "skill.requested") {
    const callId = String(data.callId ?? event.sequence);
    upsertActivity(activities, {
      id: `skill-${callId}`,
      kind: "skill",
      callId,
      name: String(data.name ?? "skill"),
      status: "running",
      createdAt: event.timestamp,
    });
    return;
  }

  if (event.type === "skill.loaded") {
    const callId = String(data.callId ?? event.sequence);
    upsertActivity(activities, {
      id: `skill-${callId}`,
      kind: "skill",
      callId,
      name: String(data.name ?? "skill"),
      status: "completed",
      createdAt: event.timestamp,
    });
    return;
  }

  if (event.type === "skill.failed") {
    const callId = String(data.callId ?? event.sequence);
    const errObj = data.error as { message?: unknown } | undefined;
    upsertActivity(activities, {
      id: `skill-${callId}`,
      kind: "skill",
      callId,
      name: String(data.name ?? "skill"),
      status: "failed",
      error: typeof errObj?.message === "string" ? errObj.message : "Skill not found.",
      createdAt: event.timestamp,
    });
  }
}

export function extractActivitiesFromEvents(events: SessionEvent[]): ChatActivity[] {
  const activities: ChatActivity[] = [];
  for (const event of events) {
    applyEventToActivities(activities, event);
  }
  return activities;
}

export async function buildMessagesFromEvents(
  events: SessionEvent[],
  visitorId: string,
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [];
  let activeAssistant: ChatMessage | null = null;

  const ensureAssistant = (timestamp: string, seedId: string): ChatMessage => {
    if (!activeAssistant) {
      activeAssistant = {
        id: seedId,
        role: "assistant",
        content: "",
        activities: [],
        createdAt: timestamp,
      };
      messages.push(activeAssistant);
    }
    if (!activeAssistant.activities) {
      activeAssistant.activities = [];
    }
    return activeAssistant;
  };

  for (const event of events) {
    const data = (event.data ?? {}) as Record<string, unknown>;

    if (event.type === "message.created" && data.role === "user") {
      activeAssistant = null;
      const parts = Array.isArray(data.content) ? data.content : [];
      const textParts: string[] = [];
      const attachments: ChatAttachment[] = [];

      for (const rawPart of parts) {
        if (!rawPart || typeof rawPart !== "object") continue;
        const part = rawPart as Record<string, unknown>;
        if (part.type === "text" && typeof part.text === "string") {
          textParts.push(part.text);
        } else if (part.type === "file" && typeof part.filePath === "string") {
          attachments.push(
            await attachmentFromStoredFilePath(
              visitorId,
              part.filePath,
              typeof part.mimeType === "string"
                ? part.mimeType
                : "application/octet-stream",
            ),
          );
        } else if (
          (part.type === "image" || part.type === "url") &&
          typeof part.fileUri === "string"
        ) {
          attachments.push({
            name: part.fileUri.split("/").pop() || "Attachment",
            mimeType:
              typeof part.mimeType === "string"
                ? part.mimeType
                : "application/octet-stream",
            url: part.fileUri,
          });
        }
      }

      messages.push({
        id: `msg-${event.sequence}`,
        role: "user",
        content: textParts.join("\n"),
        ...(attachments.length > 0 ? { attachments } : {}),
        createdAt: event.timestamp,
      });
      continue;
    }

    if (event.type === "message.created" && data.role === "assistant") {
      const target = ensureAssistant(event.timestamp, `msg-${event.sequence}`);
      applyEventToActivities(target.activities!, event);

      const blocks = Array.isArray(data.content) ? data.content : [];
      const textChunks: string[] = [];
      for (const rawBlock of blocks) {
        if (!rawBlock || typeof rawBlock !== "object") continue;
        const block = rawBlock as Record<string, unknown>;
        if (block.type === "text" && typeof block.text === "string") {
          textChunks.push(block.text);
        }
      }

      const nextText = textChunks.join("");
      if (nextText) {
        target.content = target.content ? `${target.content}\n\n${nextText}` : nextText;
      }
      target.createdAt = event.timestamp;
      continue;
    }

    if (
      event.type === "action.requested" ||
      event.type === "action.completed" ||
      event.type === "action.failed" ||
      event.type === "subagent.initiated" ||
      event.type === "subagent.resumed" ||
      event.type === "subagent.completed" ||
      event.type === "subagent.paused" ||
      event.type === "subagent.failed" ||
      event.type === "skill.requested" ||
      event.type === "skill.loaded" ||
      event.type === "skill.failed"
    ) {
      const target = ensureAssistant(event.timestamp, `msg-${event.sequence}`);
      applyEventToActivities(target.activities!, event);
    }
  }

  return messages.map((msg) => {
    if (msg.activities && msg.activities.length === 0) {
      const { activities: _omit, ...rest } = msg;
      return rest;
    }
    return msg;
  });
}
