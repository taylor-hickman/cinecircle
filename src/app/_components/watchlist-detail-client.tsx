"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { api } from "~/trpc/react";

type WatchlistDetailClientProps = {
  watchlistId: string;
};

export function WatchlistDetailClient({
  watchlistId,
}: WatchlistDetailClientProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const watchlistQuery = api.watchlists.get.useQuery({ watchlistId });
  const movieSearchQuery = api.movies.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.trim().length >= 2 },
  );

  const watchlist = watchlistQuery.data;

  useEffect(() => {
    if (!watchlist) {
      return;
    }

    setDraftName(watchlist.name);
    setDraftDescription(watchlist.description ?? "");
    setNoteDrafts(
      Object.fromEntries(watchlist.items.map((item) => [item.id, item.note])),
    );
  }, [watchlist]);

  const invalidateWatchlist = async () => {
    await Promise.all([
      utils.watchlists.get.invalidate({ watchlistId }),
      utils.watchlists.list.invalidate(),
      utils.members.list.invalidate({ watchlistId }),
    ]);
  };

  const updateWatchlist = api.watchlists.update.useMutation({
    onSuccess: invalidateWatchlist,
  });
  const deleteWatchlist = api.watchlists.delete.useMutation({
    onSuccess: async () => {
      await utils.watchlists.list.invalidate();
      router.push("/lists");
    },
  });
  const inviteMember = api.members.invite.useMutation({
    onSuccess: async () => {
      setInviteEmail("");
      await invalidateWatchlist();
    },
  });
  const revokeInvite = api.members.revokeInvite.useMutation({
    onSuccess: invalidateWatchlist,
  });
  const removeMember = api.members.remove.useMutation({
    onSuccess: invalidateWatchlist,
  });
  const addItem = api.items.add.useMutation({
    onSuccess: invalidateWatchlist,
  });
  const updateItem = api.items.update.useMutation({
    onSuccess: invalidateWatchlist,
  });
  const removeItem = api.items.remove.useMutation({
    onSuccess: invalidateWatchlist,
  });
  const reorderItems = api.items.reorder.useMutation({
    onSuccess: invalidateWatchlist,
  });

  const orderedItemIds = useMemo(
    () => watchlist?.items.map((item) => item.id) ?? [],
    [watchlist?.items],
  );

  const moveItem = (itemId: string, direction: "up" | "down") => {
    const currentIndex = orderedItemIds.indexOf(itemId);
    if (currentIndex === -1) {
      return;
    }

    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= orderedItemIds.length) {
      return;
    }

    const nextOrder = [...orderedItemIds];
    const [item] = nextOrder.splice(currentIndex, 1);
    if (!item) {
      return;
    }

    nextOrder.splice(nextIndex, 0, item);
    reorderItems.mutate({
      watchlistId,
      itemIds: nextOrder,
    });
  };

  if (watchlistQuery.isLoading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-stone-300">
        Loading watchlist...
      </div>
    );
  }

  if (watchlistQuery.error || !watchlist) {
    return (
      <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-200">
        {watchlistQuery.error?.message ?? "Watchlist not found."}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 text-sm text-stone-400">
        <Link href="/lists" className="transition hover:text-white">
          ← Back to dashboard
        </Link>
        <span>Owner: {watchlist.owner.name ?? watchlist.owner.email}</span>
        <span>{watchlist.items.length} movies</span>
      </div>

      <section className="grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-8">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm tracking-[0.22em] text-stone-500 uppercase">
                  {watchlist.viewerRole === "OWNER"
                    ? "Owner view"
                    : "Collaborator view"}
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-white">
                  {watchlist.name}
                </h1>
                {watchlist.description ? (
                  <p className="mt-3 max-w-3xl text-stone-300">
                    {watchlist.description}
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-stone-300">
                <div className="text-stone-500">Members</div>
                <div className="text-lg font-semibold text-white">
                  {watchlist.members.length}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-white">Add movies</h2>
              <p className="text-sm text-stone-400">
                Search TMDB, then add a movie to this shared queue.
              </p>
            </div>

            <form
              className="mt-5 flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                setSearchQuery(searchInput.trim());
              }}
            >
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="flex-1 rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-white transition outline-none focus:border-white/30"
                placeholder="Search movies..."
              />
              <button
                type="submit"
                className="rounded-full bg-white px-5 py-3 font-medium text-stone-900 transition hover:bg-stone-200"
              >
                Search
              </button>
            </form>

            {movieSearchQuery.isFetching ? (
              <p className="mt-4 text-sm text-stone-400">Searching TMDB...</p>
            ) : null}
            {movieSearchQuery.error ? (
              <p className="mt-4 text-sm text-rose-300">
                {movieSearchQuery.error.message}
              </p>
            ) : null}

            <div className="mt-4 grid gap-3">
              {movieSearchQuery.data?.map((movie) => (
                <div
                  key={movie.tmdbId}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-stone-950/80 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{movie.title}</h3>
                      {movie.releaseYear ? (
                        <span className="text-sm text-stone-500">
                          {movie.releaseYear}
                        </span>
                      ) : null}
                    </div>
                    {movie.overview ? (
                      <p className="max-w-2xl text-sm text-stone-400">
                        {movie.overview}
                      </p>
                    ) : (
                      <p className="text-sm text-stone-500">
                        No overview available.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      addItem.mutate({
                        watchlistId,
                        tmdbId: movie.tmdbId,
                      })
                    }
                    disabled={addItem.isPending}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>

            {addItem.error ? (
              <p className="mt-4 text-sm text-rose-300">
                {addItem.error.message}
              </p>
            ) : null}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-white">Queue</h2>
              <p className="text-sm text-stone-400">
                Reorder with the arrow controls, mark titles watched, and keep
                one shared note per movie.
              </p>
            </div>

            {watchlist.items.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-stone-950/60 p-5 text-stone-400">
                No movies on this list yet.
              </div>
            ) : null}

            <div className="mt-5 grid gap-4">
              {watchlist.items.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-stone-950/80 p-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs tracking-wide text-stone-300 uppercase">
                          #{index + 1}
                        </span>
                        <h3 className="text-lg font-semibold text-white">
                          {item.title}
                        </h3>
                        {item.releaseYear ? (
                          <span className="text-sm text-stone-500">
                            {item.releaseYear}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-white/5 px-3 py-1 text-xs tracking-wide text-stone-300 uppercase">
                          {item.status}
                        </span>
                      </div>

                      {item.overview ? (
                        <p className="max-w-3xl text-sm text-stone-400">
                          {item.overview}
                        </p>
                      ) : null}

                      <p className="text-xs tracking-wide text-stone-500 uppercase">
                        Added by {item.addedBy.name ?? item.addedBy.email}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moveItem(item.id, "up")}
                        disabled={index === 0 || reorderItems.isPending}
                        className="rounded-full border border-white/15 px-3 py-2 text-sm transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(item.id, "down")}
                        disabled={
                          index === watchlist.items.length - 1 ||
                          reorderItems.isPending
                        }
                        className="rounded-full border border-white/15 px-3 py-2 text-sm transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateItem.mutate({
                            itemId: item.id,
                            status:
                              item.status === "WATCHED" ? "QUEUED" : "WATCHED",
                            note: noteDrafts[item.id] ?? item.note,
                          })
                        }
                        className="rounded-full border border-white/15 px-3 py-2 text-sm transition hover:border-white/30"
                      >
                        {item.status === "WATCHED"
                          ? "Move to queue"
                          : "Mark watched"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem.mutate({ itemId: item.id })}
                        className="rounded-full border border-rose-400/20 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-300/40"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    <textarea
                      value={noteDrafts[item.id] ?? ""}
                      onChange={(event) =>
                        setNoteDrafts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      className="min-h-24 rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-white transition outline-none focus:border-white/30"
                      placeholder="Shared note for this movie..."
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateItem.mutate({
                            itemId: item.id,
                            note: noteDrafts[item.id] ?? "",
                            status: item.status,
                          })
                        }
                        className="rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-200"
                      >
                        Save note
                      </button>
                      {item.watchedAt ? (
                        <span className="text-xs tracking-wide text-stone-500 uppercase">
                          Watched{" "}
                          {new Date(item.watchedAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {updateItem.error ? (
              <p className="mt-4 text-sm text-rose-300">
                {updateItem.error.message}
              </p>
            ) : null}
            {removeItem.error ? (
              <p className="mt-4 text-sm text-rose-300">
                {removeItem.error.message}
              </p>
            ) : null}
            {reorderItems.error ? (
              <p className="mt-4 text-sm text-rose-300">
                {reorderItems.error.message}
              </p>
            ) : null}
          </section>
        </div>

        <aside className="space-y-8">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-white">Settings</h2>
              <p className="text-sm text-stone-400">
                Owners can rename or delete the watchlist. Collaborators can
                only view this section.
              </p>
            </div>

            {watchlist.canManage ? (
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  updateWatchlist.mutate({
                    watchlistId,
                    name: draftName,
                    description: draftDescription || undefined,
                  });
                }}
              >
                <label className="block space-y-2">
                  <span className="text-sm text-stone-300">Name</span>
                  <input
                    required
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-white transition outline-none focus:border-white/30"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-stone-300">Description</span>
                  <textarea
                    value={draftDescription}
                    onChange={(event) =>
                      setDraftDescription(event.target.value)
                    }
                    className="min-h-24 w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-white transition outline-none focus:border-white/30"
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="rounded-full bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-200"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Delete this watchlist?")) {
                        deleteWatchlist.mutate({ watchlistId });
                      }
                    }}
                    className="rounded-full border border-rose-400/20 px-4 py-2 text-rose-200 transition hover:border-rose-300/40"
                  >
                    Delete watchlist
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-5 text-sm text-stone-400">
                Only the owner can change watchlist settings.
              </p>
            )}

            {updateWatchlist.error ? (
              <p className="mt-4 text-sm text-rose-300">
                {updateWatchlist.error.message}
              </p>
            ) : null}
            {deleteWatchlist.error ? (
              <p className="mt-4 text-sm text-rose-300">
                {deleteWatchlist.error.message}
              </p>
            ) : null}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-white">
                Collaborators
              </h2>
              <p className="text-sm text-stone-400">
                The owner handles invites and removals. Everyone on the list can
                edit items.
              </p>
            </div>

            {watchlist.canManage ? (
              <form
                className="mt-5 flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  inviteMember.mutate({
                    watchlistId,
                    email: inviteEmail,
                  });
                }}
              >
                <input
                  required
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-stone-950 px-4 py-3 text-white transition outline-none focus:border-white/30"
                  placeholder="friend@example.com"
                />
                <button
                  type="submit"
                  className="rounded-full bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-200"
                >
                  Send invite
                </button>
              </form>
            ) : null}

            {inviteMember.error ? (
              <p className="mt-4 text-sm text-rose-300">
                {inviteMember.error.message}
              </p>
            ) : null}

            <div className="mt-6 space-y-3">
              {watchlist.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-stone-950/80 px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-white">
                      {member.user.name ?? member.user.email}
                    </div>
                    <div className="text-xs tracking-wide text-stone-500 uppercase">
                      {member.role}
                    </div>
                  </div>

                  {watchlist.canManage && member.role !== "OWNER" ? (
                    <button
                      type="button"
                      onClick={() =>
                        removeMember.mutate({
                          watchlistId,
                          userId: member.userId,
                        })
                      }
                      className="rounded-full border border-rose-400/20 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-300/40"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold tracking-[0.18em] text-stone-500 uppercase">
                Pending invites
              </h3>
              <div className="mt-3 space-y-3">
                {watchlist.invites.length === 0 ? (
                  <p className="text-sm text-stone-400">No pending invites.</p>
                ) : null}

                {watchlist.invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-stone-950/80 px-4 py-3"
                  >
                    <div>
                      <div className="font-medium text-white">
                        {invite.email}
                      </div>
                      <div className="text-xs tracking-wide text-stone-500 uppercase">
                        Expires{" "}
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </div>
                    </div>

                    {watchlist.canManage ? (
                      <button
                        type="button"
                        onClick={() =>
                          revokeInvite.mutate({
                            watchlistId,
                            inviteId: invite.id,
                          })
                        }
                        className="rounded-full border border-white/15 px-3 py-2 text-sm transition hover:border-white/30"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {removeMember.error ? (
              <p className="mt-4 text-sm text-rose-300">
                {removeMember.error.message}
              </p>
            ) : null}
            {revokeInvite.error ? (
              <p className="mt-4 text-sm text-rose-300">
                {revokeInvite.error.message}
              </p>
            ) : null}
          </section>
        </aside>
      </section>
    </div>
  );
}
