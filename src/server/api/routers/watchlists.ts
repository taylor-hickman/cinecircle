import { z } from "zod";

import { WatchlistRole } from "../../../../generated/prisma";
import { watchlistMediaTypes } from "~/lib/watchlist-media";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  requireWatchlistMembership,
  requireWatchlistOwner,
} from "~/server/watchlists/permissions";

const watchlistIdSchema = z.string().cuid();
const mediaTypeSchema = z.enum(watchlistMediaTypes);

export const watchlistsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const watchlists = await ctx.db.watchlist.findMany({
      where: {
        members: {
          some: {
            userId: ctx.session.user.id,
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            items: true,
            members: true,
          },
        },
        members: {
          where: {
            userId: ctx.session.user.id,
          },
          select: {
            role: true,
          },
        },
        items: {
          orderBy: {
            position: "asc",
          },
          take: 3,
          select: {
            tmdbId: true,
            title: true,
            posterPath: true,
            backdropPath: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return watchlists.map((watchlist) => ({
      id: watchlist.id,
      name: watchlist.name,
      description: watchlist.description,
      mediaType: watchlist.mediaType,
      createdAt: watchlist.createdAt,
      updatedAt: watchlist.updatedAt,
      owner: watchlist.owner,
      viewerRole: watchlist.members[0]?.role ?? WatchlistRole.COLLABORATOR,
      itemCount: watchlist._count.items,
      memberCount: watchlist._count.members,
      previewItems: watchlist.items,
    }));
  }),

  get: protectedProcedure
    .input(
      z.object({
        watchlistId: watchlistIdSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const membership = await requireWatchlistMembership(
        ctx.db,
        ctx.session.user.id,
        input.watchlistId,
      );

      const watchlist = await ctx.db.watchlist.findUniqueOrThrow({
        where: {
          id: input.watchlistId,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          members: {
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          invites: {
            where: {
              acceptedAt: null,
              revokedAt: null,
              expiresAt: {
                gt: new Date(),
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          items: {
            orderBy: {
              position: "asc",
            },
            include: {
              addedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      return {
        ...watchlist,
        viewerRole: membership.role,
        canManage: membership.role === WatchlistRole.OWNER,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).optional(),
        mediaType: mediaTypeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const watchlist = await tx.watchlist.create({
          data: {
            name: input.name,
            description: input.description?.trim() ?? null,
            mediaType: input.mediaType,
            ownerId: ctx.session.user.id,
          },
        });

        await tx.watchlistMember.create({
          data: {
            watchlistId: watchlist.id,
            userId: ctx.session.user.id,
            role: WatchlistRole.OWNER,
          },
        });

        return watchlist;
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        watchlistId: watchlistIdSchema,
        name: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireWatchlistOwner(
        ctx.db,
        ctx.session.user.id,
        input.watchlistId,
      );

      return ctx.db.watchlist.update({
        where: {
          id: input.watchlistId,
        },
        data: {
          name: input.name,
          description: input.description?.trim() ?? null,
        },
      });
    }),

  delete: protectedProcedure
    .input(
      z.object({
        watchlistId: watchlistIdSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireWatchlistOwner(
        ctx.db,
        ctx.session.user.id,
        input.watchlistId,
      );

      await ctx.db.watchlist.delete({
        where: {
          id: input.watchlistId,
        },
      });

      return { success: true };
    }),
});
