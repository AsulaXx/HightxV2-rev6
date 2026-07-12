// Generates public/robots.txt from VITE_SITE_URL.
// Runs before `vite dev` and `vite build` via package.json hooks.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const disallow = [
  "/admin", "/admin/",
  "/dashboard", "/analytics", "/keys", "/stock", "/permissions",
  "/profile", "/activity-log", "/archived-keys",
  "/all-claims", "/all-topup", "/all-wheel", "/all-history", "/history",
  "/wallet", "/topup", "/customer-balances", "/banned-users",
  "/wheel-history", "/attempt-status", "/product-status",
  "/referral", "/setup-guide",
  "/Ruzien-bypass-uid", "/ruzien-bypass-uid",
  "/l/", "/links/analytics",
];

const socialBots = ["Twitterbot", "facebookexternalhit", "LinkedInBot", "Slackbot", "Discordbot"];

const txt = [
  `# robots.txt — ${BASE_URL}`,
  `# Allow all crawlers on public pages, block admin/account/internal routes.`,
  ``,
  `User-agent: *`,
  `Allow: /`,
  ...disallow.map((p) => `Disallow: ${p}`),
  ``,
  `# Social preview crawlers — allow everything (needed for og:image scraping)`,
  ...socialBots.flatMap((b) => [`User-agent: ${b}`, `Allow: /`, ``]),
  `Sitemap: ${BASE_URL}/sitemap.xml`,
  ``,
].join("\n");

const out = resolve(__dirname, "..", "public", "robots.txt");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, txt);
console.log(`robots.txt written → ${BASE_URL}`);
