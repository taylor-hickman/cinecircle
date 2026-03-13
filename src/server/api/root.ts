import { invitesRouter } from "~/server/api/routers/invites";
import { itemsRouter } from "~/server/api/routers/items";
import { membersRouter } from "~/server/api/routers/members";
import { moviesRouter } from "~/server/api/routers/movies";
import { watchlistsRouter } from "~/server/api/routers/watchlists";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  invites: invitesRouter,
  items: itemsRouter,
  members: membersRouter,
  movies: moviesRouter,
  watchlists: watchlistsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
