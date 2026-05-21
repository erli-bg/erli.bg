// Shared types for the erli-publish worker.

export interface Env {
  // Plain vars (in wrangler.toml [vars]).
  GITHUB_REPO: string;     // "erli-bg/erli.bg"
  GITHUB_BRANCH: string;   // "main"
  SITE_BASE_URL: string;   // "https://erli.bg"

  // Secrets (set via `wrangler secret put`).
  GITHUB_TOKEN: string;          // PAT with contents:write
  POSTMARK_TOKEN: string;        // Postmark server API token (outbound)
  ALLOWED_SENDER: string;        // Jakob's address; also the verified
                                 // Postmark From: for confirmation mail.
}

// Postmark Inbound webhook payload (only the fields we need).
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
  Content: string;
  ContentType: string;
  ContentLength: number;
  ContentID?: string;
}

export interface AnkiNote {
  English: string;
  EnglishExample: string;
  Erli: string;
  ErliExample: string;
  AudioErli: string;
  Vimeo: string;
}

export interface LessonMeta {
  number: number;
  nn: string;
  releaseDate: string;
  releaseDateFull: string;
  title: string;
  ankiFilename: string;
}

export interface CommitFile {
  path: string;
  content: string | Uint8Array;
  encoding: 'utf-8' | 'base64';
}
