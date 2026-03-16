import { z } from "zod";

import { getMediaDetails, searchMedia } from "~/server/tmdb";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { watchlistMediaTypes } from "~/lib/watchlist-media";

const mediaTypeSchema = z.enum(watchlistMediaTypes);

export const mediaRouter = createTRPCRouter({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().min(2).max(100),
        mediaType: mediaTypeSchema,
      }),
    )
    .query(async ({ input }) => searchMedia(input.query, input.mediaType)),

  details: protectedProcedure
    .input(
      z.object({
        tmdbId: z.number().int().positive(),
        mediaType: mediaTypeSchema,
      }),
    )
    .query(async ({ input }) => getMediaDetails(input.tmdbId, input.mediaType)),
});
