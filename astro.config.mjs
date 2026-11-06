// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://codervipul775.vercel.app',
  // Pages are static by default; only /api/* and /preview run as serverless functions.
  adapter: vercel(),
  integrations: [react(), sitemap({ filter: (page) => !/\/(admin|preview|api)/.test(page) })],
  env: {
    schema: {
      // Vercel → Settings → Git → Deploy Hooks. Secret: only ever read on the server.
      VERCEL_DEPLOY_HOOK_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  image: {
    // Images uploaded from /admin live in Supabase Storage; they're downloaded
    // and optimized at build time, so visitors never hit Supabase directly.
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  // One page, so inlining the CSS saves a render-blocking request.
  build: { inlineStylesheets: 'always' },
  vite: {
    plugins: [tailwindcss()],
    // three.js is one large chunk by nature; it's lazy-loaded after the page is up.
    build: { chunkSizeWarningLimit: 600 },
  },
});
