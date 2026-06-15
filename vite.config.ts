import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// ----------------------------------------------------------------------------
// Prerender per-product OG meta tags into static HTML files at build time.
// Solves the Supabase edge-function content-type/CSP limitation that prevents
// dynamic OG from working when product links are pasted into Facebook/Discord/LINE.
//
// For each product in Firestore (public `settings/site` doc), we emit
// `dist/product/<id>.html` and `dist/product/<id>/index.html` cloned from
// `dist/index.html` with the OG/Twitter meta tags rewritten.
// ----------------------------------------------------------------------------
function prerenderProductOg(): Plugin {
  const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "hightxclient";
  const SITE_ORIGIN = (process.env.VITE_SITE_ORIGIN || "https://hightxclient.com").replace(/\/$/, "");

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

  function renderHtml(template: string, opts: {
    title: string; description: string; image: string; url: string; brand: string;
  }): string {
    const { title, description, image, url, brand } = opts;
    const t = escapeHtml(title);
    const d = escapeHtml(description);
    const img = escapeHtml(image);
    const u = escapeHtml(url);
    let html = template;
    // <title>
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${t}</title>`);
    // canonical
    html = html.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${u}" />`);
    // basic description
    html = html.replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${d}" />`);
    // OG
    html = html.replace(/<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${t}" />`);
    html = html.replace(/<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${d}" />`);
    html = html.replace(/<meta\s+property="og:type"[^>]*>/i, `<meta property="og:type" content="product" />`);
    html = html.replace(/<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${u}" />`);
    if (img) {
      html = html.replace(/<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${img}" />\n    <meta property="og:image:secure_url" content="${img}" />`);
    }
    // Twitter
    html = html.replace(/<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${t}" />`);
    html = html.replace(/<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${d}" />`);
    if (img) {
      html = html.replace(/<meta\s+name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${img}" />`);
    }
    return html;
  }

  return {
    name: "prerender-product-og",
    apply: "build",
    async closeBundle() {
      try {
        const distDir = path.resolve(__dirname, "dist");
        const indexFile = path.join(distDir, "index.html");
        if (!fs.existsSync(indexFile)) {
          console.warn("[prerender-product-og] dist/index.html not found, skipping");
          return;
        }
        const template = fs.readFileSync(indexFile, "utf8");

        const fsUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/site`;
        const res = await fetch(fsUrl);
        if (!res.ok) {
          console.warn(`[prerender-product-og] firestore fetch failed: ${res.status}`);
          return;
        }
        const doc = (await res.json()) as { fields?: Record<string, unknown> };
        const data = fsValue({ mapValue: { fields: doc.fields || {} } }) || {};
        const products: any[] = Array.isArray(data.products) ? data.products : [];
        const brand = data.brandName || "HightXClient";
        const fallbackImage = data.ogImage || "";
        // ใช้ ogSiteUrl ที่แอดมินตั้งค่าไว้ใน Firestore เป็นอันดับแรก, ไม่งั้น fallback ไป env
        const siteOrigin = (typeof data.ogSiteUrl === "string" && data.ogSiteUrl.trim()
          ? data.ogSiteUrl.trim()
          : SITE_ORIGIN
        ).replace(/\/$/, "");

        // Normalize image URL to be ABSOLUTE so crawlers can fetch it.
        // Accepts: full https URL (kept as-is), protocol-relative `//...` (prefixed https:),
        // root-relative `/foo.jpg` (prefixed with SITE_ORIGIN), or bare `foo.jpg` (prefixed with SITE_ORIGIN/).
        const toAbsoluteUrl = (raw: string): string => {
          const s = String(raw || "").trim();
          if (!s) return "";
          if (/^https?:\/\//i.test(s)) return s;
          if (s.startsWith("//")) return `https:${s}`;
          if (s.startsWith("/")) return `${siteOrigin}${s}`;
          return `${siteOrigin}/${s}`;
        };

        let count = 0;
        for (const p of products) {
          if (!p || !p.id) continue;
          const useProductImg = p.ogUseProductImage !== false;
          const rawImage = useProductImg
            ? (p.imageUrl || p.ogImage || fallbackImage || "")
            : (p.ogImage || p.imageUrl || fallbackImage || "");
          const image = toAbsoluteUrl(rawImage);
          const title = (p.ogTitle && String(p.ogTitle).trim()) || `${p.name} — ${brand}`;
          const description = (p.ogDescription && String(p.ogDescription).trim())
            || p.description
            || `สินค้า ${p.name} จาก ${brand}`;
          const url = `${siteOrigin}/product/${encodeURIComponent(p.id)}`;
          const html = renderHtml(template, { title, description, image, url, brand });

          // Emit BOTH /product/<id>.html and /product/<id>/index.html so the
          // hosting layer serves the prerendered HTML regardless of trailing slash.
          const dirPath = path.join(distDir, "product", String(p.id));
          fs.mkdirSync(dirPath, { recursive: true });
          fs.writeFileSync(path.join(dirPath, "index.html"), html, "utf8");
          fs.writeFileSync(path.join(distDir, "product", `${p.id}.html`), html, "utf8");
          count++;
        }
        console.log(`[prerender-product-og] emitted OG HTML for ${count} product(s)`);
      } catch (e) {
        console.warn("[prerender-product-og] error:", (e as Error).message);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "production" && prerenderProductOg(),
  ].filter(Boolean) as Plugin[],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
