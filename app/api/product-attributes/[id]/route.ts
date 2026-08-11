import { NextResponse } from "next/server";
import { jtlFetch } from "../../../../lib/jtlFetch";
import { JTL_SHOP_ORIGIN } from "../../../../lib/jtlShop";

export const runtime = "nodejs";

const BASE_URL = `${JTL_SHOP_ORIGIN}/templates/SchreiberSD/product_attributes`;

export async function GET(
  _req: Request,
  context: { params: { id: string } }
) {
  const rawId = context.params.id?.trim() || "";
  if (!/^\d+$/.test(rawId)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const remoteUrl = `${BASE_URL}/${rawId}.json`;

  try {
    const remoteRes = await jtlFetch(remoteUrl, {
      headers: {
        Accept: "application/json,text/plain,*/*",
        Referer: `${JTL_SHOP_ORIGIN}/spiegel/p/badspiegel-comfort-side-ledplus`,
        Origin: JTL_SHOP_ORIGIN,
      },
    });

    if (!remoteRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to fetch product attributes",
          status: remoteRes.status,
          url: remoteUrl,
        },
        { status: 502 }
      );
    }

    const payload = await remoteRes.json();
    return NextResponse.json(payload, {
      headers: { "x-product-attributes-url": remoteUrl },
    });
  } catch (error) {
    console.error("Failed to fetch product attributes", remoteUrl, error);
    return NextResponse.json(
      { error: "Failed to fetch product attributes", url: remoteUrl },
      { status: 502 }
    );
  }
}
