# Orcha Chatbot Template

A full-stack Next.js AI chatbot starter powered by **[OrchaJS](https://github.com/Amarsia/orcha)** (`orchajs` [on npm](https://www.npmjs.com/package/orchajs)). Use it as a production-ready template or as a hands-on tutorial for building durable, tool-using conversational agents with a Claude-inspired interface.

## Links

- **OrchaJS GitHub**: [github.com/Amarsia/orcha](https://github.com/Amarsia/orcha)
- **OrchaJS npm package**: [npmjs.com/package/orchajs](https://www.npmjs.com/package/orchajs)

---

## What's Included

- **Claude-style chat interface** — Centered welcome stage, collapsible sidebar, Markdown + GFM rendering, and light/dark/system themes.
- **Live agent activity** — Inline, expandable steps for tool calls (`Input` / `Output` / duration), model reasoning, subagents, and loaded skills streamed in real time and reconstructed from durable session history.
- **File uploads & multimodal messages** — Visitor-scoped file attachments (images, PDFs, Markdown, CSV, JSON, Office docs) stored under `.orcha/uploads/` and passed to OrchaJS as `{ type: "file", filePath, mimeType }`.
- **Single-file app customization** — Edit `config/app.ts` to change branding, icons, accent and background colors, welcome copy, suggested prompts, disclaimer, and upload limits.
- **Built-in example tools** — Includes local actions under `orcha/assistant/actions/` (`search_web`, `fetch_url`, `get_current_time`, and `calculate`) plus unit/eval tests under `orcha/assistant/tests/`.
- **Durable sessions** — Conversations persist across reloads with visitor cookie isolation and `orchajs` session history/events.

---

## How the Orcha-Powered Design Works

OrchaJS separates **agent definition** from **application UI**:

1. **Filesystem-convention agent (**`orcha/`**)**
   - `orcha/index.ts` registers your agents, storage strategy (`"cloud"` by default, or `"node-jsonl"` / `"sqlite"`), and action environment variables.
   - `orcha/assistant/index.json` configures the model (`provider`, `model`, `maxTokens`).
   - `orcha/assistant/instructions.md` defines the system prompt.
   - `orcha/assistant/actions/*` are auto-discovered local tools (`index.json` schema + `index.js` implementation).
   - `orcha/assistant/tests/*` are declarative end-to-end agent test cases run via `npm run agent:test`.
2. **Server-side execution (**`app/api/chat/route.ts`**)**
   - Provider/Amarsia credentials stay strictly on the server.
   - Incoming messages and resolved attachment paths are passed to `assistant.run(...)` or `assistant.resume(sessionId, ...)`.
   - The route streams NDJSON frames (`session`, `activities`, `snapshot`, `result`, `error`) to the browser so text and tool activity update live.
3. **Durable event timeline (**`lib/session-timeline.ts`**)**
   - Reads canonical OrchaJS session events via `assistant.events(sessionId)` (`message.created`, `action.requested`, `action.completed`, `subagent.*`, `skill.*`) so a reloaded conversation renders the exact same messages, attachments, reasoning, and tool steps as a live run.

---

## Quick Start

### 1. Install dependencies

```bash
npm install
cp .env.example .env.local
```

### 2. Configure environment variables

Choose either **Amarsia Inference** (recommended to get started quickly with free credits, cloud storage, and telemetry) or **your own model provider keys** (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.):

**Option A — Amarsia Inference (includes free credits):**

1. Sign up on [Amarsia](https://amarsia.com), go to **Projects**, click **Connect New Project**, and copy the generated project key.
2. Add it to `.env.local`:

```dotenv
AMARSIA_PROJECT_KEY=your_project_key
AMARSIA_API_URL=https://api.amarsia.com

# Optional: upgrade `search_web` from zero-config DuckDuckGo/Wikipedia to Firecrawl or Tavily
# FIRECRAWL_API_KEY=
# TAVILY_API_KEY=
```

**Option B — Your own model provider keys:**

If you prefer not to use Amarsia Inference, you can pass your own provider API keys directly in `orcha/index.ts` (for example `providers: { openai: process.env.OPENAI_API_KEY ?? "" }`, or `anthropic`, `googlegenai`, `deepseek`, `bedrock`, `vertexai`) and update the key check in `lib/orcha-server.ts`. See the [OrchaJS documentation](https://github.com/Amarsia/orcha) for all provider configurations.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> Note: `npm run dev` runs `orchajs build` before starting Next.js. Whenever you add or edit files under `orcha/`, restart `npm run dev` so the compiled agent bundle picks up your changes.

---

## Customization Guide

### Branding, Colors, and UI (`config/app.ts`)

All product-facing settings live in `config/app.ts`:

- `name`, `description`, `assistantLabel` — Page title, sidebar header, and chat header.
- `icon` — Path in `public/` (or URL) used for the favicon, welcome mark, sidebar logo, and assistant avatar.
- `theme` — Default theme (`"light" | "dark" | "system"`).
- `colors` — Accent (`accent`, `accentHover`) and light/dark page & sidebar backgrounds (`lightBackground`, `lightSidebar`, `darkBackground`, `darkSidebar`).
- `welcome` & `suggestedPrompts` — Empty-state heading, subtitle, and quick-start pills.
- `allowFileUploads` & `maxFileSizeMb` — Toggle attachments and cap upload size.
- `disclaimer` & `poweredBy` — Footer text and attribution link.

### Agent Model, Instructions, and Tools (`orcha/assistant/`)

- **Change the model**: Edit `orcha/assistant/index.json` (`provider`, `model`, `maxTokens`, `reasoningLevel`).
- **Change behavior**: Edit `orcha/assistant/instructions.md`.
- **Add a new tool (action)**: Create a folder under `orcha/assistant/actions/<actionName>/` with `index.json` (name, description, JSON Schema parameters, network/env permissions) and `index.js` (default async handler). OrchaJS discovers it automatically on the next build.
- **Add skills or subagents**: Add `skills/<skillName>/` folders or register subagents in `orcha/index.ts`—any reasoning, tool calls, skill loads, and subagent runs automatically appear in the chat timeline.

### Standalone Agent Playground & Tests

Test and iterate on the agent independently of the Next.js UI:

```bash
# Open the local Orcha playground UI
npm run agent:playground

# Run tests in orcha/assistant/tests/
npm run agent:test
```

---

## API Endpoints

| Route | Method | Description |
| --- | --- | --- |
| `/api/chat` | `POST` | Starts or resumes an Orcha run and streams NDJSON (`session`, `activities`, `snapshot`, `result`). |
| `/api/sessions` | `GET` | Lists sessions owned by the current visitor cookie. |
| `/api/sessions/[sessionId]` | `GET` | Returns reconstructed `messages`, `attachments`, and `activities` for a visitor-owned session. |
| `/api/uploads` | `POST` | Stores a multipart file upload under `.orcha/uploads/<visitorId>/`. |
| `/api/uploads/[fileId]` | `GET` | Serves a visitor-owned uploaded file for preview or download. |

---

## Project Structure

```text
app/
  api/                  Chat streaming, session history, and file upload routes
  globals.css           Theme CSS variables and chat/step styles
  layout.tsx            Fonts, metadata, and config-driven CSS custom properties
components/
  chat-app.tsx          Sidebar, welcome stage, composer, and NDJSON stream client
  chat-message.tsx      Markdown renderer, attachments, and inline activity steps
  theme-provider.tsx    next-themes wrapper
  theme-selector.tsx    Light / dark / system switcher
config/
  app.ts                Central UI, branding, theme, prompt, and upload config
lib/
  chat-types.ts         Shared message, attachment, and activity types
  orcha-server.ts       Server-only Orcha runtime accessor
  session-timeline.ts   Orcha event-to-timeline projector
  uploads.ts            Visitor-scoped file storage helpers
  visitor.ts            HttpOnly visitor cookie helper
orcha/
  index.ts              Orcha registry (Amarsia inference, storage, action env)
  assistant/
    index.json          Model configuration
    instructions.md     System prompt
    actions/            Local tools (searchWeb, fetchUrl, getCurrentTime, calculate)
    tests/              Agent test cases
```

---

## Deployment

Build and run with the included `Dockerfile`:

```bash
docker build -t orcha-chatbot .
docker run \
  --env-file .env.local \
  -p 3000:3000 \
  -v orcha-sessions:/app/.orcha \
  orcha-chatbot
```

---

## License

MIT
