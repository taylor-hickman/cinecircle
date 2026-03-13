import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { authProviderAvailability } from "~/server/auth/config";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/lists");
  }

  return (
    <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
      <div className="space-y-8">
        <div className="space-y-4">
          <p className="text-sm tracking-[0.24em] text-stone-400 uppercase">
            CineCircle
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Build a shared movie circle, invite people, and decide what to
            watch next.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-stone-300">
            This MVP focuses on the backend workflow: private lists, email
            invites, TMDB-powered search, and shared queue management. Styling
            stays intentionally sparse.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/api/auth/signin?callbackUrl=%2Flists"
            className="rounded-full bg-white px-5 py-3 font-medium text-stone-900 transition hover:bg-stone-200"
          >
            Open sign-in
          </Link>
          {authProviderAvailability.google ? (
            <Link
              href="/api/auth/signin/google?callbackUrl=%2Flists"
              className="rounded-full border border-white/15 px-5 py-3 font-medium text-white transition hover:border-white/30"
            >
              Continue with Google
            </Link>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-stone-300">
        <h2 className="text-lg font-semibold text-white">Provider status</h2>
        <dl className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <dt>Google OAuth</dt>
            <dd>
              {authProviderAvailability.google
                ? "Configured"
                : "Missing env vars"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>Email magic links</dt>
            <dd>
              {authProviderAvailability.email
                ? "Configured"
                : "Missing env vars"}
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-sm leading-7 text-stone-400">
          Configure `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`,
          `RESEND_FROM_EMAIL`, and `TMDB_API_KEY` before using the full flow.
        </p>
      </div>
    </section>
  );
}
