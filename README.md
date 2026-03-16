# CineCircle

CineCircle is a collaborative movie watchlist app built on the T3 stack. Users can sign in with Google or email magic links, create private watchlists, invite collaborators by email, search TMDB, and manage a shared queue with notes and watched status.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the human workflow and [AGENTS.md](AGENTS.md) for the repo rules future agents should follow.

## Stack

- Next.js App Router
- TypeScript
- tRPC
- Prisma + PostgreSQL
- Auth.js
- Tailwind CSS

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Start PostgreSQL locally:

```bash
./start-database.sh
```

3. Copy the example env file and fill in the missing values:

```bash
cp .env.example .env
```

Required secrets for the full app flow:

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `TMDB_API_KEY`
- `DATABASE_URL`

Optional: pull shared Vercel env vars for local development:

```bash
vercel env pull .env.vercel
```

4. Apply committed Prisma migrations:

```bash
npm run db:migrate
```

5. Start the dev server:

```bash
npm run dev
```

If you want to load both `.env` and `.env.vercel` locally, use:

```bash
npm run dev:vercel
```

## Useful commands

```bash
npm run prisma:generate
npm run db:dev -- --name <migration-name>
npm run check
npm run verify
npm test
npm run test:e2e
npm run build
```

`npm run build` requires production-style env vars. During verification, stub values are enough for Google, Resend, and TMDB because the build only needs schema-valid configuration.

## Production deployment

- Commit and keep the `prisma/migrations` directory in Git so Vercel can run real schema migrations.
- Commit and keep `generated/prisma` in Git whenever Prisma changes.
- For Vercel, use:

```bash
npm run vercel-build
```

- Set `DATABASE_URL` to a pooled PostgreSQL connection string in production. For Supabase, use the Supavisor session pooler rather than the direct `db.<project>.supabase.co:5432` host.
- Protect `main` in GitHub and require both CI and Vercel preview checks before merge.

## Product scope

- Private multi-list watchlists
- Email invite workflow with owner-managed membership
- TMDB-backed search and metadata snapshots
- Shared reorder, note, remove, and watched-state actions
- Minimal frontend intended for later styling
