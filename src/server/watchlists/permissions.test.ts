import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import {
  requireWatchlistMembership,
  requireWatchlistOwner,
} from "~/server/watchlists/permissions";

describe("watchlist permissions", () => {
  it("rejects users without membership", async () => {
    const database = {
      watchlistMember: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(
      requireWatchlistMembership(database, "user_1", "watchlist_1"),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("allows owners through the owner guard", async () => {
    const database = {
      watchlistMember: {
        findUnique: vi.fn().mockResolvedValue({
          role: "OWNER",
          watchlist: {
            id: "watchlist_1",
            mediaType: "MOVIE",
            name: "Weekend queue",
            ownerId: "user_1",
          },
        }),
      },
    };

    await expect(
      requireWatchlistOwner(database, "user_1", "watchlist_1"),
    ).resolves.toMatchObject({
      role: "OWNER",
    });
  });
});
