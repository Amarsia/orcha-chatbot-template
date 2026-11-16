export type ChatAttachment = {
  id?: string;
  name: string;
  mimeType: string;
  url?: string;
};

export type ActivityStatus = "running" | "completed" | "failed" | "paused" | "waiting";

export type ChatActivity =
  | {
      id: string;
      kind: "reasoning";
      text: string;
      status: "running" | "completed";
      createdAt: string;
    }
  | {
      id: string;
      kind: "action";
      callId: string;
      name: string;
      status: ActivityStatus;
      arguments?: Record<string, unknown>;
      output?: unknown;
      error?: string;
      durationMs?: number;
      createdAt: string;
    }
  | {
      id: string;
      kind: "subagent";
      callId: string;
      agent: string;
      childSessionId: string;
      status: ActivityStatus;
      output?: unknown;
      error?: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "skill";
      callId: string;
      name: string;
      status: ActivityStatus;
      error?: string;
      createdAt: string;
    };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  activities?: ChatActivity[];
  createdAt: string;
  pending?: boolean;
};

export type SessionSummary = {
  sessionId: string;
  name?: string;
  status: "active" | "paused" | "completed";
  createdAt: string;
  updatedAt: string;
};

type HistoryContentPart = {
  type?: unknown;
  text?: unknown;
};

export function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part !== "object" || part === null) return "";
      const candidate = part as HistoryContentPart;
      return candidate.type === "text" && typeof candidate.text === "string"
        ? candidate.text
        : "";
    })
    .filter(Boolean)
    .join("\n");
}
