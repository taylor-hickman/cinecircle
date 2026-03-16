TRUNCATE TABLE
  "WatchlistItem",
  "WatchlistInvite",
  "WatchlistMember",
  "Watchlist";

-- AlterTable
ALTER TABLE "WatchlistItem" ADD COLUMN     "director" TEXT;
