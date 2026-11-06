# Portfolio

Vipul Yadav's portfolio: [codervipul775.vercel.app](https://codervipul775.vercel.app)

Static [Astro](https://astro.build) site with a three.js WebGL background, GSAP + Lenis scroll animations, and content stored in Supabase, edited from `/admin`.

## Develop

Requires Node 24 (`nvm use`).

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # production build (Vercel output in .vercel/output)
npm run check    # type-check
```

Without a `.env`, the site builds from `src/data/seed.json`. Copy `.env.example` to `.env` and fill it in to build from Supabase instead.

## How content works

- All content is one JSON document. Its shape lives in `src/data/schema.ts`, shared by the site build and the admin editor.
- Supabase stores two copies: `draft` (what `/admin` edits) and `published` (what the build reads).
- Publishing in `/admin` copies draft → published and triggers a Vercel rebuild. Images are downloaded and optimized at build time, so visitors never hit Supabase.

## Admin (`/admin`)

Sign in with the Supabase admin user. Everything on the site is editable: text, images, resume, social links, and sections (add, delete, hide, drag to reorder).

- Edits autosave to the draft (Ctrl/Cmd+S saves immediately). The live site doesn't change until you publish.
- **Preview** opens the current draft rendered with the real site components.
- **Publish** makes the draft live; the site rebuilds in about a minute. Every publish is kept under **Version history**.
- Publishing from `npm run dev` updates the real published content too, but doesn't rebuild the live site.

Server routes (Vercel functions): `/api/publish`, `/preview`, and `/api/keepalive`, which Vercel Cron calls daily so the free Supabase project never pauses.

## Supabase setup (one time)

1. Create a Supabase project.
2. SQL Editor: run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Authentication → Sign In / Providers: turn off **Allow new users to sign up**.
4. Authentication → Users → **Add user**: your email and password, with **Auto Confirm User** checked.
5. SQL Editor: make that user the admin:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
6. Put the project URL and publishable key in `.env`.

If you change `src/data/seed.json`, regenerate the SQL with `npm run seed:sql`.

## Vercel setup (before deploying)

1. Settings → Environment Variables, for Production and Preview: `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Settings → Git → Deploy Hooks: create one for `main` (and one for any branch you want to test publishing on).
3. Add `VERCEL_DEPLOY_HOOK_URL` with that hook's URL for each environment. Keep it secret: anyone with it can trigger rebuilds.
