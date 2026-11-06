// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://codervipul775.vercel.app',
  integrations: [react(), sitemap({ filter: (page) => !page.includes('/admin') })],
  image: {
    // Images uploaded from /admin live in Supabase Storage; they're downloaded
    // and optimized at build time, so visitors never hit Supabase directly.
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
