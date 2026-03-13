import { redirect } from "next/navigation";

import { WatchlistDetailClient } from "~/app/_components/watchlist-detail-client";
import { auth } from "~/server/auth";

type WatchlistPageProps = {
  params: Promise<{
    listId: string;
  }>;
};

export default async function WatchlistPage({ params }: WatchlistPageProps) {
  const session = await auth();
  if (!session?.user) {
    const { listId } = await params;
    redirect(
      `/api/auth/signin?callbackUrl=${encodeURIComponent(`/lists/${listId}`)}`,
    );
  }

  const { listId } = await params;
  return <WatchlistDetailClient watchlistId={listId} />;
}
