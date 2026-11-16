export default async function getCurrentTime({ timezone = "UTC" }) {
  const now = new Date();
  const tz = String(timezone || "UTC").trim() || "UTC";

  let formatted;
  try {
    formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(now);
  } catch {
    throw new Error(`Invalid IANA timezone "${tz}". Try e.g. "UTC", "America/New_York", or "Europe/London".`);
  }

  return {
    isoUtc: now.toISOString(),
    timezone: tz,
    formatted,
    unixSeconds: Math.floor(now.getTime() / 1000),
  };
}
