import { randomUUID } from "node:crypto";

const COOKIE_NAME = "orcha_chat_visitor";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function resolveVisitor(request: Request): {
  id: string;
  setCookie?: string;
} {
  const existing = cookieValue(request.headers.get("cookie"), COOKIE_NAME);
  if (existing && VISITOR_ID_PATTERN.test(existing)) {
    return { id: existing };
  }

  const id = randomUUID();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return {
    id,
    setCookie: `${COOKIE_NAME}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ONE_YEAR_SECONDS}${secure}`,
  };
}

export function withVisitorCookie(
  headers: HeadersInit | undefined,
  setCookie?: string,
): Headers {
  const result = new Headers(headers);
  if (setCookie) result.set("Set-Cookie", setCookie);
  return result;
}
