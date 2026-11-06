// Supabase REST calls for server routes. Calls are made with the signed-in admin's
// token, so the database's own access rules decide what's allowed.

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);

/** The token from an `Authorization: Bearer …` header. */
export const bearerToken = (request: Request) => request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];

export function rpc(fn: string, token?: string) {
  return fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key!, 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: '{}',
  });
}

/** True only for a valid session belonging to someone in public.admins. */
export async function isAdmin(token: string) {
  if (!supabaseConfigured) return false;
  const res = await rpc('is_admin', token);
  return res.ok && (await res.json()) === true;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
