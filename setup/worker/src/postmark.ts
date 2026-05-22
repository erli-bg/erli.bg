// Outbound confirmation/error email via Postmark API.
// https://postmarkapp.com/developer/api/email-api

import type { Env } from './types';

export async function sendEmail(
  env: Env,
  opts: { to: string; subject: string; textBody: string },
): Promise<void> {
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': env.POSTMARK_SERVER_TOKEN,
    },
    body: JSON.stringify({
      From: env.POSTMARK_FROM_EMAIL,
      To: opts.to,
      Subject: opts.subject,
      TextBody: opts.textBody,
      MessageStream: 'outbound',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`postmark send failed ${res.status}: ${body.slice(0, 300)}`);
    // Don't throw — failing to send the confirmation should not undo
    // a successful publish.
  }
}
