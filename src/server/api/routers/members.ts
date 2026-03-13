import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import { sendWatchlistInviteEmail } from "~/server/email";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  buildInviteUrl,
  createInviteToken,
  getInviteExpiry,
  hashInviteToken,
  normalizeEmail,
} from "~/server/watchlists/invites";
import {
  requireWatchlistMembership,
  requireWatchlistOwner,
} from "~/server/watchlists/permissions";

const watchlistIdSchema = z.string().cuid();

export const membersRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        watchlistId: watchlistIdSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireWatchlistMembership(
        ctx.db,
        ctx.session.user.id,
        input.watchlistId,
      );

      const [members, invites] = await Promise.all([
        ctx.db.watchlistMember.findMany({
          where: {
            watchlistId: input.watchlistId,
          },
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
        }),
        ctx.db.watchlistInvite.findMany({
          where: {
            watchlistId: input.watchlistId,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
      ]);

      return { members, invites };
    }),

  invite: protectedProcedure
    .input(
      z.object({
        watchlistId: watchlistIdSchema,
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireWatchlistOwner(
        ctx.db,
        ctx.session.user.id,
        input.watchlistId,
      );

      if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Invite email is not configured.",
        });
      }

      const email = normalizeEmail(input.email);
      const currentUserEmail = normalizeEmail(ctx.session.user.email ?? "");
      if (email === currentUserEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already have access to this watchlist.",
        });
      }

      const watchlist = await ctx.db.watchlist.findUniqueOrThrow({
        where: {
          id: input.watchlistId,
        },
        include: {
          members: {
            where: {
              user: {
                email,
              },
            },
            select: {
              id: true,
            },
          },
        },
      });

      if (watchlist.members.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That user is already a collaborator.",
        });
      }

      const rawToken = createInviteToken();
      const tokenHash = hashInviteToken(rawToken);
      const invite = await ctx.db.$transaction(async (tx) => {
        await tx.watchlistInvite.updateMany({
          where: {
            watchlistId: input.watchlistId,
            email,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: {
              gt: new Date(),
            },
          },
          data: {
            revokedAt: new Date(),
          },
        });

        return tx.watchlistInvite.create({
          data: {
            watchlistId: input.watchlistId,
            inviterId: ctx.session.user.id,
            email,
            tokenHash,
            expiresAt: getInviteExpiry(),
          },
        });
      });

      await sendWatchlistInviteEmail({
        email,
        inviteUrl: buildInviteUrl(ctx.headers, rawToken),
        inviterName: ctx.session.user.name ?? currentUserEmail,
        watchlistName: watchlist.name,
      });

      return invite;
    }),

  revokeInvite: protectedProcedure
    .input(
      z.object({
        watchlistId: watchlistIdSchema,
        inviteId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireWatchlistOwner(
        ctx.db,
        ctx.session.user.id,
        input.watchlistId,
      );

      await ctx.db.watchlistInvite.updateMany({
        where: {
          id: input.inviteId,
          watchlistId: input.watchlistId,
          acceptedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return { success: true };
    }),

  remove: protectedProcedure
    .input(
      z.object({
        watchlistId: watchlistIdSchema,
        userId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireWatchlistOwner(
        ctx.db,
        ctx.session.user.id,
        input.watchlistId,
      );

      const target = await requireWatchlistMembership(
        ctx.db,
        input.userId,
        input.watchlistId,
      );
      if (target.role === "OWNER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The owner cannot be removed from the watchlist.",
        });
      }

      await ctx.db.watchlistMember.delete({
        where: {
          watchlistId_userId: {
            watchlistId: input.watchlistId,
            userId: input.userId,
          },
        },
      });

      return { success: true };
    }),
});
