import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { WatchlistRole } from "../../../../generated/prisma";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  hashInviteToken,
  isInviteActive,
  normalizeEmail,
} from "~/server/watchlists/invites";

const tokenSchema = z.object({
  token: z.string().min(20),
});

export const invitesRouter = createTRPCRouter({
  lookup: publicProcedure.input(tokenSchema).query(async ({ ctx, input }) => {
    const invite = await ctx.db.watchlistInvite.findUnique({
      where: {
        tokenHash: hashInviteToken(input.token),
      },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        watchlist: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!invite) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found." });
    }

    return {
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      revokedAt: invite.revokedAt,
      isActive: isInviteActive(invite),
      inviter: invite.inviter,
      watchlist: invite.watchlist,
    };
  }),

  accept: protectedProcedure
    .input(tokenSchema)
    .mutation(async ({ ctx, input }) => {
      const userEmail = normalizeEmail(ctx.session.user.email ?? "");
      if (!userEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Your account must have a verified email to accept invites.",
        });
      }

      const invite = await ctx.db.watchlistInvite.findUnique({
        where: {
          tokenHash: hashInviteToken(input.token),
        },
      });

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found.",
        });
      }

      if (invite.revokedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite has been revoked.",
        });
      }

      if (invite.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite has already been used.",
        });
      }

      if (invite.expiresAt <= new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite has expired.",
        });
      }

      if (normalizeEmail(invite.email) !== userEmail) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Sign in with the invited email address to accept this invite.",
        });
      }

      await ctx.db.$transaction(async (tx) => {
        const existingMembership = await tx.watchlistMember.findUnique({
          where: {
            watchlistId_userId: {
              watchlistId: invite.watchlistId,
              userId: ctx.session.user.id,
            },
          },
        });

        if (!existingMembership) {
          await tx.watchlistMember.create({
            data: {
              watchlistId: invite.watchlistId,
              userId: ctx.session.user.id,
              role: WatchlistRole.COLLABORATOR,
            },
          });
        }

        await tx.watchlistInvite.update({
          where: {
            id: invite.id,
          },
          data: {
            acceptedAt: new Date(),
          },
        });
      });

      return {
        success: true,
        watchlistId: invite.watchlistId,
      };
    }),
});
