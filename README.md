# Portfolio

Vipul Yadav's portfolio: [codervipul775.vercel.app](https://codervipul775.vercel.app)

Static [Astro](https://astro.build) site with a React Three Fiber 3D scene, content managed from `/admin` and stored in Supabase.

## Develop

Requires Node 24 (`nvm use`).

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # production build into dist/
npm run check    # type-check
```

Without a `.env`, the site builds from `src/data/seed.json`. Copy `.env.example` to `.env` and fill it in to build from Supabase instead.

## How content works

- All content is one JSON document. Its shape lives in `src/data/schema.ts`, shared by the site build and the admin editor.
- Supabase stores two copies: `draft` (what `/admin` edits) and `published` (what the build reads).
- Publishing in `/admin` copies draft → published and triggers a Vercel rebuild. Images are downloaded and optimized at build time, so visitors never hit Supabase.

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
6. Put the project URL and publishable key in `.env`, and in Vercel → Settings → Environment Variables.

If you change `src/data/seed.json`, regenerate the SQL with `npm run seed:sql`.
