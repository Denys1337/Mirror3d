import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL =
  "https://www.schreiber-design.com/templates/SchreiberSD/product_attributes";

export async function GET(
  _req: Request,
  context: { params: { id: string } }
) {
  try {
    const rawId = context.params.id?.trim() || "";
    if (!/^\d+$/.test(rawId)) {
      return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
    }

    const remoteUrl = `${BASE_URL}/${rawId}.json`;
    const remoteRes = await fetch(remoteUrl, {
      headers: {
        Accept: "application/json,text/plain,*/*",
      },
      cache: "no-store",
    });

    if (!remoteRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch product attributes", status: remoteRes.status },
        { status: 502 }
      );
    }

    const payload = await remoteRes.json();
    return NextResponse.json(payload, {
      headers: {
        "x-product-attributes-url": remoteUrl,
      },
    });
  } catch (error) {
    console.error("Failed to fetch product attributes", error);
    return NextResponse.json(
      { error: "Failed to fetch product attributes" },
      { status: 500 }
    );
  }
}
