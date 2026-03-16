# CineCircle Agent Workflow

This repo deploys from GitHub to Vercel. Future agent work must keep Git history, Prisma artifacts, and deployment state reproducible from the repository alone.

## Required Git Flow

1. Start from a clean worktree. Run `git status --short` before making changes.
2. Sync `main` before feature work:
   - `git fetch origin`
   - `git switch main`
   - `git pull --ff-only`
3. Create a short-lived branch for every change.
4. Before committing, run:
   - `git status --short`
   - `git diff --stat`
   - `npm run verify`
5. Commit only intended files. Do not bundle unrelated local changes.

## Prisma Rules

- Treat Prisma as migrations-first.
- If `prisma/schema.prisma` changes:
  - run `npm run db:dev -- --name <migration-name>`
  - run `npm run prisma:generate`
  - commit the new folder under `prisma/migrations/`
  - commit the updated `generated/prisma/` output
- Do not use `db:push` for normal feature work. It is only a local escape hatch.

## Env Rules

- Never commit `.env`, `.env.local`, or `.env.vercel`.
- Keep `.env.example` in sync with any change to `src/env.js`.
- If you need Vercel-managed env vars locally, pull them into `.env.vercel` and start the app with `npm run dev:vercel`.

## Verification Rules

- Default pre-commit verification: `npm run verify`
- If you change build-time behavior or env handling, also run `npm run build` with valid env vars.
- If you change UI behavior, include screenshots or a short note in the PR describing what changed.

## GitHub / Vercel Expectations

- Open a PR for every non-emergency change.
- CI must stay green before merge.
- Vercel preview deployments should be reviewed for UI-facing work.
