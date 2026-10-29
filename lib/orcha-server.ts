import "server-only";

import type { AgentRuntime } from "orchajs";

import { orcha } from "@/orcha";

export class AppConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppConfigurationError";
  }
}

export function getAssistant(): AgentRuntime {
  if (!process.env.OPENAI_API_KEY) {
    throw new AppConfigurationError(
      "OPENAI_API_KEY is not configured. Add it to .env.local and restart the application.",
    );
  }

  const assistant = orcha.assistant as AgentRuntime | undefined;
  if (!assistant) {
    throw new AppConfigurationError(
      'The "assistant" agent is not registered in orcha/index.ts.',
    );
  }

  return assistant;
}
