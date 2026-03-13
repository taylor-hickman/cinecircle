# CineCircle

CineCircle is a collaborative movie watchlist app built on the T3 stack. Users can sign in with Google or email magic links, create private watchlists, invite collaborators by email, search TMDB, and manage a shared queue with notes and watched status.

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

4. Sync Prisma with the database:

```bash
npm run db:push
```

5. Start the dev server:

```bash
npm run dev
```

## Useful commands

```bash
npm run check
npm test
npm run test:e2e
npm run build
```

`npm run build` requires production-style env vars. During verification, stub values are enough for Google, Resend, and TMDB because the build only needs schema-valid configuration.

## Product scope

- Private multi-list watchlists
- Email invite workflow with owner-managed membership
- TMDB-backed search and metadata snapshots
- Shared reorder, note, remove, and watched-state actions
- Minimal frontend intended for later styling
