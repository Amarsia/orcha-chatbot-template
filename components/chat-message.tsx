import { Sparkles } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ChatMessage as ChatMessageValue } from "@/lib/chat-types";

export function ChatMessage({ message }: { message: ChatMessageValue }) {
  if (message.role === "user") {
    return (
      <article className="message-row message-row-user">
        <div className="user-message">{message.content}</div>
      </article>
    );
  }

  return (
    <article className="message-row">
      <div className="assistant-avatar" aria-hidden="true">
        <Sparkles />
      </div>
      <div className="assistant-message">
        {message.content ? (
          <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
        ) : (
          <span className="thinking-indicator" aria-label="Assistant is thinking">
            <i />
            <i />
            <i />
          </span>
        )}
        {message.pending && message.content ? (
          <span className="streaming-cursor" aria-hidden="true" />
        ) : null}
      </div>
    </article>
  );
}
