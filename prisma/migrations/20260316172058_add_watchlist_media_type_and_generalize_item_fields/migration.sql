-- CreateEnum
CREATE TYPE "WatchlistMediaType" AS ENUM ('MOVIE', 'TV');

-- AlterTable
ALTER TABLE "Watchlist"
ADD COLUMN "mediaType" "WatchlistMediaType" NOT NULL DEFAULT 'MOVIE';

-- AlterTable
ALTER TABLE "Watchlist"
ALTER COLUMN "mediaType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WatchlistItem"
RENAME COLUMN "director" TO "creditNames";

-- AlterTable
ALTER TABLE "WatchlistItem"
RENAME COLUMN "releaseYear" TO "year";
