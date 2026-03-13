import { TRPCError } from "@trpc/server";

import type { db } from "~/server/db";

type DatabaseClient = {
  watchlistMember: Pick<typeof db.watchlistMember, "findUnique">;
};

export async function getWatchlistMembership(
  database: DatabaseClient,
  userId: string,
  watchlistId: string,
) {
  return database.watchlistMember.findUnique({
    where: {
      watchlistId_userId: {
        watchlistId,
        userId,
      },
    },
    include: {
      watchlist: {
        select: {
          id: true,
          name: true,
          ownerId: true,
        },
      },
    },
  });
}

export async function requireWatchlistMembership(
  database: DatabaseClient,
  userId: string,
  watchlistId: string,
) {
  const membership = await getWatchlistMembership(
    database,
    userId,
    watchlistId,
  );
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this watchlist.",
    });
  }

  return membership;
}

export async function requireWatchlistOwner(
  database: DatabaseClient,
  userId: string,
  watchlistId: string,
) {
  const membership = await requireWatchlistMembership(
    database,
    userId,
    watchlistId,
  );
  if (membership.role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the watchlist owner can do that.",
    });
  }

  return membership;
}
