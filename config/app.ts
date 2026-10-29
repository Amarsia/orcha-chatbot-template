export const appConfig = {
  name: "Nova",
  description: "A focused AI workspace powered by OrchaJS.",
  assistantLabel: "AI assistant",
  welcome: {
    title: "What can I help you with?",
    description:
      "Ask a question, explore an idea, or work through something together.",
  },
  suggestedPrompts: [
    {
      title: "Plan a project",
      prompt: "Help me turn an idea into a practical project plan.",
    },
    {
      title: "Explain a concept",
      prompt: "Explain a complex concept clearly with a concrete example.",
    },
    {
      title: "Improve my writing",
      prompt: "Help me make a piece of writing clearer and more concise.",
    },
    {
      title: "Think through a decision",
      prompt: "Help me compare the trade-offs in a decision I am making.",
    },
  ],
} as const;
