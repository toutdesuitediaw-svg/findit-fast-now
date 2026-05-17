// Generates public/sitemap.xml dynamically (homepage, static pages, categories, listings).
// Runs before `vite dev` and `vite build`.
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const BASE_URL = "https://www.toutsuitannonce.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Entry { loc: string; lastmod?: string; changefreq?: string; priority?: string }

const staticEntries: Entry[] = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/annonces", changefreq: "hourly", priority: "0.9" },
  { loc: "/annonces?sort=premium", changefreq: "daily", priority: "0.7" },
  { loc: "/auth", changefreq: "monthly", priority: "0.3" },
];

async function fetchJson(path: string): Promise<any[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function xml(entries: Entry[]) {
  const urls = entries
    .map((e) =>
      [
        "  <url>",
        `    <loc>${BASE_URL}${e.loc}</loc>`,
        e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
        e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
        e.priority ? `    <priority>${e.priority}</priority>` : null,
        "  </url>",
      ].filter(Boolean).join("\n"),
    ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function main() {
  const entries: Entry[] = [...staticEntries];

  const categories = await fetchJson("categories?select=slug");
  for (const c of categories) {
    if (c?.slug) entries.push({ loc: `/annonces?category=${encodeURIComponent(c.slug)}`, changefreq: "daily", priority: "0.8" });
  }

  const listings = await fetchJson("listings?select=id,updated_at,is_premium&is_active=eq.true&moderation_status=eq.approved&order=published_at.desc&limit=5000");
  for (const l of listings) {
    if (!l?.id) continue;
    entries.push({
      loc: `/annonce/${l.id}`,
      lastmod: l.updated_at ? new Date(l.updated_at).toISOString() : undefined,
      changefreq: "weekly",
      priority: l.is_premium ? "0.8" : "0.6",
    });
  }

  const out = resolve("public/sitemap.xml");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, xml(entries));
  console.log(`sitemap.xml written (${entries.length} entries)`);
}

main().catch((e) => { console.error("sitemap generation failed:", e); process.exit(0); });
