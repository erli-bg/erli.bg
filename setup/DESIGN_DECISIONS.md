# Design decisions — Phase 3

This file lists the choices made tonight where the spec was ambiguous, so we can talk them through in the morning rather than block on me waking you up.

## D1. TypeScript with bundled WASM, deployed via wrangler

The worker is written in TypeScript and deployed via `wrangler deploy`. Wrangler handles TS compilation and WASM bundling natively, no separate build step needed. `sql.js` (Anki's SQLite database is in `collection.anki2`, a regular SQLite file) is loaded as a WASM module.

**Alternative considered**: handwritten SQLite reader for the `notes` table only — Anki's collection schema is documented and the `notes.flds` column is a simple `\x1f`-separated string. Would have saved ~250KB of WASM but added ~300 lines of fragile code. Not worth it; sql.js is the canonical choice.

If the worker bundle exceeds Cloudflare's free-tier 1MB compressed limit (it shouldn't — total estimate ~360KB compressed), we'll switch to the handwritten approach or pay $5/mo for the Workers Paid plan.

## D2. ZIP handling via `fflate`, not JSZip

`fflate` is ~10KB vs JSZip's ~100KB. Same API surface for our use (decompress to `Record<string, Uint8Array>`). Worker-compatible.

## D3. GitHub commit via Git Data API, not Contents API

The Contents API only commits one file per request. For atomic multi-file commits (lesson MD + .apkg + N audio files in one commit), we need the Git Data API flow: create blobs → create tree → create commit → update ref. ~50 lines of TS but produces one clean commit per published lesson.

## D4. Audio files — flat `audio/` directory with `NN-` filename prefix

The Anki `[sound:filename.mp3]` reference uses the original filename. Two lessons could ship audio files with the same name (`hello.mp3`). To avoid collisions while keeping `build.py` untouched, the worker prefixes every extracted audio filename with `<NN>-`, e.g., `01-hello.mp3` → committed to `audio/01-hello.mp3`. The lesson Markdown table cell stores `01-hello.mp3`, so `build.py`'s `audio_prefix="../audio/"` resolves correctly.

**Alternative considered**: per-lesson subfolders (`audio/lesson-01/hello.mp3`). Cleaner organisation but requires a `build.py` change to pass a per-lesson `audio_prefix`. Punted to avoid a 5th commit tonight that touches generated lesson HTMLs.

## D5. Single Worker commit per email, no GitHub Action rebuild

The worker generates the lesson HTML and the updated index HTML directly (replicating `build.py`'s output in TypeScript), committing source + generated files in one atomic commit. This avoids the latency and complexity of a separate "GitHub Action runs build.py" step.

**Tradeoff**: `build.py` logic exists in two places (Python and TS). If they drift, that's a bug. The TS code is structured so the inputs/outputs match `build.py` 1:1; we'll keep them in sync manually.

**Alternative considered**: worker commits only source files (`.md`, `.apkg`, audio), then a GitHub Action runs `python3 build.py` and amends a second commit. Two commits per lesson, ~30s additional latency. Possible to switch to this later if the duplication becomes painful.

## D6. Lesson Markdown structure

The worker generates `content/lesson-NN.md` (overwriting placeholders) with this shape:

```markdown
---
number: <N>
release_date: MM/DD
title: <Name>
recorded_at: PLACEHOLDER (Fakulteta, Sofia)
recorded_on: YYYY-MM-DD
speakers: PLACEHOLDER (initials only)
vimeo_id: <ID>
anki_file: lesson-NN.apkg
---

## Description

(empty placeholder — Jakob fills manually post-publish if desired)

## Vocabulary

| English | Erli | Audio |
|---|---|---|
| <English><br><em><EnglishExample></em> | <Erli><br><em><ErliExample></em> | NN-<filename>.mp3 |
```

- `release_date` comes from filename: `01_06-06-2026_Greetings.apkg` → `06/06`
- `vimeo_id` extracted from the first non-empty `Vimeo` field across all notes (Jakob's spec)
- `Description` is left empty; if any future deck includes a "Description" note (e.g. by convention card 1 is the description), we can wire it in
- The 3-column table merges (English + Example) and (Erli + Example) into single cells with inline `<em>` for the example sentence. Audio column shows just the prefixed filename.

## D7. Filename parsing — strict

The worker only accepts filenames matching `^(\d{2})_(\d{2})-(\d{2})-(\d{4})_(.+)\.apkg$`. Anything else returns a 400 with a useful error and sends Jakob a "your filename format is wrong" email.

## D8. Idempotency — overwrite, don't reject

If the same `01_..._Greetings.apkg` is sent twice, the worker overwrites the same paths. The new commit is descriptive ("Add lesson: Greetings (auto-published from email)") — the resulting history shows duplicate commits, which is fine and self-documenting. No "this lesson already exists" rejection.

## D9. Email confirmation — short, with two links

The confirmation email contains:
- The live lesson URL (`https://erli.bg/lessons/lesson-NN.html`)
- The commit URL (`https://github.com/erli-bg/erli.bg/commit/<sha>`)
- Note that GitHub Pages takes ~30–60s to rebuild

On error, the email contains the error message and a hint about which step failed.

## D10. Error handling — return 200 to Postmark, send error mail

Postmark expects 2xx from the webhook; any non-2xx triggers retries that flood the worker with duplicates. We return 200 always (unless the JSON is malformed) and instead surface failures via the confirmation email so Jakob always knows the result.

## D11. Sender whitelist — exact match, single address

`ALLOWED_SENDER_EMAIL` env var holds one email; comparison is case-insensitive `===`. Multiple senders would just need a comma-separated list and a `.split(',').map(s => s.trim().toLowerCase())` — easy to extend if needed.

## D12. GitHub Pages assumption

The site at `https://erli.bg/` is served by GitHub Pages from the `main` branch root. The CNAME file in the repo confirms this. The worker commits to `main`. No staging branch.

## D13. Worker file lives in `setup/worker/` for now, not committed

Per your instruction: nothing in `setup/` gets committed tonight. Decide tomorrow whether to move worker code to a permanent home (likely `/worker/` at repo root) and commit it.

## Open questions for the morning

- **Q1**: Are you OK with the worker doing HTML generation itself, or do you prefer the GitHub Action approach (D5)?
- **Q2**: Flat audio directory with `NN-` prefix vs per-lesson subfolders (D4)?
- **Q3**: Should the worker also delete the old placeholder `content/lesson-NN.md` files when a real one arrives, or leave them? Currently it overwrites the same file (since both have the same name), which is the right semantics.
- **Q4**: Verified sender address for outbound confirmation emails — Postmark requires you to verify a sender domain or address. Cheapest: verify `info@erli.bg`. Need to make sure your DNS at Netim can take Postmark's DKIM/SPF records.
- **Q5**: Postmark Inbound address — do you have a preference for the inbound subdomain? Postmark gives you something like `<hash>@inbound.postmarkapp.com` by default; you can also wire `publish@erli.bg` to forward there, but that adds DNS work.
