import https from "node:https";
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    val = val.replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const auth = Buffer.from(
  `${process.env.JTL_BASIC_USER}:${process.env.JTL_BASIC_PASS}`,
  "utf8"
).toString("base64");
const cookie = process.env.JTL_COOKIE || "";
const token = process.env.JTL_TOKEN || "";
const agent = new https.Agent({ rejectUnauthorized: false });

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          agent,
          headers: {
            Authorization: `Basic ${auth}`,
            Cookie: cookie,
            "User-Agent": "Mozilla/5.0",
          },
        },
        (r) => {
          let d = "";
          r.on("data", (c) => (d += c));
          r.on("end", () => resolve({ status: r.statusCode, body: d }));
        }
      )
      .on("error", reject);
  });
}

function postIo(ioObj) {
  const body = `io=${encodeURIComponent(JSON.stringify(ioObj))}`;
  return new Promise((resolve, reject) => {
    const req = https.request(
      "https://test.schreiber-design.com/io",
      {
        method: "POST",
        agent,
        headers: {
          Authorization: `Basic ${auth}`,
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch {
            reject(new Error(d.slice(0, 300)));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function extractResponse(data) {
  const assigns = data?.varAssigns;
  if (Array.isArray(assigns)) {
    const response = assigns.find((v) => v.name === "response")?.value;
    return response;
  }
  return data?.response;
}

function activeSelections(groups) {
  const out = [];
  for (let i = 1; i < groups.length; i++) {
    const g = groups[i];
    const title = g.oSprache?.cName || g.cKommentar || `g${g.kKonfiggruppe}`;
    const active = g.oItem_arr?.filter((it) => it.bAktiv) || [];
    if (!active.length) continue;
    out.push({
      kg: g.kKonfiggruppe,
      title: title.replace(/<[^>]+>/g, "").trim().slice(0, 60),
      items: active.map((it) => ({
        id: it.kKonfigitem,
        name: (it.cName || "").replace(/<[^>]+>/g, "").trim().slice(0, 80),
        price: it.fPreis?.[0],
      })),
    });
  }
  return out;
}

const pageUrl =
  "https://test.schreiber-design.com/spiegel/p/badspiegel-florenz-led-4s-optimal-mit-rahmen_18";
const { status, body } = await get(pageUrl);
console.log("page status", status);

const idHints = [];
for (const re of [
  /data-kartikel=["'](\d+)/gi,
  /artical_number['":\s]+(\d+)/gi,
  /product_attributes\/(\d+)\.json/gi,
  /kArtikel['":\s]+(\d+)/gi,
  /"a"\s*:\s*(\d+)/g,
]) {
  for (const m of body.matchAll(re)) idHints.push(m[1]);
}
console.log("id hints", [...new Set(idHints)].slice(0, 20));

const pageTokenMatch = body.match(
  /name="jtl_token"\s+value="([a-f0-9]+)"/i
);
const pageToken = pageTokenMatch?.[1] || token;
console.log("page token", pageToken.slice(0, 12) + "...");
const artikelId = "41974";
const articalNumber = "26034";
console.log("using artikelId", artikelId, "articalNumber", articalNumber);

if (!artikelId || !articalNumber) {
  console.log("Could not parse product ids from page");
  process.exit(1);
}

const attrsRes = await get(
  `https://test.schreiber-design.com/templates/SchreiberSD/product_attributes/${articalNumber}.json`
);
let attrs = null;
try {
  attrs = JSON.parse(attrsRes.body);
  console.log("attrs", {
    mir_type: attrs.mir_type,
    str_type: attrs.str_type,
    mir_model: attrs.mir_model,
    str_widt: attrs.str_widt,
  });
} catch {
  console.log("attrs fetch failed", attrsRes.body.slice(0, 120));
}

async function runScenario(label, buildParams) {
  const initial = await postIo({ name: "buildConfiguration", params: [buildParams] });
  const initialResp = extractResponse(initial);
  console.log(`\n=== ${label} ===`);
  console.log("summ", initialResp?.summ, "valid", initialResp?.valid);
  const groups = initialResp?.oKonfig_arr || [];

  const opt = groups.slice(1);
  const item = { ...buildParams.item };
  for (let i = 0; i < opt.length; i++) {
    const g = opt[i];
    const kg = g.kKonfiggruppe;
    if (kg == null) continue;
    const active = g.oItem_arr.filter((it) => it.bAktiv);
    if (g.nMax === 1 && active.length > 0) {
      item[String(kg)] = { "0": String(active[0].kKonfigitem) };
    } else if (active.length > 0) {
      const slot = {};
      active.forEach((it, j) => {
        slot[String(j)] = String(it.kKonfigitem);
      });
      item[String(kg)] = slot;
    }
  }

  const fullParams = { ...buildParams, item };
  const full = await postIo({ name: "buildConfiguration", params: [fullParams] });
  const fullResp = extractResponse(full);
  console.log("full summ", fullResp?.summ, "valid", fullResp?.valid);
  if (!fullResp) {
    console.log("raw keys", Object.keys(full || {}));
  }
  if (fullResp?.valid === false) {
    console.log("errors", fullResp?.cFehler || fullResp?.error || full);
  }
  const picks = activeSelections(fullResp?.oKonfig_arr || []);
  for (const p of picks) {
    const prices = p.items
      .map((it) => `${it.name.slice(0, 50)} [${it.price ?? 0}€]`)
      .join(" | ");
    console.log(`- [${p.kg}] ${p.title}: ${prices}`);
  }
  return fullResp?.summ;
}

const sizeItem = "1155";

function baseParams(overrides = {}) {
  return {
    jtl_token: pageToken,
    inWarenkorb: "1",
    a: artikelId,
    wke: "1",
    show: "1",
    kKundengruppe: "3",
    kSprache: "1",
    eigenschaftwert: { "1601": "", "1602": "" },
    artical_number: articalNumber,
    data_file_exist: "0",
    mir_type: attrs?.mir_type || "",
    str_type: attrs?.str_type || "",
    mir_model: attrs?.mir_model || "",
    str_widt: attrs?.str_widt || "",
    str_vert_bside: attrs?.str_vert_bside || "",
    str_vert_top: attrs?.str_vert_top || "",
    str_vert_btm: attrs?.str_vert_btm || "",
    str_hori_bside: attrs?.str_hori_bside || "",
    str_hori_top: attrs?.str_hori_top || "",
    str_hori_btm: attrs?.str_hori_btm || "",
    shining_sid: attrs?.shining_sid || "",
    item: { "249": { "0": sizeItem } },
    customSizeConfigItem: sizeItem,
    customSizeConfigGroup: "249",
    breite: "400",
    hoehe: "400",
    schraege_text: "",
    konfig_comment: "",
    anzahl: "1",
    ...overrides,
  };
}

const s1 = await runScenario("ORIGINAL-LIKE (data_file_exist=0, empty lighting)", baseParams());
const s2 = await runScenario(
  "MIRROR3D-LIKE (data_file_exist=1, comfort defaults)",
  baseParams({
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
  })
);
const s3 = await runScenario(
  "MIRROR3D + correct attrs",
  baseParams({
    data_file_exist: "1",
    mir_type: attrs?.mir_type || "square",
    str_type: attrs?.str_type || "xside",
    mir_model: attrs?.mir_model || "comfort",
    str_widt: attrs?.str_widt || "30",
    str_vert_bside: attrs?.str_vert_bside || "40",
    str_vert_top: attrs?.str_vert_top || "60",
    str_vert_btm: attrs?.str_vert_btm || "60",
    str_hori_bside: attrs?.str_hori_bside || "0",
    str_hori_top: attrs?.str_hori_top || "0",
    str_hori_btm: attrs?.str_hori_btm || "0",
    shining_sid: attrs?.shining_sid || "no",
  })
);

console.log("\n=== SUMMARY ===");
console.log("original-like:", s1);
console.log("mirror3d wrong defaults:", s2);
console.log("mirror3d correct attrs:", s3);
