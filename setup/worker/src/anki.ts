// Anki .apkg parsing: unzip + SQLite (collection.anki2) + media extraction.
//
// An .apkg file is a ZIP archive containing:
//   - collection.anki2  : SQLite database (the actual deck/notes/cards)
//   - media             : JSON like { "0": "audio.mp3", "1": "foo.jpg" }
//   - 0, 1, 2, ...      : the actual media files, named by their index
//
// We only need the notes table from the SQLite db. Each note's `flds`
// column is a string with field values separated by U+001F. The field
// order is defined per note-type (in the `col.models` JSON); for our
// purposes Jakob's "Erli Lesson Card" type uses this order:
//   English | English Example | Erli | Erli Example | Audio Erli | Vimeo

import { unzipSync } from 'fflate';
import initSqlJs from 'sql.js';
import type { AnkiNote } from './types';

const FIELD_SEP = '\x1f';

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;

async function getSql() {
  // Lazy-init sql.js. We fetch the wasm from sql.js.org once per worker
  // cold-start; Cloudflare's Cache API holds it across requests on the
  // same isolate. If we ever want bundled wasm instead, switch to
  // `import wasmModule from 'sql.js/dist/sql-wasm.wasm'` plus a
  // WebAssembly.instantiate call — works once wrangler's [[rules]]
  // CompiledWasm import is set up.
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });
  }
  return sqlPromise;
}

export interface ParsedApkg {
  notes: AnkiNote[];
  media: Map<string, Uint8Array>; // originalFilename -> bytes
}

export async function parseApkg(apkgBytes: Uint8Array): Promise<ParsedApkg> {
  // 1. Unzip
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(apkgBytes);
  } catch (err) {
    throw new Error(`unzip failed: ${(err as Error).message}`);
  }

  const collectionBytes = unzipped['collection.anki2'];
  if (!collectionBytes) {
    throw new Error('apkg has no collection.anki2 (is this an Anki 2.1 .apkg?)');
  }
  const mediaJsonBytes = unzipped['media'];
  if (!mediaJsonBytes) {
    throw new Error('apkg has no media manifest');
  }

  // 2. Parse media manifest: { "0": "filename.mp3", ... }
  const mediaText = new TextDecoder('utf-8').decode(mediaJsonBytes);
  let mediaManifest: Record<string, string>;
  try {
    mediaManifest = JSON.parse(mediaText);
  } catch (err) {
    throw new Error(`media manifest is not valid JSON: ${(err as Error).message}`);
  }

  const media = new Map<string, Uint8Array>();
  for (const [index, originalName] of Object.entries(mediaManifest)) {
    const bytes = unzipped[index];
    if (bytes) {
      media.set(originalName, bytes);
    }
  }

  // 3. Parse SQLite — only `notes.flds` is needed.
  const SQL = await getSql();
  const db = new SQL.Database(collectionBytes);
  let notes: AnkiNote[];
  try {
    const result = db.exec('SELECT flds FROM notes ORDER BY id ASC');
    if (result.length === 0) {
      throw new Error('notes table is empty');
    }
    const rows = result[0].values as [string][];
    notes = rows.map(([flds]) => parseFields(flds));
  } finally {
    db.close();
  }

  return { notes, media };
}

function parseFields(fldsRaw: string): AnkiNote {
  const fields = fldsRaw.split(FIELD_SEP);
  // Defensive padding so missing fields are empty strings rather than undefined.
  while (fields.length < 6) fields.push('');
  return {
    English:        fields[0].trim(),
    EnglishExample: fields[1].trim(),
    Erli:           fields[2].trim(),
    ErliExample:    fields[3].trim(),
    AudioErli:      fields[4].trim(),
    Vimeo:          fields[5].trim(),
  };
}

/** Extract the .mp3 (or other) filename from "[sound:foo.mp3]". */
export function extractAudioFilename(rawField: string): string | null {
  const m = rawField.match(/\[sound:([^\]]+)\]/);
  return m ? m[1] : null;
}

/** Pick the first non-empty Vimeo URL across all notes; return its numeric ID. */
export function pickVimeoId(notes: AnkiNote[]): string {
  for (const n of notes) {
    const url = n.Vimeo.trim();
    if (!url) continue;
    // Accept "https://vimeo.com/123456789" or "https://player.vimeo.com/video/123456789"
    const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return m[1];
    // If it's just digits, take it.
    if (/^\d+$/.test(url)) return url;
  }
  return 'XXXXXX';
}
