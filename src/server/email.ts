import "server-only";

import { TRPCError } from "@trpc/server";
import { Resend } from "resend";

import { env } from "~/env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

type InviteEmailInput = {
  email: string;
  inviteUrl: string;
  inviterName: string;
  watchlistName: string;
};

export async function sendWatchlistInviteEmail(input: InviteEmailInput) {
  if (!resend || !env.RESEND_FROM_EMAIL) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Resend invite email is not configured.",
    });
  }

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.email,
    subject: `${input.inviterName} invited you to "${input.watchlistName}"`,
    text: `${input.inviterName} invited you to collaborate on "${input.watchlistName}". Open ${input.inviteUrl} to accept the invite.`,
  });
}
