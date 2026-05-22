// Build the lesson Markdown that build.py will consume.

import type { AnkiNote, LessonMeta } from './types';
import { extractAudioFilename, pickVimeoId } from './anki';

export interface RenderedLesson {
  markdown: string;
  audioRenames: Map<string, string>; // originalFilename -> "NN-originalFilename"
}

export function renderLessonMarkdown(meta: LessonMeta, notes: AnkiNote[]): RenderedLesson {
  const vimeoId = pickVimeoId(notes);
  const audioRenames = new Map<string, string>();

  // Build vocab table rows.
  const tableRows: string[] = [];
  for (const note of notes) {
    const audioFn = extractAudioFilename(note.AudioErli);
    let audioCell = '';
    if (audioFn) {
      const prefixed = `${meta.nn}-${audioFn}`;
      audioRenames.set(audioFn, prefixed);
      audioCell = prefixed;
    }
    const englishCell = note.EnglishExample
      ? `${escapeMd(note.English)}<br><em>${escapeMd(note.EnglishExample)}</em>`
      : escapeMd(note.English);
    const erliCell = note.ErliExample
      ? `${escapeMd(note.Erli)}<br><em>${escapeMd(note.ErliExample)}</em>`
      : escapeMd(note.Erli);
    tableRows.push(`| ${englishCell} | ${erliCell} | ${audioCell} |`);
  }

  const md = [
    `---`,
    `number: ${meta.number}`,
    `release_date: ${meta.releaseDate}`,
    `title: ${meta.title}`,
    `recorded_at: PLACEHOLDER (Fakulteta, Sofia)`,
    `recorded_on: ${meta.releaseDateFull}`,
    `speakers: PLACEHOLDER (initials only)`,
    `vimeo_id: ${vimeoId}`,
    `anki_file: ${meta.ankiFilename}`,
    `---`,
    ``,
    `## Description`,
    ``,
    `(Auto-published from Anki deck. Add a short description here when you have a moment.)`,
    ``,
    `## Vocabulary`,
    ``,
    `| English | Erli | Audio |`,
    `|---|---|---|`,
    ...tableRows,
    ``,
  ].join('\n');

  return { markdown: md, audioRenames };
}

function escapeMd(s: string): string {
  // Minimal: only escape pipe characters that would break the table.
  // Anki users sometimes put HTML inside fields; we preserve that as-is.
  return s.replace(/\|/g, '\\|');
}

const FILENAME_RE = /^(\d{2})_(\d{2})-(\d{2})-(\d{4})_(.+)\.apkg$/i;

/** Parse "01_06-06-2026_Greetings.apkg" → LessonMeta. Throws on bad format. */
export function parseFilename(filename: string): LessonMeta {
  const m = filename.match(FILENAME_RE);
  if (!m) {
    throw new Error(
      `filename '${filename}' must match NN_MM-DD-YYYY_Name.apkg ` +
      `(e.g. 01_06-06-2026_Greetings.apkg)`
    );
  }
  const [, nn, mm, dd, yyyy, name] = m;
  const number = parseInt(nn, 10);
  if (number < 1) {
    throw new Error(`lesson number must be >= 1, got ${nn}`);
  }
  return {
    number,
    nn,
    releaseDate: `${mm}/${dd}`,
    releaseDateFull: `${yyyy}-${mm}-${dd}`,
    title: name.replace(/[-_]/g, ' ').trim(),
    ankiFilename: `lesson-${nn}.apkg`,
  };
}
