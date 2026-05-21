// erli-publish — Cloudflare Worker
//
// Postmark Inbound webhook → unzips the attached .apkg → parses Anki notes
// and media → commits one new lesson (markdown + apkg + audio files) to the
// erli-bg/erli.bg main branch → emails a confirmation back to the sender.
//
// All errors are caught and reported by email so Postmark always gets 200.

import { parseApkg } from './anki';
import { renderLessonMarkdown, parseFilename } from './markdown';
import { commitFiles } from './github';
import { sendEmail } from './postmark';
import type { Env, PostmarkInbound, CommitFile } from './types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }

    let payload: PostmarkInbound;
    try {
      payload = await request.json();
    } catch {
      return new Response('invalid JSON', { status: 400 });
    }

    // Whitelist
    const sender = (payload.From || '').toLowerCase().trim();
    if (sender !== env.ALLOWED_SENDER.toLowerCase().trim()) {
      console.warn(`rejected sender: ${sender}`);
      // Don't email the rejected sender (could be spam/spoof).
      return new Response('forbidden', { status: 403 });
    }

    // Hand off to the long-running publisher and reply to Postmark immediately.
    // Postmark retries any non-2xx for up to a day, which would cause duplicate
    // publishes if the work takes >30s or fails transiently. So we 200 fast
    // and surface success/failure via email.
    ctx.waitUntil(publish(payload, env));
    return new Response('queued', { status: 200 });
  },
};

async function publish(payload: PostmarkInbound, env: Env): Promise<void> {
  let lessonTitle = '(unknown)';
  let lessonUrl = '';
  try {
    const apkgAttachment = (payload.Attachments || []).find((a) =>
      a.Name && a.Name.toLowerCase().endsWith('.apkg')
    );
    if (!apkgAttachment) {
      throw new Error('no .apkg attachment found in email');
    }

    const meta = parseFilename(apkgAttachment.Name);
    lessonTitle = meta.title;
    lessonUrl = `${env.SITE_BASE_URL}/lessons/lesson-${meta.nn}.html`;

    const apkgBytes = base64ToBytes(apkgAttachment.Content);

    // Parse Anki
    const { notes, media } = await parseApkg(apkgBytes);
    if (notes.length === 0) {
      throw new Error('apkg has no notes');
    }

    // Render lesson markdown + figure out which audio files to commit
    const { markdown, audioRenames } = renderLessonMarkdown(meta, notes);

    // Stage files for commit
    const files: CommitFile[] = [
      {
        path: `content/lesson-${meta.nn}.md`,
        content: markdown,
        encoding: 'utf-8',
      },
      {
        path: `apkg/lesson-${meta.nn}.apkg`,
        content: apkgBytes,
        encoding: 'base64',
      },
    ];
    for (const [originalName, prefixedName] of audioRenames) {
      const bytes = media.get(originalName);
      if (!bytes) {
        console.warn(`audio file referenced but not present in apkg: ${originalName}`);
        continue;
      }
      files.push({
        path: `audio/${prefixedName}`,
        content: bytes,
        encoding: 'base64',
      });
    }

    // Commit
    const commit = await commitFiles(
      env,
      files,
      `Add lesson: ${meta.title} (auto-published from email)`,
    );

    // Success email
    await sendEmail(env, {
      to: payload.From,
      subject: `Lesson published: ${meta.title}`,
      textBody: [
        `Lesson ${meta.nn} (${meta.title}) committed to the repo.`,
        ``,
        `Live URL: ${lessonUrl}`,
        `Commit:   ${commit.commitUrl}`,
        ``,
        `Source files committed (lesson markdown, .apkg, audio).`,
        `The GitHub Action rebuilds the HTML pages and pushes them`,
        `in a follow-up commit. The live URL should work within`,
        `~60s. If it 404s a minute from now, check the Actions tab:`,
        `https://github.com/${env.GITHUB_REPO}/actions`,
      ].join('\n'),
    });
  } catch (err) {
    const msg = (err as Error).message || String(err);
    console.error(`publish failed: ${msg}`);
    await sendEmail(env, {
      to: payload.From,
      subject: `Lesson publish FAILED: ${lessonTitle}`,
      textBody: [
        `Something went wrong publishing the deck you sent.`,
        ``,
        `Error: ${msg}`,
        ``,
        `Worker logs (last few minutes) may have more detail:`,
        `  wrangler tail`,
      ].join('\n'),
    });
  }
}

function base64ToBytes(b64: string): Uint8Array {
  // Postmark may include line wrapping; strip whitespace defensively.
  const clean = b64.replace(/\s+/g, '');
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
