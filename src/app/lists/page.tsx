import { redirect } from "next/navigation";

import { DashboardClient } from "~/app/_components/dashboard-client";
import { auth } from "~/server/auth";

export default async function ListsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=%2Flists");
  }

  return <DashboardClient />;
}
