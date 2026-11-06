import type { APIRoute } from 'astro';
import { VERCEL_DEPLOY_HOOK_URL } from 'astro:env/server';
import { bearerToken, json, rpc, supabaseConfigured } from '../../lib/supabase-server';

export const prerender = false;

// Copies the draft to published, then asks Vercel to rebuild the site with it.
export const POST: APIRoute = async ({ request }) => {
  const token = bearerToken(request);
  if (!token) return json({ error: 'Not signed in.' }, 401);
  if (!supabaseConfigured) return json({ error: 'Supabase is not configured on the server.' }, 500);

  // publish_content() itself refuses anyone who isn't an admin.
  const res = await rpc('publish_content', token);
  if (!res.ok) {
    const denied = res.status === 401 || res.status === 403;
    return json({ error: denied ? 'Your session expired or this account is not an admin.' : await res.text() }, denied ? 403 : 502);
  }
  const publishedAt: string = await res.json();

  if (!VERCEL_DEPLOY_HOOK_URL) return json({ publishedAt, deploy: 'skipped' });
  const hook = await fetch(VERCEL_DEPLOY_HOOK_URL, { method: 'POST' });
  return json({ publishedAt, deploy: hook.ok ? 'started' : 'failed' }, hook.ok ? 200 : 502);
};
