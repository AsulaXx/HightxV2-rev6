// Generates public/sitemap.xml from VITE_SITE_URL + route list.
// Runs before `vite dev` and `vite build` via package.json hooks.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load VITE_SITE_URL from .env (Vite ไม่ได้ inject ให้ node scripts)
function loadEnv() {
  const envPath = resolve(__dirname, "..", ".env");
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const env = { ...loadEnv(), ...process.env };
const BASE_URL = (env.VITE_SITE_URL || "https://dev-hightx.web.app").replace(/\/+$/, "");

/** @type {{ path: string; changefreq?: string; priority?: string }[]} */
const entries = [
  { path: "/",                     changefreq: "daily",   priority: "1.0" },
  { path: "/store",                changefreq: "daily",   priority: "0.9" },
  { path: "/hub",                  changefreq: "weekly",  priority: "0.7" },
  { path: "/wheel",                changefreq: "weekly",  priority: "0.7" },
  { path: "/leaderboard",          changefreq: "daily",   priority: "0.6" },
  { path: "/referral-leaderboard", changefreq: "daily",   priority: "0.6" },
  { path: "/announcements",        changefreq: "weekly",  priority: "0.5" },
  { path: "/links",                changefreq: "weekly",  priority: "0.5" },
  { path: "/status",               changefreq: "hourly",  priority: "0.4" },
  { path: "/terms",                changefreq: "monthly", priority: "0.3" },
  { path: "/login",                changefreq: "monthly", priority: "0.3" },
];

const today = new Date().toISOString().slice(0, 10);

const xml = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ...entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ].filter(Boolean).join("\n"),
  ),
  `</urlset>`,
  ``,
].join("\n");

const out = resolve(__dirname, "..", "public", "sitemap.xml");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, xml);
console.log(`sitemap.xml written (${entries.length} entries) → ${BASE_URL}`);
