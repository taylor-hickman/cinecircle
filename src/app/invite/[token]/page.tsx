import { InviteAcceptanceClient } from "~/app/_components/invite-acceptance-client";
import { auth } from "~/server/auth";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const session = await auth();
  const { token } = await params;

  return (
    <InviteAcceptanceClient token={token} viewerEmail={session?.user?.email} />
  );
}
