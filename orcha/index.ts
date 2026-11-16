import { orcha } from "orchajs";

orcha.init({
  amarsia: {
    key: process.env.AMARSIA_PROJECT_KEY ?? "",
    endpoint: process.env.AMARSIA_API_URL,
    inference: true,
  },
  storage: {
    strategy: "cloud",
  },
  actions: {
    runtime: "native",
    env: {
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
      TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    },
  },
  agents: {
    assistant: "./assistant",
  },
});

export { orcha };
