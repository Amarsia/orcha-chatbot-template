"use client";

import {
  AlertCircle,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { appConfig } from "@/config/app";
import type {
  ChatActivity,
  ChatAttachment,
  ChatMessage as ChatMessageValue,
} from "@/lib/chat-types";

function formatName(name: string): string {
  return name.replace(/[_-]+/g, " ");
}

function formatJson(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ActivityStep({ activity }: { activity: ChatActivity }) {
  const [expanded, setExpanded] = useState(false);

  if (activity.kind === "reasoning") {
    return (
      <div className="step-item">
        <button
          type="button"
          className="step-trigger"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          <Brain className="step-icon" />
          <span className="step-label">Thought process</span>
          {expanded ? (
            <ChevronDown className="step-chevron" />
          ) : (
            <ChevronRight className="step-chevron" />
          )}
        </button>
        {expanded ? (
          <div className="step-detail step-detail-text">{activity.text}</div>
        ) : null}
      </div>
    );
  }

  if (activity.kind === "action") {
    const hasDetails =
      activity.arguments !== undefined ||
      activity.output !== undefined ||
      activity.error !== undefined;

    return (
      <div className="step-item" data-status={activity.status}>
        <button
          type="button"
          className="step-trigger"
          onClick={() => hasDetails && setExpanded((current) => !current)}
          disabled={!hasDetails}
          aria-expanded={hasDetails ? expanded : undefined}
        >
          {activity.status === "running" ? (
            <Loader2 className="step-icon animate-spin" />
          ) : activity.status === "failed" ? (
            <AlertCircle className="step-icon step-icon-error" />
          ) : (
            <Wrench className="step-icon" />
          )}
          <span className="step-label">
            {activity.status === "running" ? "Running " : ""}
            <span className="capitalize">{formatName(activity.name)}</span>
          </span>
          {typeof activity.durationMs === "number" ? (
            <span className="step-duration">{activity.durationMs}ms</span>
          ) : null}
          {activity.status === "completed" ? (
            <Check className="step-check" />
          ) : null}
          {hasDetails ? (
            expanded ? (
              <ChevronDown className="step-chevron" />
            ) : (
              <ChevronRight className="step-chevron" />
            )
          ) : null}
        </button>
        {expanded && hasDetails ? (
          <div className="step-detail">
            {activity.arguments !== undefined ? (
              <div className="step-kv">
                <span>Input</span>
                <pre>{formatJson(activity.arguments)}</pre>
              </div>
            ) : null}
            {activity.output !== undefined ? (
              <div className="step-kv">
                <span>Output</span>
                <pre>{formatJson(activity.output)}</pre>
              </div>
            ) : null}
            {activity.error ? (
              <div className="step-error">{activity.error}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (activity.kind === "subagent") {
    const hasDetails =
      activity.output !== undefined ||
      activity.error !== undefined ||
      Boolean(activity.childSessionId);

    return (
      <div className="step-item" data-status={activity.status}>
        <button
          type="button"
          className="step-trigger"
          onClick={() => hasDetails && setExpanded((current) => !current)}
          disabled={!hasDetails}
          aria-expanded={hasDetails ? expanded : undefined}
        >
          {activity.status === "running" ? (
            <Loader2 className="step-icon animate-spin" />
          ) : activity.status === "failed" ? (
            <AlertCircle className="step-icon step-icon-error" />
          ) : (
            <Bot className="step-icon" />
          )}
          <span className="step-label">
            Subagent <span className="capitalize">{formatName(activity.agent)}</span>
            <span className="step-duration"> · {activity.status}</span>
          </span>
          {activity.status === "completed" ? (
            <Check className="step-check" />
          ) : null}
          {hasDetails ? (
            expanded ? (
              <ChevronDown className="step-chevron" />
            ) : (
              <ChevronRight className="step-chevron" />
            )
          ) : null}
        </button>
        {expanded && hasDetails ? (
          <div className="step-detail">
            {activity.childSessionId ? (
              <div className="step-kv">
                <span>Session</span>
                <pre>{activity.childSessionId}</pre>
              </div>
            ) : null}
            {activity.output !== undefined ? (
              <div className="step-kv">
                <span>Output</span>
                <pre>{formatJson(activity.output)}</pre>
              </div>
            ) : null}
            {activity.error ? (
              <div className="step-error">{activity.error}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="step-item" data-status={activity.status}>
      <div className="step-trigger">
        {activity.status === "running" ? (
          <Loader2 className="step-icon animate-spin" />
        ) : (
          <Sparkles className="step-icon" />
        )}
        <span className="step-label">
          Loaded skill <span className="capitalize">{formatName(activity.name)}</span>
        </span>
      </div>
    </div>
  );
}

function ActivityGroup({
  activities,
  isPending,
}: {
  activities: ChatActivity[];
  isPending?: boolean;
}) {
  const [groupOpen, setGroupOpen] = useState(false);

  const runningItem = activities.find((item) => item.status === "running");
  const isOpen = Boolean(runningItem) || groupOpen;

  const summaryText = runningItem
    ? runningItem.kind === "action"
      ? `Running ${formatName(runningItem.name)}…`
      : runningItem.kind === "subagent"
        ? `Running ${formatName(runningItem.agent)}…`
        : runningItem.kind === "skill"
          ? `Loading ${formatName(runningItem.name)}…`
          : "Thinking…"
    : activities.length === 1
      ? activities[0].kind === "reasoning"
        ? "Thought process"
        : activities[0].kind === "action"
          ? `Used ${formatName(activities[0].name)}`
          : activities[0].kind === "subagent"
            ? `Subagent ${formatName(activities[0].agent)}`
            : `Skill ${formatName(activities[0].name)}`
      : `${activities.length} steps`;

  return (
    <div className="steps-block">
      <button
        type="button"
        className="steps-summary"
        onClick={() => setGroupOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        {isPending && runningItem ? (
          <Loader2 className="step-icon animate-spin" />
        ) : null}
        <span>{summaryText}</span>
        {isOpen ? (
          <ChevronDown className="step-chevron" />
        ) : (
          <ChevronRight className="step-chevron" />
        )}
      </button>

      {isOpen ? (
        <div className="steps-timeline">
          {activities.map((activity) => (
            <ActivityStep key={activity.id} activity={activity} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Attachments({
  attachments,
  align,
}: {
  attachments: ChatAttachment[];
  align: "end" | "start";
}) {
  if (attachments.length === 0) return null;

  return (
    <div
      className={`message-attachments ${
        align === "end" ? "message-attachments-end" : ""
      }`}
    >
      {attachments.map((file, idx) => {
        const isImage = file.mimeType.startsWith("image/");
        if (isImage && file.url) {
          return (
            <a
              key={`${file.url}-${idx}`}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="attachment-image-link"
              title={file.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={file.url} alt={file.name} />
            </a>
          );
        }

        const inner = (
          <>
            {isImage ? (
              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{file.name}</span>
          </>
        );

        return file.url ? (
          <a
            key={`${file.url}-${idx}`}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="attachment-chip"
          >
            {inner}
          </a>
        ) : (
          <span key={`${file.name}-${idx}`} className="attachment-chip">
            {inner}
          </span>
        );
      })}
    </div>
  );
}

export function ChatMessage({ message }: { message: ChatMessageValue }) {
  if (message.role === "user") {
    return (
      <article className="message-row message-row-user">
        <div className="message-user-col">
          {message.attachments ? (
            <Attachments attachments={message.attachments} align="end" />
          ) : null}
          {message.content ? (
            <div className="user-message">{message.content}</div>
          ) : null}
        </div>
      </article>
    );
  }

  const hasActivities = Boolean(message.activities && message.activities.length > 0);

  return (
    <article className="message-row">
      <div className="assistant-avatar" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={appConfig.icon} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="assistant-message">
        {message.attachments ? (
          <div className="mb-2">
            <Attachments attachments={message.attachments} align="start" />
          </div>
        ) : null}

        {hasActivities ? (
          <ActivityGroup activities={message.activities!} isPending={message.pending} />
        ) : null}

        {message.content ? (
          <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
        ) : message.pending && !hasActivities ? (
          <span className="thinking-indicator" aria-label="Assistant is thinking">
            <i />
            <i />
            <i />
          </span>
        ) : null}

        {message.pending && message.content ? (
          <span className="streaming-cursor" aria-hidden="true" />
        ) : null}
      </div>
    </article>
  );
}
