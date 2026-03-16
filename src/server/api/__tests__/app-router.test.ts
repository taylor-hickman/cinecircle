import { TRPCError } from "@trpc/server";
import { type Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";

import {
  Prisma,
  PrismaClient,
  WatchlistItemStatus,
  WatchlistRole,
} from "../../../../generated/prisma";
import { appRouter } from "~/server/api/root";

const mocks = vi.hoisted(() => ({
  sendWatchlistInviteEmail: vi.fn(),
  getMovieDetails: vi.fn(),
  searchMovies: vi.fn(),
}));

vi.mock("~/server/email", () => ({
  sendWatchlistInviteEmail: mocks.sendWatchlistInviteEmail,
}));

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}));

vi.mock("~/server/tmdb", () => ({
  getMovieDetails: mocks.getMovieDetails,
  searchMovies: mocks.searchMovies,
}));

type Context = {
  db: PrismaClient;
  session: Session | null;
  headers: Headers;
};

const WATCHLIST_ID = "cjld2cjxh0000qzrmn831i7rn";
const MEMBER_ID = "cjld2d1s00001qzrmn831i7ro";
const ITEM_ONE_ID = "cjld2e1s00003qzrmn831i7rq";
const ITEM_TWO_ID = "cjld2e1s00004qzrmn831i7rr";
const INVITE_ID = "cjld2f1s00005qzrmn831i7rs";

const createSession = (): Session => ({
  expires: "2099-01-01T00:00:00.000Z",
  user: {
    id: "user_1",
    email: "owner@example.com",
    name: "Owner",
    image: null,
  },
});

const createCaller = (
  db: PrismaClient,
  session: Session | null = createSession(),
) =>
  appRouter.createCaller({
    db,
    session,
    headers: new Headers([["origin", "http://localhost:3000"]]),
  } satisfies Context);

