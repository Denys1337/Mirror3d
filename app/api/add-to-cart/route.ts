import { NextResponse } from "next/server";
import type { AddToCartRequestBody } from "../../../lib/cartPayload";
import { jtlFetch, mergeSessionCookie, parseJsonFromJtlBody } from "../../../lib/jtlFetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_KONF_URL = "https://test.schreiber-design.com/data_konf.php";

function isValidCartBody(body: unknown): body is AddToCartRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as AddToCartRequestBody;
  return (
    typeof b.product === "string" &&
    /^\d+$/.test(b.product) &&
    typeof b.token === "string" &&
    b.token.length > 0 &&
    typeof b.sid === "string" &&
    b.sid.length > 0 &&
    typeof b.qty === "number" &&
    b.qty > 0 &&
    b.item_data != null &&
    typeof b.item_data === "object"
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidCartBody(body)) {
    return NextResponse.json(
      { error: "Invalid body: expected product, token, sid, qty, item_data" },
      { status: 400 }
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    Origin: "https://test.schreiber-design.com",
    Referer:
      "https://test.schreiber-design.com/spiegel/p/badspiegel-comfort-side-ledplus",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    Cookie: mergeSessionCookie(body.sid),
  };

  try {
    const remoteRes = await jtlFetch(DATA_KONF_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await remoteRes.text();
    const data = parseJsonFromJtlBody(text);

    if (!remoteRes.ok) {
      return NextResponse.json(
        {
          error: "data_konf.php failed",
          status: remoteRes.status,
          ...(typeof data === "object" && data ? (data as object) : {}),
          bodyPreview: text.slice(0, 500),
        },
        { status: 502 }
      );
    }

    if (data == null) {
      return NextResponse.json(
        {
          error: "Invalid response from data_konf.php",
          status: remoteRes.status,
          bodyPreview: text.slice(0, 500),
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("add-to-cart proxy error", error);
    return NextResponse.json(
      { error: "Failed to reach data_konf.php" },
      { status: 502 }
    );
  }
}
