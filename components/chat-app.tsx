"use client";

import {
  ArrowUp,
  Github,
  Menu,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
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
  contentToText,
  type ChatMessage as ChatMessageValue,
  type SessionSummary,
} from "@/lib/chat-types";

type StreamEvent = {
  type?: unknown;
  sessionId?: unknown;
  snapshot?: unknown;
  result?: unknown;
  error?: unknown;
};

type SessionListResponse = {
  items?: SessionSummary[];
  error?: string;
};

type SessionHistoryResponse = {
  items?: Array<{
    id?: string;
    type?: string;
    role?: "user" | "assistant";
    content?: unknown;
    createdAt?: string;
  }>;
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
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [error, setError] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);

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
      const data = (await response.json()) as SessionHistoryResponse;
      if (!response.ok) {
        throw new Error(data.error || "Conversation could not be loaded.");
      }
      const nextMessages = (data.items ?? []).flatMap((item) => {
        if (item.type !== "message" || !item.role) return [];
        return [
          {
            id: item.id ?? crypto.randomUUID(),
            role: item.role,
            content: contentToText(item.content),
            createdAt: item.createdAt ?? new Date().toISOString(),
          } satisfies ChatMessageValue,
        ];
      });
      setSessionId(nextSessionId);
      setMessages(nextMessages);
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
    setInput("");
    setError(undefined);
    setIsSidebarOpen(false);
    window.history.replaceState(null, "", "/");
  };

  const updateAssistant = (
    id: string,
    update: Partial<Pick<ChatMessageValue, "content" | "pending">>,
  ) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, ...update } : message,
      ),
    );
  };

  const sendMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || isSending || !isReady) return;

    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ]);
    setInput("");
    setError(undefined);
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId }),
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
              <Sparkles />
            </span>
            <span className="brand-copy">
              <strong>{appConfig.name}</strong>
              <small>{appConfig.assistantLabel}</small>
            </span>
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
          <span>New conversation</span>
        </button>

        <div className="conversation-section">
          <p className="section-label">Conversations</p>
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
                  <MessageSquare />
                  <span>{session.name || "Untitled conversation"}</span>
                  <time dateTime={session.updatedAt}>
                    {formatRelativeTime(session.updatedAt)}
                  </time>
                </button>
              ))
            ) : (
              <p className="conversation-empty">
                Your conversations will appear here.
              </p>
            )}
          </nav>
        </div>

        <div className="sidebar-footer">
          <ThemeSelector />
          <a
            href="https://github.com/Amarsia/orcha"
            target="_blank"
            rel="noreferrer"
            className="github-link"
          >
            <Github />
            <span>OrchaJS</span>
          </a>
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
          <button
            type="button"
            className="icon-button mobile-menu"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu />
          </button>
          <div className="chat-title">
            <strong>{activeSession?.name || appConfig.name}</strong>
            <span>
              <i data-error={error || undefined} />
              {error ? "Needs attention" : "Ready"}
            </span>
          </div>
          <button
            type="button"
            className="icon-button collapse-button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeftClose />
          </button>
        </header>

        <div className="messages-viewport">
          {isLoadingSession ? (
            <div className="session-loading" aria-label="Loading conversation">
              <span />
              <span />
              <span />
            </div>
          ) : isEmpty ? (
            <div className="welcome">
              <div className="welcome-mark">
                <Sparkles />
              </div>
              <h1>{appConfig.welcome.title}</h1>
              <p>{appConfig.welcome.description}</p>
              <div className="prompt-grid">
                {appConfig.suggestedPrompts.map((suggestion) => (
                  <button
                    key={suggestion.title}
                    type="button"
                    disabled={!isReady}
                    onClick={() => void sendMessage(suggestion.prompt)}
                  >
                    <strong>{suggestion.title}</strong>
                    <span>{suggestion.prompt}</span>
                  </button>
                ))}
              </div>
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

        <div className="composer-region">
          {error ? (
            <div className="error-banner" role="alert">
              {error}
            </div>
          ) : null}
          <form className="composer" onSubmit={submit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Message Nova…"
              aria-label="Message Nova"
              rows={1}
              maxLength={20_000}
              disabled={isSending || !isReady}
            />
            <button
              type="submit"
              className="send-button"
              disabled={!input.trim() || isSending || !isReady}
              aria-label="Send message"
            >
              <ArrowUp />
            </button>
          </form>
          <p className="composer-note">
            {appConfig.name} can make mistakes. Check important information.
          </p>
        </div>
      </section>
    </main>
  );
}
