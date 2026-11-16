"use client";

import {
  ArrowUp,
  Check,
  Github,
  Loader2,
  Menu,
  PanelLeft,
  Plus,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ChatMessage } from "@/components/chat-message";
import { ThemeSelector } from "@/components/theme-selector";
import { appConfig } from "@/config/app";
import {
  type ChatActivity,
  type ChatAttachment,
  type ChatMessage as ChatMessageValue,
  type SessionSummary,
} from "@/lib/chat-types";

type StreamEvent = {
  type?: unknown;
  sessionId?: unknown;
  snapshot?: unknown;
  activities?: unknown;
  result?: unknown;
  error?: unknown;
};

type SessionListResponse = {
  items?: SessionSummary[];
  error?: string;
};

type SessionDetailResponse = {
  messages?: ChatMessageValue[];
  error?: string;
};

type PendingAttachment = {
  localId: string;
  id?: string;
  name: string;
  mimeType: string;
  url?: string;
  uploading: boolean;
  error?: string;
};

function outputToText(output: unknown): string {
  if (typeof output === "string") return output;
  if (output === null || output === undefined) return "";
  return JSON.stringify(output, null, 2);
}

function streamOutput(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const snapshot = value as { status?: unknown; output?: unknown };
  if (snapshot.status !== "streaming") return undefined;
  return outputToText(snapshot.output);
}

function resultOutput(value: unknown): { output?: string; error?: string } {
  if (typeof value !== "object" || value === null) return {};
  const result = value as {
    status?: unknown;
    output?: unknown;
    error?: { message?: unknown };
  };
  if (result.status === "failed") {
    return {
      error:
        typeof result.error?.message === "string"
          ? result.error.message
          : "The assistant could not complete this response.",
    };
  }
  return { output: outputToText(result.output) };
}

function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(timestamp).toLocaleDateString();
}

