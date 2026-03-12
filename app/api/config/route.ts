import { NextResponse } from "next/server";

// Proxy zum JTL-Endpoint, damit wir die gleiche Konfiguration bekommen wie im Original-Shop
export async function GET() {
  try {
    const res = await fetch("https://test.schreiber-design.com/io", {
      method: "POST",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Authorization: "Basic c2Rfb3NjOm82aFBpQ3pCRTZra1Eh",
      },
      // Тіло взято з твого прикладу (buildConfiguration для artical_number=23582)
      body: "io=%7B%22name%22%3A%22buildConfiguration%22%2C%22params%22%3A%5B%7B%22jtl_token%22%3A%223a88fce1c166008a649780f6a7fa506fc7c012657e5dd24af0ad48ad655ad2b2%22%2C%22inWarenkorb%22%3A%221%22%2C%22a%22%3A%2217406%22%2C%22wke%22%3A%221%22%2C%22show%22%3A%221%22%2C%22kKundengruppe%22%3A%223%22%2C%22kSprache%22%3A%221%22%2C%22eigenschaftwert%22%3A%7B%221601%22%3A%22%22%2C%221602%22%3A%22%22%7D%2C%22artical_number%22%3A%2223582%22%2C%22data_file_exist%22%3A%221%22%2C%22mir_type%22%3A%22square%22%2C%22str_type%22%3A%22xside%22%2C%22mir_model%22%3A%22comfort%22%2C%22str_widt%22%3A%2230%22%2C%22str_vert_bside%22%3A%2240%22%2C%22str_vert_top%22%3A%2260%22%2C%22str_vert_btm%22%3A%2260%22%2C%22str_hori_bside%22%3A%220%22%2C%22str_hori_top%22%3A%220%22%2C%22str_hori_btm%22%3A%220%22%2C%22shining_sid%22%3A%22no%22%2C%22item%22%3A%7B%22249%22%3A%7B%220%22%3A%221155%22%7D%2C%22261%22%3A%7B%220%22%3A%221215%22%7D%2C%22288%22%3A%7B%220%22%3A%222584%22%7D%2C%22363%22%3A%7B%220%22%3A%221838%22%7D%7D%2C%22customSizeConfigItem%22%3A%221155%22%2C%22customSizeConfigGroup%22%3A%22249%22%2C%22breite%22%3A%22400%22%2C%22hoehe%22%3A%22400%22%2C%22schraege_text%22%3A%22%22%2C%22konfig_comment%22%3A%22%22%2C%22anzahl%22%3A%221%22%7D%5D%7D",
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

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("Failed to fetch remote config", e);
    return NextResponse.json(
      { error: "Failed to fetch remote config" },
      { status: 500 }
    );
  }
}
