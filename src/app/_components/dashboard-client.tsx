"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "~/trpc/react";

export function DashboardClient() {
  const router = useRouter();
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const watchlistsQuery = api.watchlists.list.useQuery();
  const createWatchlist = api.watchlists.create.useMutation({
    onSuccess: async (watchlist) => {
      setName("");
      setDescription("");
      await utils.watchlists.list.invalidate();
      router.push(`/lists/${watchlist.id}`);
    },
  });

  return (
    <div className="space-y-8">
      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <form
          className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            createWatchlist.mutate({
              name,
              description: description || undefined,
            });
          }}
        >
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">
              Create a watchlist
            </h1>
            <p className="text-sm text-stone-400">
              Start a private list, then invite collaborators after it is
              created.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-stone-300">Name</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-white transition outline-none focus:border-white/30"
              placeholder="Friday horror queue"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-stone-300">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-white transition outline-none focus:border-white/30"
              placeholder="What is this list for?"
            />
          </label>

          <button
            type="submit"
            disabled={createWatchlist.isPending}
            className="rounded-full bg-white px-5 py-3 font-medium text-stone-900 transition hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createWatchlist.isPending ? "Creating..." : "Create watchlist"}
          </button>

          {createWatchlist.error ? (
            <p className="text-sm text-rose-300">
              {createWatchlist.error.message}
            </p>
          ) : null}
        </form>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-white">Your lists</h2>
            <p className="text-sm text-stone-400">
              Owned and shared watchlists are all private. Collaborators can add
              and reorder movies.
            </p>
          </div>

          {watchlistsQuery.isLoading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-stone-300">
              Loading watchlists...
            </div>
          ) : null}

          {watchlistsQuery.error ? (
            <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-200">
              {watchlistsQuery.error.message}
            </div>
          ) : null}

          {watchlistsQuery.data?.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-stone-400">
              No watchlists yet. Create your first list to start inviting
              people.
            </div>
          ) : null}

          <div className="grid gap-4">
            {watchlistsQuery.data?.map((watchlist) => (
              <Link
                key={watchlist.id}
                href={`/lists/${watchlist.id}`}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-white/20 hover:bg-white/10"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">
                        {watchlist.name}
                      </h3>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs tracking-wide text-stone-300 uppercase">
                        {watchlist.viewerRole === "OWNER"
                          ? "Owner"
                          : "Collaborator"}
                      </span>
                    </div>
                    {watchlist.description ? (
                      <p className="max-w-2xl text-sm text-stone-400">
                        {watchlist.description}
                      </p>
                    ) : null}
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm text-stone-300">
                    <div className="rounded-2xl border border-white/10 px-3 py-2">
                      <dt className="text-stone-500">Movies</dt>
                      <dd className="text-base font-semibold text-white">
                        {watchlist.itemCount}
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-white/10 px-3 py-2">
                      <dt className="text-stone-500">Members</dt>
                      <dd className="text-base font-semibold text-white">
                        {watchlist.memberCount}
                      </dd>
                    </div>
                  </dl>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
