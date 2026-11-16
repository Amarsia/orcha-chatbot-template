function decodeHtml(value) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveDdgHref(rawHref) {
  const cleaned = rawHref.replace(/&amp;/g, "&").trim();
  if (!cleaned) return "";
  try {
    const normalized = cleaned.startsWith("//") ? `https:${cleaned}` : cleaned;
    const parsed = new URL(normalized, "https://duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return uddg;
    return parsed.toString();
  } catch {
    return cleaned;
  }
}

async function searchWithFirecrawl(query, limit, apiKey, context) {
  const response = await context.fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, limit }),
  });
  if (!response.ok) {
    throw new Error(`Firecrawl search failed (${response.status})`);
  }
  const payload = await response.json();
  const items = Array.isArray(payload?.data) ? payload.data : [];
  return items
    .map((item) => ({
      title: String(item?.title || item?.url || query),
      snippet: String(item?.description || item?.markdown || "").slice(0, 400).trim(),
      url: String(item?.url || ""),
    }))
    .filter((item) => item.url);
}

async function searchWithTavily(query, limit, apiKey, context) {
  const response = await context.fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: limit,
      search_depth: "basic",
    }),
  });
  if (!response.ok) {
    throw new Error(`Tavily search failed (${response.status})`);
  }
  const payload = await response.json();
  const items = Array.isArray(payload?.results) ? payload.results : [];
  return items
    .map((item) => ({
      title: String(item?.title || item?.url || query),
      snippet: String(item?.content || "").slice(0, 400).trim(),
      url: String(item?.url || ""),
    }))
    .filter((item) => item.url);
}

async function searchDuckDuckGoHtml(query, limit, context) {
  const body = new URLSearchParams({ q: query, kl: "wt-wt" }).toString();
  const response = await context.fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo HTML failed (${response.status})`);
  }

  const html = await response.text();
  const results = [];
  const seen = new Set();

  const blockPattern =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>)?/gi;

  for (const match of html.matchAll(blockPattern)) {
    if (results.length >= limit) break;
    const url = resolveDdgHref(match[1]);
    if (!url || seen.has(url) || url.includes("duckduckgo.com/y.js")) continue;
    const title = decodeHtml(match[2] || "");
    const snippet = decodeHtml(match[3] || match[4] || "");
    if (!title) continue;
    seen.add(url);
    results.push({ title, snippet, url });
  }

  return results;
}

async function searchWikipedia(query, limit, context) {
  const wikiUrl = new URL("https://en.wikipedia.org/w/api.php");
  wikiUrl.searchParams.set("action", "query");
  wikiUrl.searchParams.set("list", "search");
  wikiUrl.searchParams.set("srsearch", query);
  wikiUrl.searchParams.set("srlimit", String(limit));
  wikiUrl.searchParams.set("format", "json");
  wikiUrl.searchParams.set("origin", "*");

  const response = await context.fetch(wikiUrl.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "OrchaChatbotTemplate/1.0",
    },
  });
  if (!response.ok) return [];
  const payload = await response.json();
  const items = Array.isArray(payload?.query?.search) ? payload.query.search : [];
  return items
    .filter((item) => item?.title)
    .slice(0, limit)
    .map((item) => ({
      title: String(item.title),
      snippet: decodeHtml(String(item.snippet ?? "")),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(item.title).replace(/ /g, "_"))}`,
    }));
}

export default async function searchWeb({ query, limit = 5 }, context) {
  const cleaned = String(query ?? "").trim();
  if (!cleaned) {
    throw new Error("query must be a non-empty string.");
  }

  const maxResults = Math.min(10, Math.max(1, Number(limit) || 5));

  const firecrawlKey = context.env?.FIRECRAWL_API_KEY?.trim();
  if (firecrawlKey) {
    try {
      const results = await searchWithFirecrawl(cleaned, maxResults, firecrawlKey, context);
      if (results.length > 0) return { query: cleaned, results };
    } catch (error) {
      context.log("Firecrawl fallback:", error instanceof Error ? error.message : String(error));
    }
  }

  const tavilyKey = context.env?.TAVILY_API_KEY?.trim();
  if (tavilyKey) {
    try {
      const results = await searchWithTavily(cleaned, maxResults, tavilyKey, context);
      if (results.length > 0) return { query: cleaned, results };
    } catch (error) {
      context.log("Tavily fallback:", error instanceof Error ? error.message : String(error));
    }
  }

  try {
    const results = await searchDuckDuckGoHtml(cleaned, maxResults, context);
    if (results.length > 0) return { query: cleaned, results };
  } catch (error) {
    context.log("DuckDuckGo HTML fallback:", error instanceof Error ? error.message : String(error));
  }

  const wikiResults = await searchWikipedia(cleaned, maxResults, context);
  return {
    query: cleaned,
    results: wikiResults,
  };
}
