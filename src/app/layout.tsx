import "~/styles/globals.css";

import { type Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";

import { auth, signOut } from "~/server/auth";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "CineCircle",
  description:
    "Collaborative movie and TV watchlists for shared planning and discovery.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="min-h-screen bg-stone-950 text-stone-100 antialiased">
        <TRPCReactProvider>
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6">
            <header className="mb-10 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <Link
                  href="/"
                  className="text-lg font-semibold tracking-tight text-white"
                >
                  CineCircle
                </Link>
                <p className="text-sm text-stone-400">
                  Shared movie and TV lists, TMDB search, and invite-based
                  collaboration.
                </p>
              </div>

              <div className="flex items-center gap-3 text-sm">
                {session?.user ? (
                  <>
                    <Link
                      href="/lists"
                      className="rounded-full border border-white/15 px-4 py-2 text-stone-200 transition hover:border-white/30 hover:text-white"
                    >
                      Dashboard
                    </Link>
                    <span className="hidden text-stone-400 sm:inline">
                      {session.user.name ?? session.user.email}
                    </span>
                    <form
                      action={async () => {
                        "use server";
                        await signOut({ redirectTo: "/" });
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-full bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-200"
                      >
                        Sign out
                      </button>
                    </form>
                  </>
                ) : (
                  <Link
                    href="/api/auth/signin?callbackUrl=%2Flists"
                    className="rounded-full bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-200"
                  >
                    Sign in
                  </Link>
                )}
              </div>
            </header>

            <main className="flex-1">{children}</main>
          </div>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
