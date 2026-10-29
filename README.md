# Orcha Chatbot Template

A complete Next.js chatbot application powered by [OrchaJS](https://github.com/Amarsia/orcha). It includes streaming responses, durable conversation history, responsive navigation, Markdown rendering, and light, dark, and system themes.

## Features

- Server-side OrchaJS agent execution
- Streaming NDJSON chat API
- Durable JSONL conversation history
- Responsive desktop and mobile interface
- Markdown, tables, lists, links, and code blocks
- Conversation deep links
- Configurable assistant identity and suggested prompts
- Optional Amarsia project sync and privacy-safe analytics
- Container deployment with persistent session storage

## Get started

Create a repository from this GitHub template, then install dependencies:

```bash
npm install
cp .env.example .env.local
```

Add your OpenAI key to `.env.local`:

```bash
OPENAI_API_KEY=your_key
```

Start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Customize the application

The application identity, welcome copy, and suggested prompts live in:

```text
config/app.ts
```

The agent model and runtime settings live in:

```text
orcha/assistant/index.json
```

The agent behavior lives in:

```text
orcha/assistant/instructions.md
```

The visual system is defined with purpose-based CSS variables in:

```text
app/globals.css
```

## Develop the agent

Use the standalone Orcha playground when you want to focus on the agent without the application UI:

```bash
npm run agent:playground
```

Run agent tests placed under the agent's `tests` directory with:

```bash
npm run agent:test
```

See the [OrchaJS repository](https://github.com/Amarsia/orcha) for actions, skills, subagents, evaluations, and provider configuration.

## API

The Next.js application exposes three same-origin endpoints:

- `POST /api/chat` starts or continues an execution and streams NDJSON events.
- `GET /api/sessions` lists durable conversations.
- `GET /api/sessions/:sessionId` returns conversation history.

Provider credentials remain on the server.

## Amarsia project sync

Set `AMARSIA_PROJECT_KEY` to sync the agent definition and send privacy-safe run analytics:

```bash
AMARSIA_PROJECT_KEY=your_project_key
AMARSIA_API_URL=https://api.amarsia.com
```

The application still works without an Amarsia project key.

## Container deployment

Build and run the included Docker image:

```bash
docker build -t orcha-chatbot .
docker run \
  --env-file .env.local \
  -p 3000:3000 \
  -v orcha-sessions:/data/sessions \
  orcha-chatbot
```

The template uses local JSONL storage and should run as one application instance with a persistent volume. For horizontally scaled deployments, replace the session store with shared durable storage.

## Project structure

```text
app/                    Next.js routes and API handlers
components/             Chat interface and theme controls
config/app.ts           Product-facing application configuration
lib/                    Server runtime and shared chat types
orcha/                  Agent registry, manifest, and instructions
.amarsia/template.json  Template catalog metadata
```

## License

MIT
