// Dynamic Open Graph meta server for product share links.
// Fetches product info from public Firestore (settings/site) and returns
// HTML with OG/Twitter meta tags. Browsers are auto-redirected to the SPA route.
//
// Usage:
//   https://<project>.supabase.co/functions/v1/og-product?id=<productId>
//   https://<project>.supabase.co/functions/v1/og-product?id=<productId>&to=<siteOrigin>
//
// Optional `to` overrides the redirect target origin. Defaults to https://hightxclient.com

const FIREBASE_PROJECT_ID = "hightxclient";
const DEFAULT_ORIGIN = "https://hightxclient.com";
const DEFAULT_BRAND = "HightXClient";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Firestore REST returns {fields:{key:{stringValue|integerValue|...}}}
function fsValue(v: any): any {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fsValue);
  if ("mapValue" in v) {
    const out: any = {};
    const fields = v.mapValue.fields || {};
    for (const k of Object.keys(fields)) out[k] = fsValue(fields[k]);
    return out;
  }
  if ("timestampValue" in v) return v.timestampValue;
  return null;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isCrawler(ua: string): boolean {
  return /facebookexternalhit|facebot|twitterbot|discordbot|slackbot|linkedinbot|telegrambot|whatsapp|line\/|skypeuripreview|googlebot|bingbot|embedly|pinterest|redditbot|applebot|vkshare/i.test(ua);
}

function buildHtml(opts: {
  title: string;
  description: string;
  image: string;
  url: string;
  redirectUrl: string;
  brand: string;
  price?: number;
  redirectImmediately: boolean;
}): string {
  const { title, description, image, url, redirectUrl, brand, price, redirectImmediately } = opts;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(image);
  const u = escapeHtml(url);
  const r = escapeHtml(redirectUrl);
  const b = escapeHtml(brand);
  const refresh = redirectImmediately ? `<meta http-equiv="refresh" content="0;url=${r}" />` : "";
  const priceMeta = price && price > 0
    ? `<meta property="product:price:amount" content="${price}" />\n<meta property="product:price:currency" content="THB" />`
    : "";

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${r}" />

<meta property="og:type" content="product" />
<meta property="og:site_name" content="${b}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${u}" />
${img ? `<meta property="og:image" content="${img}" />\n<meta property="og:image:secure_url" content="${img}" />` : ""}
${priceMeta}

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
${img ? `<meta name="twitter:image" content="${img}" />` : ""}

${refresh}
</head>
<body style="font-family:system-ui,sans-serif;background:#0b0b14;color:#fff;margin:0;padding:24px;">
<div style="max-width:560px;margin:48px auto;text-align:center;">
${img ? `<img src="${img}" alt="${t}" style="max-width:100%;border-radius:16px;margin-bottom:16px;" />` : ""}
<h1 style="margin:0 0 8px;font-size:22px;">${t}</h1>
<p style="opacity:.8;margin:0 0 16px;">${d}</p>
<a href="${r}" style="display:inline-block;padding:12px 24px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-weight:600;">เปิดสินค้า</a>
</div>
<script>setTimeout(function(){location.replace(${JSON.stringify(redirectUrl)});}, 50);</script>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Accept ?id= or trailing path segment
    let productId = url.searchParams.get("id") || "";
    if (!productId) {
      const segs = url.pathname.split("/").filter(Boolean);
      productId = segs[segs.length - 1] || "";
      if (productId === "og-product") productId = "";
    }
    const targetOrigin = (url.searchParams.get("to") || DEFAULT_ORIGIN).replace(/\/$/, "");

    if (!productId) {
      return new Response("Missing product id", { status: 400, headers: corsHeaders });
    }

    // Fetch settings/site from public Firestore REST
    const fsUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/site`;
    const fsRes = await fetch(fsUrl);
    if (!fsRes.ok) {
      return new Response("Failed to load settings", { status: 200, headers: corsHeaders });
    }
    const fsDoc = await fsRes.json();
    const data = fsValue({ mapValue: { fields: fsDoc.fields } }) || {};
    const products: any[] = Array.isArray(data.products) ? data.products : [];
    const product = products.find((p) => p && p.id === productId);

    const brand = data.brandName || DEFAULT_BRAND;
    const redirectUrl = `${targetOrigin}/product/${encodeURIComponent(productId)}`;
    const ua = req.headers.get("user-agent") || "";
    const crawler = isCrawler(ua);

    let title: string;
    let description: string;
    let image: string;
    let price: number | undefined;

    if (product) {
      title = product.ogTitle?.trim() || `${product.name} — ${brand}`;
      description = product.ogDescription?.trim() || product.description || `สินค้า ${product.name} จาก ${brand}`;
      // ใช้รูปสินค้าอัตโนมัติเป็นค่า default; ถ้าตั้ง ogUseProductImage = false และมี ogImage ให้ใช้รูปกำหนดเอง
      const useProductImg = product.ogUseProductImage !== false;
      image = useProductImg
        ? (product.imageUrl || product.ogImage || data.ogImage || "")
        : (product.ogImage || product.imageUrl || data.ogImage || "");
      const durations: any[] = Array.isArray(product.durations) ? product.durations : [];
      const prices = durations.map((d) => Number(d?.price) || 0).filter((n) => n > 0);
      if (prices.length) price = Math.min(...prices);
    } else {
      title = brand;
      description = data.ogDescription || "แหล่งรวมคีย์โปรแกรมเสริมเกมระดับพรีเมียม";
      image = data.ogImage || "";
    }

    const html = buildHtml({
      title,
      description,
      image,
      url: url.toString(),
      redirectUrl,
      brand,
      price,
      // crawlers: no meta-refresh (let them read tags). browsers: redirect immediately.
      redirectImmediately: !crawler,
    });

    const headers = new Headers();
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "public, max-age=300, s-maxage=600");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("X-Robots-Tag", "all");
    return new Response(html, { status: 200, headers });
  } catch (e) {
    return new Response(`Error: ${(e as Error).message}`, { status: 200, headers: corsHeaders });
  }
});
