# TVC Volleyball Championship · Scoreboard

A live scoreboard built with **Next.js 16 + Neon Postgres**.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, React Server Components) |
| Database | Neon Postgres (serverless driver) |
| Auth | Custom — scrypt sessions + one-time invitation links |
| Tests | Node.js built-in test runner + PGlite (in-memory Postgres) + jsdom |
| Deployment | Vercel |

## Quick start

```bash
# 1. Install
npm install

# 2. Add a .env.local with your Neon connection string
cp .env.example .env.local

# 3. Create the schema
npm run db:migrate

# 4. Add the starter teams (optional — you can add teams in the admin area)
npm run seed:teams

# 5. Create the first admin invitation link
npm run admin:bootstrap
# → prints a one-time link to open in your browser

# 6. Dev server
npm run dev
```

## Running tests

```bash
npm test
```

## Deployment

```bash
vercel deploy --prod
```

Set `DATABASE_URL` and `SITE_URL` as environment variables in the Vercel dashboard.
After the first deployment, run `npm run admin:bootstrap` with `--env SITE_URL=https://your-domain.vercel.app`.

## Roles

| | Admin | Scorekeeper |
|---|---|---|
| Public scoreboard | ✓ | ✓ |
| Update live score, sets, stats | ✓ | ✓ |
| Start / stop broadcast | ✓ | ✓ |
| Create / edit / delete matches | ✓ | — |
| Manage teams | ✓ | — |
| Create invitation links | ✓ | — |

## Key design decisions

- **Drafts are always private.** Nothing reaches the public scoreboard until staff press Save. The broadcast toggle itself is a draft change.
- **Conflict detection.** Every save sends the version number it was based on. If another operator saved first, the server returns `409` with the newer data and a list of what differs. Staff choose to load the latest or keep their edits and overwrite deliberately.
- **One live match at a time.** Enforced by a database partial unique index on `status = 'live'`.
- **Invitation-only accounts.** There is no public sign-up. Administrators create one-time links from the Invitations page.
- **No third-party auth.** Sessions are stored as hashed tokens in Postgres. Passwords are hashed with scrypt (N=16384).