describe("app router", () => {
  let db: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    db = mockDeep<PrismaClient>();
    mockReset(db);
    mocks.sendWatchlistInviteEmail.mockReset();
    mocks.sendWatchlistInviteEmail.mockResolvedValue(undefined);
    mocks.getMovieDetails.mockReset();
    mocks.getMovieDetails.mockResolvedValue({
      tmdbId: 15,
      title: "The Thing",
      director: "John Carpenter",
      overview: "Isolation and paranoia.",
      posterPath: "/thing.jpg",
      backdropPath: "/thing-backdrop.jpg",
      releaseYear: 1982,
    });
    mocks.searchMovies.mockReset();
    mocks.searchMovies.mockResolvedValue([]);

    db.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === "function") {
        return input(db);
      }

      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      return input;
    });
  });

  it("creates a watchlist and owner membership", async () => {
    db.watchlist.create.mockResolvedValue({
      id: WATCHLIST_ID,
      name: "Sci-fi night",
      description: null,
      ownerId: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    db.watchlistMember.create.mockResolvedValue({
      id: MEMBER_ID,
      watchlistId: WATCHLIST_ID,
      userId: "user_1",
      role: WatchlistRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = createCaller(db);
    const result = await caller.watchlists.create({
      name: "Sci-fi night",
    });

    expect(result.id).toBe(WATCHLIST_ID);
    expect(db.watchlistMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: WatchlistRole.OWNER,
        }),
      }),
    );
  });

  it("blocks non-owners from inviting collaborators", async () => {
    db.watchlistMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      watchlistId: WATCHLIST_ID,
      userId: "user_1",
      role: WatchlistRole.COLLABORATOR,
      createdAt: new Date(),
      updatedAt: new Date(),
      watchlist: {
        id: WATCHLIST_ID,
        name: "Weekend queue",
        ownerId: "user_2",
      },
    } as any);

    const caller = createCaller(db);

    await expect(
      caller.members.invite({
        watchlistId: WATCHLIST_ID,
        email: "friend@example.com",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("accepts a valid invite and creates a collaborator membership", async () => {
    db.watchlistInvite.findUnique.mockResolvedValue({
      id: INVITE_ID,
      watchlistId: WATCHLIST_ID,
      inviterId: "user_9",
      email: "owner@example.com",
      tokenHash: "hashed-token",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
    });
    db.watchlistMember.findUnique.mockResolvedValue(null);
    db.watchlistMember.create.mockResolvedValue({
      id: MEMBER_ID,
      watchlistId: WATCHLIST_ID,
      userId: "user_1",
      role: WatchlistRole.COLLABORATOR,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    db.watchlistInvite.update.mockResolvedValue({
      id: INVITE_ID,
      watchlistId: WATCHLIST_ID,
      inviterId: "user_9",
      email: "owner@example.com",
      tokenHash: "hashed-token",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: new Date(),
      revokedAt: null,
    });

    const caller = createCaller(db);
    const result = await caller.invites.accept({
      token: "valid-token-string-12345",
    });

    expect(result).toEqual({
      success: true,
      watchlistId: WATCHLIST_ID,
    });
    expect(db.watchlistMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: WatchlistRole.COLLABORATOR,
        }),
      }),
    );
  });

  it("returns a conflict when the same movie is added twice", async () => {
    db.watchlistMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      watchlistId: WATCHLIST_ID,
      userId: "user_1",
      role: WatchlistRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
      watchlist: {
        id: WATCHLIST_ID,
        name: "Weekend queue",
        ownerId: "user_1",
      },
    } as any);
    db.watchlistItem.count.mockResolvedValue(0);
    db.watchlistItem.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "6.19.2",
      }),
    );

    const caller = createCaller(db);

    await expect(
      caller.items.add({
        watchlistId: WATCHLIST_ID,
        tmdbId: 15,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("persists director and artwork metadata when adding a movie", async () => {
    db.watchlistMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      watchlistId: WATCHLIST_ID,
      userId: "user_1",
      role: WatchlistRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
      watchlist: {
        id: WATCHLIST_ID,
        name: "Weekend queue",
        ownerId: "user_1",
      },
    } as any);
    db.watchlistItem.count.mockResolvedValue(0);
    db.watchlistItem.create.mockResolvedValue({
      id: ITEM_ONE_ID,
      watchlistId: WATCHLIST_ID,
      tmdbId: 15,
      position: 0,
      status: WatchlistItemStatus.QUEUED,
      note: "",
      title: "The Thing",
      director: "John Carpenter",
      releaseYear: 1982,
      posterPath: "/thing.jpg",
      backdropPath: "/thing-backdrop.jpg",
      overview: "Isolation and paranoia.",
      watchedAt: null,
      addedById: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const caller = createCaller(db);
    const result = await caller.items.add({
      watchlistId: WATCHLIST_ID,
      tmdbId: 15,
    });

    expect(result.backdropPath).toBe("/thing-backdrop.jpg");
    expect(result.director).toBe("John Carpenter");
    expect(db.watchlistItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          director: "John Carpenter",
          posterPath: "/thing.jpg",
          backdropPath: "/thing-backdrop.jpg",
        }),
      }),
    );
  });

  it("returns director metadata on movie search results without changing order", async () => {
    mocks.searchMovies.mockResolvedValue([
      {
        tmdbId: 42,
        title: "Alien",
        director: "Ridley Scott",
        overview: "Xenomorph problems.",
        posterPath: "/alien.jpg",
        backdropPath: "/alien-backdrop.jpg",
        releaseYear: 1979,
      },
      {
        tmdbId: 15,
        title: "The Thing",
        director: "John Carpenter",
        overview: "Isolation and paranoia.",
        posterPath: "/thing.jpg",
        backdropPath: "/thing-backdrop.jpg",
        releaseYear: 1982,
      },
    ]);

    const caller = createCaller(db);
    const result = await caller.movies.search({
      query: "th",
    });

    expect(result.map((movie) => movie.tmdbId)).toEqual([42, 15]);
    expect(result.map((movie) => movie.director)).toEqual([
      "Ridley Scott",
      "John Carpenter",
    ]);
  });

  it("returns ordered preview items on watchlist list responses", async () => {
    db.watchlist.findMany.mockResolvedValue([
      {
        id: WATCHLIST_ID,
        name: "Weekend queue",
        description: "Only creature features.",
        ownerId: "user_1",
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: {
          id: "user_1",
          name: "Owner",
          email: "owner@example.com",
        },
        _count: {
          items: 4,
          members: 2,
        },
        members: [
          {
            role: WatchlistRole.OWNER,
          },
        ],
        items: [
          {
            tmdbId: 15,
            title: "The Thing",
            posterPath: "/thing.jpg",
            backdropPath: "/thing-backdrop.jpg",
          },
          {
            tmdbId: 42,
            title: "Alien",
            posterPath: "/alien.jpg",
            backdropPath: null,
          },
        ],
      },
    ] as any);

    const caller = createCaller(db);
    const result = await caller.watchlists.list();

    expect(result).toMatchObject([
      {
        id: WATCHLIST_ID,
        previewItems: [
          {
            tmdbId: 15,
            title: "The Thing",
            posterPath: "/thing.jpg",
            backdropPath: "/thing-backdrop.jpg",
          },
          {
            tmdbId: 42,
            title: "Alien",
            posterPath: "/alien.jpg",
            backdropPath: null,
          },
        ],
      },
    ]);
  });

  it("returns stored directors on watchlist items", async () => {
    db.watchlistMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      watchlistId: WATCHLIST_ID,
      userId: "user_1",
      role: WatchlistRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
      watchlist: {
        id: WATCHLIST_ID,
        name: "Weekend queue",
        ownerId: "user_1",
      },
    } as any);
    db.watchlist.findUniqueOrThrow.mockResolvedValue({
      id: WATCHLIST_ID,
      name: "Weekend queue",
      description: "Only creature features.",
      ownerId: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: {
        id: "user_1",
        name: "Owner",
        email: "owner@example.com",
      },
      members: [],
      invites: [],
      items: [
        {
          id: ITEM_ONE_ID,
          watchlistId: WATCHLIST_ID,
          tmdbId: 15,
          position: 0,
          status: WatchlistItemStatus.QUEUED,
          note: "",
          title: "The Thing",
          director: "John Carpenter",
          releaseYear: 1982,
          posterPath: "/thing.jpg",
          backdropPath: "/thing-backdrop.jpg",
          overview: "Isolation and paranoia.",
          watchedAt: null,
          addedById: "user_1",
          createdAt: new Date(),
          updatedAt: new Date(),
          addedBy: {
            id: "user_1",
            name: "Owner",
            email: "owner@example.com",
          },
        },
      ],
    } as any);

    const caller = createCaller(db);
    const result = await caller.watchlists.get({
      watchlistId: WATCHLIST_ID,
    });

    expect(result.items).toMatchObject([
      {
        id: ITEM_ONE_ID,
        director: "John Carpenter",
      },
    ]);
  });

  it("rejects reorder payloads that do not match the current items", async () => {
    db.watchlistMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      watchlistId: WATCHLIST_ID,
      userId: "user_1",
      role: WatchlistRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
      watchlist: {
        id: WATCHLIST_ID,
        name: "Weekend queue",
        ownerId: "user_1",
      },
    } as any);
    db.watchlistItem.findMany.mockResolvedValue([
      { id: ITEM_ONE_ID },
      { id: ITEM_TWO_ID },
    ] as any);

    const caller = createCaller(db);

    await expect(
      caller.items.reorder({
        watchlistId: WATCHLIST_ID,
        itemIds: [ITEM_ONE_ID],
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("updates watched state when item status changes", async () => {
    db.watchlistItem.findUniqueOrThrow.mockResolvedValue({
      watchlistId: WATCHLIST_ID,
    } as any);
    db.watchlistMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      watchlistId: WATCHLIST_ID,
      userId: "user_1",
      role: WatchlistRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
      watchlist: {
        id: WATCHLIST_ID,
        name: "Weekend queue",
        ownerId: "user_1",
      },
    } as any);
    db.watchlistItem.update.mockResolvedValue({
      id: ITEM_ONE_ID,
      watchlistId: WATCHLIST_ID,
      tmdbId: 15,
      position: 0,
      status: WatchlistItemStatus.WATCHED,
      note: "",
      title: "The Thing",
      director: "John Carpenter",
      releaseYear: 1982,
      posterPath: "/thing.jpg",
      backdropPath: "/thing-backdrop.jpg",
      overview: "Isolation and paranoia.",
      watchedAt: new Date(),
      addedById: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = createCaller(db);
    const result = await caller.items.update({
      itemId: ITEM_ONE_ID,
      status: WatchlistItemStatus.WATCHED,
      note: "Ready for Friday.",
    });

    expect(result.status).toBe(WatchlistItemStatus.WATCHED);
    expect(db.watchlistItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WatchlistItemStatus.WATCHED,
          note: "Ready for Friday.",
          watchedAt: expect.any(Date),
        }),
      }),
    );
  });
});
