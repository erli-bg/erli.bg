// Shared types for the erli-publish worker.

export interface Env {
  // Plain vars (in wrangler.toml [vars]).
  GITHUB_REPO: string;     // "erli-bg/erli.bg"
  GITHUB_BRANCH: string;   // "main"
  SITE_BASE_URL: string;   // "https://erli.bg"

  // Secrets (set via `wrangler secret put`).
  GITHUB_TOKEN: string;            // PAT with contents:write
  POSTMARK_SERVER_TOKEN: string;   // Postmark server API token (outbound)
  ALLOWED_SENDER_EMAIL: string;    // Jakob's address
  POSTMARK_FROM_EMAIL: string;     // verified sender, e.g. info@erli.bg
}

// Postmark Inbound webhook payload (only the fields we need).
// Full schema: https://postmarkapp.com/developer/user-guide/inbound/parse-an-email
export interface PostmarkInbound {
  From: string;
  FromName?: string;
  To: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageID: string;
  Attachments: PostmarkAttachment[];
}

export interface PostmarkAttachment {
  Name: string;
  Content: string;        // base64-encoded
  ContentType: string;
  ContentLength: number;
  ContentID?: string;
}

// Parsed Anki note — six fields per the erli.bg note-type spec.
export interface AnkiNote {
  English: string;
  EnglishExample: string;
  Erli: string;
  ErliExample: string;
  AudioErli: string;   // raw "[sound:filename.mp3]" string
  Vimeo: string;       // URL or empty
}

// What we extract from filename NN_MM-DD-YYYY_Name.apkg
export interface LessonMeta {
  number: number;       // 1..N
  nn: string;           // "01"
  releaseDate: string;  // "06/06" (MM/DD)
  releaseDateFull: string; // "2026-06-06" (YYYY-MM-DD)
  title: string;        // "Greetings"
  ankiFilename: string; // "lesson-01.apkg"
}

// Files staged for the GitHub commit.
export interface CommitFile {
  path: string;
  // Either utf8 text (for .md, .html) or bytes (for binary).
  content: string | Uint8Array;
  encoding: 'utf-8' | 'base64';
}
