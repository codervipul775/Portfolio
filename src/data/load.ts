import seed from './seed.json';
import { contentSchema, type Content } from './schema';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let content: Promise<Content> | undefined;

/**
 * The published site content: from Supabase when it's configured, otherwise the
 * bundled seed. Fetched once per build.
 */
export function getContent() {
  content ??= load();
  return content;
}

async function load(): Promise<Content> {
  if (!supabaseUrl || !supabaseKey) {
    console.info('[content] Supabase not configured, using src/data/seed.json');
    return contentSchema.parse(seed);
  }

  // Failing the build here is deliberate: Vercel keeps the last good deployment
  // live, whereas falling back to the seed would silently publish stale content.
  const res = await fetch(`${supabaseUrl}/rest/v1/site_content?id=eq.published&select=data`, {
    headers: { apikey: supabaseKey },
  });
  if (!res.ok) throw new Error(`Supabase returned ${res.status}: ${await res.text()}`);

  const rows: { data: unknown }[] = await res.json();
  if (!rows.length) throw new Error('No published content in Supabase. Run supabase/seed.sql first.');
  console.info(`[content] Using published content from ${supabaseUrl}`);
  return contentSchema.parse(rows[0].data);
}
