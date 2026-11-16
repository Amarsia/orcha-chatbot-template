export type AppTheme = "light" | "dark" | "system";

export type SuggestedPrompt = {
  title: string;
  prompt: string;
};

export type AppConfig = {
  /** Display name shown in the browser tab, sidebar, chat header, and footer disclaimer. */
  name: string;
  /** Meta description for the application. */
  description: string;
  /** Subtitle shown under the app name in the sidebar header. */
  assistantLabel: string;
  /** Path under `public/` (or absolute URL) used for the favicon, sidebar brand icon, welcome screen, and assistant avatar. */
  icon: string;
  /** Composer textarea placeholder text. */
  placeholder: string;
  /** Default color theme. */
  theme: AppTheme;
  /** Color palette overrides applied across light and dark modes. */
  colors: {
    /** Primary accent color (send button, links, active highlights). */
    accent: string;
    /** Optional hover color for primary accent buttons. */
    accentHover: string;
    /** Optional light-mode page background. */
    lightBackground: string;
    /** Optional light-mode sidebar background. */
    lightSidebar: string;
    /** Optional dark-mode page background. */
    darkBackground: string;
    /** Optional dark-mode sidebar background. */
    darkSidebar: string;
  };
  /** Heading and subtitle shown on an empty conversation. */
  welcome: {
    title: string;
    description: string;
  };
  /** Quick-start options shown below the centered welcome composer. */
  suggestedPrompts: readonly SuggestedPrompt[];
  /** Disclaimer shown below the message composer. */
  disclaimer: string;
  /** Attribution link shown in the sidebar footer, or `null` to hide. */
  poweredBy: { label: string; url: string } | null;
  /** Allow users to attach files to messages. */
  allowFileUploads: boolean;
  /** Maximum size per uploaded file in MB. */
  maxFileSizeMb: number;
};

export const appConfig = {
  name: "Nova",
  description: "A focused AI workspace powered by OrchaJS.",
  assistantLabel: "AI assistant",
  icon: "/orcha-mark.svg",
  placeholder: "How can I help you today?",
  theme: "system",
  colors: {
    accent: "#c96442",
    accentHover: "#b55636",
    lightBackground: "#faf9f5",
    lightSidebar: "#f5f4ef",
    darkBackground: "#1c1b19",
    darkSidebar: "#141413",
  },
  welcome: {
    title: "What can I help with?",
    description:
      "Ask a question, attach a document or image, or explore an idea together.",
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
      title: "Search & summarize",
      prompt: "Search the web for the latest developments in AI agents and summarize key takeaways.",
    },
  ],
  disclaimer: "Nova can make mistakes. Please double-check important responses.",
  poweredBy: { label: "OrchaJS", url: "https://github.com/Amarsia/orcha" },
  allowFileUploads: true,
  maxFileSizeMb: 10,
} as const satisfies AppConfig;
