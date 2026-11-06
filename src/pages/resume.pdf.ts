import type { APIRoute } from 'astro';
import { getContent } from '../data/load';

// Copies the resume into the build, so /resume.pdf is served from Vercel's CDN
// and the link stays the same whenever a new resume is uploaded from /admin.
export const GET: APIRoute = async () => {
  const { site } = await getContent();
  if (!site.resumeUrl) return new Response('No resume uploaded yet.', { status: 404 });

  const res = await fetch(site.resumeUrl);
  if (!res.ok) throw new Error(`Couldn't download the resume (${res.status}) from ${site.resumeUrl}`);
  return new Response(await res.arrayBuffer(), { headers: { 'Content-Type': 'application/pdf' } });
};
