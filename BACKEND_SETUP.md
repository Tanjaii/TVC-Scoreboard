# Backend setup

The live scoreboard uses Vercel Node.js Functions, Neon Postgres, and Better Auth. Public clients read the match state from `/api/live-match` and refresh it every five seconds. Only signed-in users with the `admin` role can update it. Public account creation is disabled.

## Connect Vercel and Neon

1. Link this folder to the existing TVC Scoreboard Vercel project with `npx vercel link`. Confirm the selected account and project before accepting.
2. Add Neon to that project from the Vercel Marketplace (`npx vercel integration add neon`) and select the plan you want. Neon provides the `DATABASE_URL` connection variable.
3. Set `BETTER_AUTH_SECRET` in Vercel for the Development, Preview, and Production environments. Generate a unique secret locally with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   Store it in Vercel environment settings; do not commit it or paste it into source files.
4. For Production, set `BETTER_AUTH_URL` to the canonical HTTPS URL where the scoreboard is served. Leave it unset for Vercel Preview deployments so each preview can use its request URL.
5. Pull the Development variables into the ignored local environment file:

   ```powershell
   npx vercel env pull .env.local
   ```

## Initialize the database and first administrator

Run these from the linked project folder after `DATABASE_URL` and `BETTER_AUTH_SECRET` are available in `.env.local`:

```powershell
npm run auth:migrate
npm run db:migrate
npm run auth:create-admin
```

The first command creates Better Auth's PostgreSQL tables. The second creates the single live-match row. The final command interactively provisions an administrator; use a unique password of at least 12 characters. Repeat account provisioning only for individually invited administrators. Do not enable public sign-up or share one admin account.

## Run locally

Use Vercel's local runtime so `/api` functions and the Vite app run together:

```powershell
npm run dev:vercel
```

The plain `npm run dev` command starts only Vite; API-backed scoreboard and sign-in features require `npm run dev:vercel`.

## API

- `GET /api/live-match` returns the public match state with caching disabled.
- `PUT /api/live-match` requires a same-origin request and a valid administrator session. The server validates every field before saving.
- Better Auth serves sign-in and session endpoints under `/api/auth/*`.

Schema changes for auth are applied using `npm run auth:migrate`; live-match schema changes belong in `db/migrations/` and are applied using `npm run db:migrate`.
