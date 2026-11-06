import type { APIRoute } from 'astro';

export const prerender = false;

// Called daily by Vercel Cron (vercel.json) so the free Supabase project never
// pauses for inactivity, which would make the next publish's build fail.
export const GET: APIRoute = async () => {
  const res = await fetch(`${import.meta.env.PUBLIC_SUPABASE_URL}/rest/v1/site_content?id=eq.published&select=updated_at`, {
    headers: { apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
  });
  return new Response(res.ok ? 'ok' : `Supabase returned ${res.status}`, { status: res.ok ? 200 : 502 });
};
