import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getMovieDetails, searchMovies } from "~/server/tmdb";

export const moviesRouter = createTRPCRouter({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().min(2).max(100),
      }),
    )
    .query(async ({ input }) => searchMovies(input.query)),

  details: protectedProcedure
    .input(
      z.object({
        tmdbId: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => getMovieDetails(input.tmdbId)),
});
