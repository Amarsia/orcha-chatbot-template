function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]).replace(/\s+/g, " ").trim() : "";
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|section|article)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [, a, b] = ipv4.map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

export default async function fetchUrl({ url, maxChars = 6000 }) {
  let parsed;
  try {
    parsed = new URL(String(url ?? "").trim());
  } catch {
    throw new Error("Invalid URL provided.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http:// and https:// URLs are supported.");
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error("Private or local network hosts are not allowed.");
  }

  const limit = Math.min(20000, Math.max(200, Number(maxChars) || 6000));
  const response = await fetch(parsed.toString(), {
    headers: {
      "User-Agent": "OrchaChatbotTemplate/1.0",
      Accept: "text/html, text/plain, application/json;q=0.9",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();
  const isHtml = contentType.includes("text/html") || /<html[\s>]/i.test(raw.slice(0, 500));
  const title = isHtml ? extractTitle(raw) : parsed.hostname;
  const text = isHtml ? htmlToText(raw) : raw.trim();
  const truncated = text.length > limit;

  return {
    url: response.url || parsed.toString(),
    title: title || parsed.hostname,
    content: truncated ? `${text.slice(0, limit)}…` : text,
    truncated,
  };
}
