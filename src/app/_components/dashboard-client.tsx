"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TmdbBackdrop, TmdbPoster } from "~/app/_components/tmdb-media";
import {
  getWatchlistBadgeLabel,
  getWatchlistTypeLabel,
  type WatchlistMediaTypeValue,
  watchlistMediaTypes,
} from "~/lib/watchlist-media";
import { api } from "~/trpc/react";

export function DashboardClient() {
  const router = useRouter();
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mediaType, setMediaType] = useState<WatchlistMediaTypeValue>("MOVIE");

  const watchlistsQuery = api.watchlists.list.useQuery();
  const createWatchlist = api.watchlists.create.useMutation({
    onSuccess: async (watchlist) => {
      setName("");
      setDescription("");
      setMediaType("MOVIE");
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
              mediaType,
            });
          }}
        >
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">
              Create a watchlist
            </h1>
            <p className="text-sm text-stone-400">
              Start a private movie or TV list, then invite collaborators after
              it is created.
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

          <fieldset className="space-y-2">
            <legend className="text-sm text-stone-300">List type</legend>
            <div className="grid grid-cols-2 gap-3">
              {watchlistMediaTypes.map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                    mediaType === option
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-white/10 bg-stone-950 text-stone-300 hover:border-white/20"
                  }`}
                >
                  <span>{getWatchlistTypeLabel(option)}</span>
                  <input
                    type="radio"
                    name="mediaType"
                    value={option}
                    checked={mediaType === option}
                    onChange={() => setMediaType(option)}
                    className="sr-only"
                  />
                </label>
              ))}
            </div>
          </fieldset>

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
              Owned and shared watchlists stay private. Posters and cover art
              now preview what each list actually feels like.
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

          <div className="grid gap-5">
            {watchlistsQuery.data?.map((watchlist) => {
              const leadPreview =
                watchlist.previewItems.find((item) => item.backdropPath) ??
                watchlist.previewItems[0];

              return (
                <Link
                  key={watchlist.id}
                  href={`/lists/${watchlist.id}`}
                  className="block overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 transition hover:border-white/20 hover:bg-white/10"
                >
                  <TmdbBackdrop
                    title={watchlist.name}
                    backdropPath={leadPreview?.backdropPath ?? null}
                    posterPath={leadPreview?.posterPath ?? null}
                    className="min-h-[19rem]"
                  >
                    <div className="flex h-full flex-col justify-between gap-6 p-5 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs tracking-[0.18em] text-stone-200 uppercase">
                          {watchlist.viewerRole === "OWNER"
                            ? "Owner"
                            : "Collaborator"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-stone-200">
                          {getWatchlistBadgeLabel(watchlist.mediaType)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-stone-200">
                          {watchlist.itemCount} titles
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-stone-200">
                          {watchlist.memberCount} members
                        </span>
                      </div>

                      <div className="space-y-5">
                        <div className="space-y-2">
                          <h3 className="text-2xl font-semibold text-white">
                            {watchlist.name}
                          </h3>
                          <p className="max-w-2xl text-sm text-stone-200">
                            {watchlist.description ??
                              (watchlist.previewItems.length > 0
                                ? "Artwork-led queue with live TMDB search and shared notes."
                                : "Add titles to turn this empty shell into a visual watchlist.")}
                          </p>
                        </div>

                        {watchlist.previewItems.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-xs tracking-[0.22em] text-stone-400 uppercase">
                              Queue preview
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {watchlist.previewItems.map((item) => (
                                <div
                                  key={`${watchlist.id}-${item.tmdbId}`}
                                  className="w-[72px] shrink-0"
                                >
                                  <TmdbPoster
                                    title={item.title}
                                    posterPath={item.posterPath}
                                    backdropPath={item.backdropPath}
                                    size="thumb"
                                    className="aspect-[2/3] rounded-[1rem] border border-white/10"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 p-4 text-sm text-stone-300">
                            No titles yet. Open the list and start typing to get
                            live TMDB suggestions.
                          </div>
                        )}
                      </div>
                    </div>
                  </TmdbBackdrop>
                </Link>
              );
            })}
          </div>
        </section>
      </section>
    </div>
  );
}