export function ChatApp() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessageValue[]>([]);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [error, setError] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/sessions", { cache: "no-store" });
      const data = (await response.json()) as SessionListResponse;
      if (response.ok && Array.isArray(data.items)) {
        setSessions(data.items);
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError("The application could not connect to the assistant.");
    }
  }, []);

  const openSession = useCallback(async (nextSessionId: string) => {
    setIsLoadingSession(true);
    setIsSidebarOpen(false);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(nextSessionId)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as SessionDetailResponse;
      if (!response.ok) {
        throw new Error(data.error || "Conversation could not be loaded.");
      }
      setSessionId(nextSessionId);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setAttachments([]);
      window.history.replaceState(null, "", `/?session=${nextSessionId}`);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Conversation could not be loaded.",
      );
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshSessions();
      const initialSession = new URLSearchParams(window.location.search).get(
        "session",
      );
      if (initialSession) await openSession(initialSession);
      setIsReady(true);
    })();
  }, [openSession, refreshSessions]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: isSending ? "smooth" : "auto" });
  }, [messages, isSending]);

  const startNewChat = () => {
    setSessionId(undefined);
    setMessages([]);
    setAttachments([]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setError(undefined);
    setIsSidebarOpen(false);
    window.history.replaceState(null, "", "/");
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    setError(undefined);

    for (const file of files) {
      const localId = crypto.randomUUID();
      setAttachments((current) => [
        ...current,
        {
          localId,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          uploading: true,
        },
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json()) as {
          id?: string;
          name?: string;
          mimeType?: string;
          url?: string;
          error?: string;
        };
        if (!response.ok || !data.id) {
          throw new Error(data.error || "Upload failed.");
        }
        setAttachments((current) =>
          current.map((item) =>
            item.localId === localId
              ? {
                  ...item,
                  id: data.id,
                  name: data.name || item.name,
                  mimeType: data.mimeType || item.mimeType,
                  url: data.url,
                  uploading: false,
                }
              : item,
          ),
        );
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "Upload failed.";
        setAttachments((current) =>
          current.map((item) =>
            item.localId === localId
              ? { ...item, uploading: false, error: message }
              : item,
          ),
        );
      }
    }
  };

  const removeAttachment = (localId: string) => {
    setAttachments((current) => current.filter((item) => item.localId !== localId));
  };

  const updateAssistant = (
    id: string,
    update: Partial<Pick<ChatMessageValue, "content" | "pending" | "activities">>,
  ) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, ...update } : message,
      ),
    );
  };

  const readyAttachments = attachments.filter(
    (item) => item.id && !item.uploading && !item.error,
  );
  const hasUploading = attachments.some((item) => item.uploading);
  const canSend =
    (input.trim().length > 0 || readyAttachments.length > 0) &&
    !isSending &&
    !hasUploading &&
    isReady;

  const sendMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if ((!message && readyAttachments.length === 0) || isSending || hasUploading || !isReady) {
      return;
    }

    const attachmentsToSend: ChatAttachment[] = readyAttachments.map((item) => ({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      url: item.url,
    }));

    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        content: message,
        attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
        createdAt: new Date().toISOString(),
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        activities: [],
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ]);
    setInput("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setError(undefined);
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sessionId,
          attachments: attachmentsToSend.map((item) => ({ id: item.id })),
        }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "The assistant could not be reached.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalOutput = "";

      const handleEvent = (event: StreamEvent) => {
        if (event.type === "session" && typeof event.sessionId === "string") {
          setSessionId(event.sessionId);
          window.history.replaceState(
            null,
            "",
            `/?session=${event.sessionId}`,
          );
          return;
        }
        if (event.type === "activities" && Array.isArray(event.activities)) {
          updateAssistant(assistantMessageId, {
            activities: event.activities as ChatActivity[],
          });
          return;
        }
        if (event.type === "snapshot") {
          const output = streamOutput(event.snapshot);
          if (output !== undefined) {
            finalOutput = output;
            updateAssistant(assistantMessageId, { content: output });
          }
          return;
        }
        if (event.type === "result") {
          const result = resultOutput(event.result);
          if (result.error) throw new Error(result.error);
          if (result.output) {
            finalOutput = result.output;
            updateAssistant(assistantMessageId, { content: result.output });
          }
          return;
        }
        if (event.type === "error" && typeof event.error === "string") {
          throw new Error(event.error);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) handleEvent(JSON.parse(line) as StreamEvent);
        }
        if (done) break;
      }
      if (buffer.trim()) handleEvent(JSON.parse(buffer) as StreamEvent);
      if (!finalOutput) {
        throw new Error("The assistant returned an empty response.");
      }
    } catch (sendError) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : "The assistant could not complete this response.";
      setError(message);
      updateAssistant(assistantMessageId, {
        content: `I couldn't complete that response. ${message}`,
      });
    } finally {
      updateAssistant(assistantMessageId, { pending: false });
      setIsSending(false);
      void refreshSessions();
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  const activeSession = sessions.find(
    (session) => session.sessionId === sessionId,
  );
  const isEmpty = messages.length === 0 && !isLoadingSession;

  const composerBlock = (
    <div className="composer-container">
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      {appConfig.allowFileUploads ? (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx"
          onChange={handleFileSelect}
          className="hidden"
        />
      ) : null}

      <form className="composer-card" onSubmit={submit}>
        {attachments.length > 0 ? (
          <div className="composer-attachments">
            {attachments.map((file) => (
              <div
                key={file.localId}
                title={file.error}
                data-ready={file.id && !file.uploading ? "" : undefined}
                data-error={file.error ? "" : undefined}
                className="pending-chip"
              >
                <span className="pending-chip-name">{file.name}</span>
                {file.uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {file.id && !file.uploading ? <Check className="h-3 w-3" /> : null}
                {file.error ? <span aria-label={file.error}>!</span> : null}
                <button
                  type="button"
                  className="pending-chip-remove"
                  onClick={() => removeAttachment(file.localId)}
                  disabled={file.uploading}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="composer-input-wrap">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleComposerKeyDown}
            placeholder={appConfig.placeholder}
            aria-label={appConfig.placeholder}
            rows={1}
            maxLength={20_000}
            disabled={isSending || !isReady}
          />
        </div>

        <div className="composer-toolbar">
          {appConfig.allowFileUploads ? (
            <button
              type="button"
              className="composer-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || !isReady}
              aria-label="Attach files"
              title="Attach files"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : (
            <span />
          )}

          <button
            type="submit"
            className="send-button"
            disabled={!canSend}
            aria-label="Send message"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp />}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <main className="chat-shell">
      <aside
        className="sidebar"
        data-open={isSidebarOpen || undefined}
        data-collapsed={sidebarCollapsed || undefined}
      >
        <div className="sidebar-header">
          <button
            type="button"
            className="brand-button"
            onClick={startNewChat}
            aria-label={`${appConfig.name} home`}
          >
            <span className="brand-mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={appConfig.icon} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="brand-copy">
              <strong>{appConfig.name}</strong>
            </span>
          </button>
          <button
            type="button"
            className="icon-button collapse-button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft />
          </button>
          <button
            type="button"
            className="icon-button sidebar-close"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X />
          </button>
        </div>

        <button type="button" className="new-chat-button" onClick={startNewChat}>
          <Plus />
          <span>New chat</span>
        </button>

        <div className="conversation-section">
          <p className="section-label">Chats</p>
          <nav aria-label="Conversation history">
            {sessions.length ? (
              sessions.map((session) => (
                <button
                  key={session.sessionId}
                  type="button"
                  className="conversation-item"
                  data-active={session.sessionId === sessionId || undefined}
                  title={session.name || "Untitled conversation"}
                  onClick={() => void openSession(session.sessionId)}
                >
                  <span>{session.name || "Untitled conversation"}</span>
                  <time dateTime={session.updatedAt}>
                    {formatRelativeTime(session.updatedAt)}
                  </time>
                </button>
              ))
            ) : (
              <p className="conversation-empty">
                Your chats will appear here.
              </p>
            )}
          </nav>
        </div>

        <div className="sidebar-footer">
          <ThemeSelector />
          {appConfig.poweredBy ? (
            <a
              href={appConfig.poweredBy.url}
              target="_blank"
              rel="noreferrer"
              className="github-link"
            >
              <Github />
              <span>{appConfig.poweredBy.label}</span>
            </a>
          ) : null}
        </div>
      </aside>

      {isSidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <section className="chat-panel">
        <header className="chat-header">
          <div className="chat-header-left">
            <button
              type="button"
              className="icon-button mobile-menu"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu />
            </button>
            {!isEmpty ? (
              <div className="chat-title">
                <i className="chat-status-dot" data-error={error || undefined} />
                <strong>{activeSession?.name || appConfig.name}</strong>
              </div>
            ) : null}
          </div>
        </header>

        <div className="messages-viewport">
          {isLoadingSession ? (
            <div className="session-loading" aria-label="Loading conversation">
              <span />
              <span />
              <span />
            </div>
          ) : isEmpty ? (
            <div className="welcome-stage">
              <div className="welcome-heading">
                <div className="welcome-mark">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={appConfig.icon} alt={appConfig.name} className="h-full w-full object-cover" />
                </div>
                <h1>{appConfig.welcome.title}</h1>
              </div>

              {appConfig.welcome.description ? (
                <p className="welcome-subtitle">{appConfig.welcome.description}</p>
              ) : null}

              <div className="welcome-composer-wrap">{composerBlock}</div>

              {appConfig.suggestedPrompts.length > 0 ? (
                <div className="prompt-pills">
                  {appConfig.suggestedPrompts.map((suggestion) => (
                    <button
                      key={suggestion.title}
                      type="button"
                      className="prompt-pill"
                      disabled={!isReady}
                      onClick={() => void sendMessage(suggestion.prompt)}
                    >
                      {suggestion.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="message-list" aria-live="polite">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {!isEmpty ? (
          <div className="composer-region">
            {composerBlock}
            {appConfig.disclaimer ? (
              <p className="composer-note">{appConfig.disclaimer}</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
