import { TRPCError } from "@trpc/server";
import { type Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";

import {
  Prisma,
  PrismaClient,
  WatchlistItemStatus,
  WatchlistMediaType,
  WatchlistRole,
} from "../../../../generated/prisma";
import { appRouter } from "~/server/api/root";

const mocks = vi.hoisted(() => ({
  sendWatchlistInviteEmail: vi.fn(),
  getMediaDetails: vi.fn(),
  searchMedia: vi.fn(),
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
  getMediaDetails: mocks.getMediaDetails,
  searchMedia: mocks.searchMedia,
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

const movieDetails = {
  tmdbId: 15,
  mediaType: "MOVIE" as const,
  title: "The Thing",
  creditNames: "John Carpenter",
  overview: "Isolation and paranoia.",
  posterPath: "/thing.jpg",
  backdropPath: "/thing-backdrop.jpg",
  year: 1982,
};

const tvDetails = {
  tmdbId: 1399,
  mediaType: "TV" as const,
  title: "Game of Thrones",
  creditNames: "David Benioff, D. B. Weiss",
  overview: "Winter is coming.",
  posterPath: "/got.jpg",
  backdropPath: "/got-backdrop.jpg",
  year: 2011,
};

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
    mocks.getMediaDetails.mockReset();
    mocks.getMediaDetails.mockResolvedValue(movieDetails);
    mocks.searchMedia.mockReset();
    mocks.searchMedia.mockResolvedValue([]);

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

  it("creates a watchlist and owner membership with a media type", async () => {
    db.watchlist.create.mockResolvedValue({
      id: WATCHLIST_ID,
      name: "Sci-fi night",
      description: null,
      mediaType: WatchlistMediaType.MOVIE,
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
      mediaType: "MOVIE",
    });

    expect(result).toMatchObject({
      id: WATCHLIST_ID,
      mediaType: WatchlistMediaType.MOVIE,
    });
    expect(db.watchlist.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mediaType: WatchlistMediaType.MOVIE,
        }),
      }),
    );
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
        mediaType: WatchlistMediaType.MOVIE,
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

  it("returns a conflict when the same TV title is added twice", async () => {
    db.watchlistMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      watchlistId: WATCHLIST_ID,
      userId: "user_1",
      role: WatchlistRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
      watchlist: {
        id: WATCHLIST_ID,
        mediaType: WatchlistMediaType.TV,
        name: "Weekend queue",
        ownerId: "user_1",
      },
    } as any);
    db.watchlistItem.count.mockResolvedValue(0);
    mocks.getMediaDetails.mockResolvedValue(tvDetails);
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
        tmdbId: tvDetails.tmdbId,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "That title is already on this watchlist.",
    });
  });

  it("persists movie credit and artwork metadata when adding an item", async () => {
    db.watchlistMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      watchlistId: WATCHLIST_ID,
      userId: "user_1",
      role: WatchlistRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
      watchlist: {
        id: WATCHLIST_ID,
        mediaType: WatchlistMediaType.MOVIE,
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
      creditNames: "John Carpenter",
      year: 1982,
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
      tmdbId: movieDetails.tmdbId,
    });

    expect(result.backdropPath).toBe("/thing-backdrop.jpg");
    expect(result.creditNames).toBe("John Carpenter");
    expect(mocks.getMediaDetails).toHaveBeenCalledWith(
      movieDetails.tmdbId,
      WatchlistMediaType.MOVIE,
    );
    expect(db.watchlistItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          creditNames: "John Carpenter",
          posterPath: "/thing.jpg",
          backdropPath: "/thing-backdrop.jpg",
          year: 1982,
        }),
      }),
    );
  });

  it("persists TV creator metadata when adding an item", async () => {
    db.watchlistMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      watchlistId: WATCHLIST_ID,
      userId: "user_1",
      role: WatchlistRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
      watchlist: {
        id: WATCHLIST_ID,
        mediaType: WatchlistMediaType.TV,
        name: "Epic queue",
        ownerId: "user_1",
      },
    } as any);
    db.watchlistItem.count.mockResolvedValue(0);
    mocks.getMediaDetails.mockResolvedValue(tvDetails);
    db.watchlistItem.create.mockResolvedValue({
      id: ITEM_ONE_ID,
      watchlistId: WATCHLIST_ID,
      tmdbId: 1399,
      position: 0,
      status: WatchlistItemStatus.QUEUED,
      note: "",
      title: "Game of Thrones",
      creditNames: "David Benioff, D. B. Weiss",
      year: 2011,
      posterPath: "/got.jpg",
      backdropPath: "/got-backdrop.jpg",
      overview: "Winter is coming.",
      watchedAt: null,
      addedById: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const caller = createCaller(db);
    const result = await caller.items.add({
      watchlistId: WATCHLIST_ID,
      tmdbId: tvDetails.tmdbId,
    });

    expect(result.creditNames).toBe(tvDetails.creditNames);
    expect(mocks.getMediaDetails).toHaveBeenCalledWith(
      tvDetails.tmdbId,
      WatchlistMediaType.TV,
    );
  });

  it("returns movie search metadata without changing order", async () => {
    mocks.searchMedia.mockResolvedValue([
      {
        tmdbId: 42,
        mediaType: "MOVIE",
        title: "Alien",
        creditNames: "Ridley Scott",
        overview: "Xenomorph problems.",
        posterPath: "/alien.jpg",
        backdropPath: "/alien-backdrop.jpg",
        year: 1979,
      },
      movieDetails,
    ]);

    const caller = createCaller(db);
    const result = await caller.media.search({
      query: "th",
      mediaType: "MOVIE",
    });

    expect(result.map((item) => item.tmdbId)).toEqual([42, 15]);
    expect(result.map((item) => item.creditNames)).toEqual([
      "Ridley Scott",
      "John Carpenter",
    ]);
    expect(result.map((item) => item.mediaType)).toEqual(["MOVIE", "MOVIE"]);
  });

  it("returns TV search metadata without changing order", async () => {
    mocks.searchMedia.mockResolvedValue([
      tvDetails,
      {
        tmdbId: 1412,
        mediaType: "TV",
        title: "Arrow",
        creditNames: "Greg Berlanti, Marc Guggenheim, Andrew Kreisberg",
        overview: "A vigilante returns home.",
        posterPath: "/arrow.jpg",
        backdropPath: "/arrow-backdrop.jpg",
        year: 2012,
      },
    ]);

    const caller = createCaller(db);
    const result = await caller.media.search({
      query: "ga",
      mediaType: "TV",
    });

    expect(result.map((item) => item.tmdbId)).toEqual([1399, 1412]);
    expect(result.map((item) => item.creditNames)).toEqual([
      "David Benioff, D. B. Weiss",
      "Greg Berlanti, Marc Guggenheim, Andrew Kreisberg",
    ]);
    expect(result.map((item) => item.mediaType)).toEqual(["TV", "TV"]);
  });

  it("returns ordered preview items and media type on watchlist list responses", async () => {
    db.watchlist.findMany.mockResolvedValue([
      {
        id: WATCHLIST_ID,
        name: "Weekend queue",
        description: "Only creature features.",
        mediaType: WatchlistMediaType.MOVIE,
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
        mediaType: WatchlistMediaType.MOVIE,
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

  it("returns stored item credits and list media type on watchlist details", async () => {
    db.watchlistMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      watchlistId: WATCHLIST_ID,
      userId: "user_1",
      role: WatchlistRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
      watchlist: {
        id: WATCHLIST_ID,
        mediaType: WatchlistMediaType.TV,
        name: "Weekend queue",
        ownerId: "user_1",
      },
    } as any);
    db.watchlist.findUniqueOrThrow.mockResolvedValue({
      id: WATCHLIST_ID,
      name: "Weekend queue",
      description: "Only creature features.",
      mediaType: WatchlistMediaType.TV,
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
          tmdbId: 1399,
          position: 0,
          status: WatchlistItemStatus.QUEUED,
          note: "",
          title: "Game of Thrones",
          creditNames: "David Benioff, D. B. Weiss",
          year: 2011,
          posterPath: "/got.jpg",
          backdropPath: "/got-backdrop.jpg",
          overview: "Winter is coming.",
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

    expect(result.mediaType).toBe(WatchlistMediaType.TV);
    expect(result.items).toMatchObject([
      {
        id: ITEM_ONE_ID,
        creditNames: "David Benioff, D. B. Weiss",
        year: 2011,
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
        mediaType: WatchlistMediaType.MOVIE,
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
        mediaType: WatchlistMediaType.MOVIE,
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
      creditNames: "John Carpenter",
      year: 1982,
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
