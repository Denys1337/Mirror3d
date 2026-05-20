import https from "node:https";

const DEFAULT_AUTH = "Basic c2Rfb3NjOm82aFBpQ3pCRTZra1Eh";

let insecureHttpsAgent: https.Agent | undefined;

export function getJtlAuthorization(): string {
  const user = process.env.JTL_BASIC_USER;
  const pass = process.env.JTL_BASIC_PASS;
  if (user && pass) {
    return `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;
  }
  return DEFAULT_AUTH;
}

function useInsecureTls(): boolean {
  const v = process.env.JTL_TLS_INSECURE?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return process.env.NODE_ENV === "development";
}

function readEnvTrim(key: string): string | undefined {
  const raw = process.env[key];
  if (raw == null || raw === "") return undefined;
  return raw.trim().replace(/^["']|["']$/g, "").trim();
}

export async function jtlFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", getJtlAuthorization());
  }
  const cookie = readEnvTrim("JTL_COOKIE");
  if (cookie && !headers.has("Cookie")) {
    headers.set("Cookie", cookie);
  }

  const finalInit: RequestInit = { ...init, headers, cache: "no-store" };

  if (useInsecureTls()) {
    if (!insecureHttpsAgent) {
      insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });
    }
    return fetch(url, {
      ...finalInit,
      agent: insecureHttpsAgent,
    } as RequestInit);
  }

  return fetch(url, finalInit);
}

export function cookieFromSid(sid: string | null | undefined): string | null {
  const s = sid?.trim();
  if (!s) return null;
  return `JTLSHOP=${s}`;
}

/** JTL_COOKIE з .env + актуальний JTLSHOP з URL (?sid=). */
export function mergeSessionCookie(sid: string): string {
  const jar = new Map<string, string>();
  const envCookie = readEnvTrim("JTL_COOKIE");
  if (envCookie) {
    for (const part of envCookie.split(";")) {
      const p = part.trim();
      if (!p.includes("=")) continue;
      const i = p.indexOf("=");
      jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim());
    }
  }
  jar.set("JTLSHOP", sid.trim());
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/** data_konf.php інколи повертає PHP Deprecated перед JSON при status 200. */
export function parseJsonFromJtlBody(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
