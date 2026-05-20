import { NextResponse } from "next/server";
import { resolveProductIds } from "../../../lib/productIds";
import { parseMirrorUrlParams, resolveSizeKonfigItem } from "../../../lib/urlParams";

export const runtime = "nodejs";

const IO_ENDPOINT = "https://test.schreiber-design.com/io";
const BASIC_USER = process.env.JTL_BASIC_USER;
const BASIC_PASS = process.env.JTL_BASIC_PASS;
const IO_AUTHORIZATION =
  BASIC_USER && BASIC_PASS
    ? `Basic ${Buffer.from(`${BASIC_USER}:${BASIC_PASS}`, "utf8").toString(
        "base64"
      )}`
    : "Basic c2Rfb3NjOm82aFBpQ3pCRTZra1Eh";

function readEnvTrim(key: string): string | undefined {
  const raw = process.env[key];
  if (raw == null || raw === "") return undefined;
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

/** Зливає Set-Cookie з існуючим заголовком Cookie (ім'я=значення), щоб не губити сесію. */
function mergeSetCookiesIntoHeader(
  existingHeader: string | null | undefined,
  setCookieHeaders: string[]
): string {
  const jar = new Map<string, string>();
  const ingestCookieHeader = (header: string | null | undefined) => {
    if (!header) return;
    for (const part of header.split(";")) {
      const p = part.trim();
      if (!p.includes("=")) continue;
      const i = p.indexOf("=");
      const k = p.slice(0, i).trim();
      const v = p.slice(i + 1).trim();
      if (k) jar.set(k, v);
    }
  };
  ingestCookieHeader(existingHeader);
  for (const raw of setCookieHeaders) {
    const first = raw.split(";")[0]?.trim();
    if (!first?.includes("=")) continue;
    const i = first.indexOf("=");
    jar.set(first.slice(0, i).trim(), first.slice(i + 1).trim());
  }
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/** Скільки name=value у рядку Cookie (для діагностики в DevTools без витоку значень). */
function cookieHeaderStats(header: string | null | undefined): {
  sent: boolean;
  pairCount: number;
} {
  if (!header?.trim()) return { sent: false, pairCount: 0 };
  const pairs = header
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.includes("="));
  return { sent: true, pairCount: pairs.length };
}

// Cookie jar між buildConfiguration (GET) і load_konfig (POST)
let remoteCookieHeader: string | null = readEnvTrim("JTL_COOKIE") ?? null;

const BROWSER_LIKE_HEADERS: Record<string, string> = {
  "Accept-Language": "en-US,en;q=0.9,uk;q=0.8",
  Origin: "https://test.schreiber-design.com",
  Referer: "https://test.schreiber-design.com/spiegel/p/badspiegel-comfort-side-ledplus",
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36",
  priority: "u=1, i",
  "sec-ch-ua":
    "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": "\"Android\"",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

function extractSetCookieHeaders(res: Response): string[] {
  try {
    const anyHeaders = res.headers as any;
    const getSetCookie = anyHeaders?.getSetCookie;
    if (typeof getSetCookie === "function") {
      return getSetCookie.call(anyHeaders) as string[];
    }
  } catch {
    // ignore
  }
  try {
    const setCookie = res.headers.get("set-cookie");
    return setCookie ? [setCookie] : [];
  } catch {
    return [];
  }
}

/** Як у браузері: без quantity та актуального jtl_token бекенд часто віддає зайві/неактивні групи. */
const DEFAULT_JTL_TOKEN =
  "6c08e5033bc977face39247c0d040e8c354c5038509611843a135f4014ca78fe";

function cookieFromSid(sid: string | null | undefined): string | null {
  const s = sid?.trim();
  if (!s) return null;
  return `JTLSHOP=${s}`;
}

function buildBuildConfigurationIoBody(
  token: string,
  artikelId: string,
  articalNumber: string,
  sizeKonfigItem: string
): string {
  const params = {
    jtl_token: token,
    inWarenkorb: "1",
    a: artikelId,
    wke: "1",
    show: "1",
    kKundengruppe: "3",
    kSprache: "1",
    eigenschaftwert: { "1601": "", "1602": "" },
    artical_number: articalNumber,
    data_file_exist: "1",
    mir_type: "square",
    str_type: "xside",
    mir_model: "comfort",
    str_widt: "30",
    str_vert_bside: "40",
    str_vert_top: "60",
    str_vert_btm: "60",
    str_hori_bside: "0",
    str_hori_top: "0",
    str_hori_btm: "0",
    shining_sid: "no",
    item: {
      "249": { "0": sizeKonfigItem },
      "261": { "0": "1215" },
      "288": { "0": "2584" },
      "363": { "0": "1838" },
    },
    customSizeConfigItem: sizeKonfigItem,
    customSizeConfigGroup: "249",
    breite: "400",
    hoehe: "400",
    schraege_text: "",
    konfig_comment: "",
    anzahl: "1",
  };
  const io = JSON.stringify({
    name: "buildConfiguration",
    params: [params],
  });
  return `io=${encodeURIComponent(io)}`;
}

// Proxy zum JTL-Endpoint, damit wir die gleiche Konfiguration bekommen wie im Original-Shop
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const urlParams = parseMirrorUrlParams(url.searchParams);
    const token =
      urlParams.jtlToken ||
      readEnvTrim("JTL_TOKEN") ||
      DEFAULT_JTL_TOKEN;
    const { artikelId, articalNumber } = resolveProductIds(
      urlParams.artikelId,
      urlParams.articalNumber
    );
    const sizeKonfigItem = resolveSizeKonfigItem(urlParams);

    const sidCookie = cookieFromSid(urlParams.sessionId);
    const outboundCookie =
      remoteCookieHeader ||
      readEnvTrim("JTL_COOKIE") ||
      sidCookie;
    const cookieStats = cookieHeaderStats(outboundCookie);

    const res = await fetch(IO_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Authorization: IO_AUTHORIZATION,
        ...BROWSER_LIKE_HEADERS,
        ...(outboundCookie ? { Cookie: outboundCookie } : {}),
      },
      body: buildBuildConfigurationIoBody(
        token,
        artikelId,
        articalNumber,
        sizeKonfigItem
      ),
    });

    if (!res.ok) {
      console.error(
        "Remote config request failed:",
        res.status,
        res.statusText
      );
      return NextResponse.json(
        { error: "Remote config request failed", status: res.status },
        { status: 500 }
      );
    }

    console.log("[jtl] GET buildConfiguration remote status:", res.status);
    const setCookies = extractSetCookieHeaders(res);
    if (setCookies.length) {
      remoteCookieHeader = mergeSetCookiesIntoHeader(
        remoteCookieHeader,
        setCookies
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "x-jtl-remote-url": IO_ENDPOINT,
        // Клієнт не читає .env — той самий токен, що використав проксі для цього GET
        "x-jtl-token": token,
        // Чи сервер надіслав Cookie до JTL (у запиті до localhost їх не видно — вони додаються тут)
        "x-jtl-outbound-cookie": cookieStats.sent ? "yes" : "no",
        "x-jtl-outbound-cookie-pairs": String(cookieStats.pairCount),
      },
    });
  } catch (e) {
    console.error("Failed to fetch remote config", e);
    return NextResponse.json(
      { error: "Failed to fetch remote config" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const rawReqBody = await req.text();
    if (!rawReqBody?.trim()) {
      return NextResponse.json(
        { error: "Invalid body: empty request body" },
        { status: 400 }
      );
    }

    let input: any;
    try {
      input = JSON.parse(rawReqBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid body: expected JSON payload" },
        { status: 400 }
      );
    }

    const ioBody: string | undefined = input?.ioBody;
    if (!ioBody || typeof ioBody !== "string") {
      return NextResponse.json(
        { error: "Invalid body: expected { ioBody: string }" },
        { status: 400 }
      );
    }

    const outboundCookie = remoteCookieHeader;
    const cookieStats = cookieHeaderStats(outboundCookie);

    const res = await fetch(IO_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Authorization: IO_AUTHORIZATION,
        ...BROWSER_LIKE_HEADERS,
        ...(outboundCookie ? { Cookie: outboundCookie } : {}),
      },
      body: ioBody,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Remote config request failed",
          status: res.status,
          bodyPreview: text.slice(0, 500),
        },
        { status: 500 }
      );
    }

    console.log("[jtl] POST load_konfig remote status:", res.status);
    const setCookies = extractSetCookieHeaders(res);
    if (setCookies.length) {
      remoteCookieHeader = mergeSetCookiesIntoHeader(
        remoteCookieHeader,
        setCookies
      );
    }

    const rawRemoteBody = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(rawRemoteBody);
    } catch {
      data = { raw: rawRemoteBody };
    }
    return NextResponse.json(data, {
      headers: {
        "x-jtl-remote-url": IO_ENDPOINT,
        "x-jtl-outbound-cookie": cookieStats.sent ? "yes" : "no",
        "x-jtl-outbound-cookie-pairs": String(cookieStats.pairCount),
      },
    });
  } catch (e) {
    console.error("POST /api/config failed", e);
    return NextResponse.json(
      { error: "Failed to fetch remote config" },
      { status: 500 }
    );
  }
}
