# Morning walkthrough — getting Phase 3 live in ~30 minutes

This is the single file to follow. Everything else (`POSTMARK.md`, `CLOUDFLARE.md`, `ANKI_NOTE_TYPE.md`, `DESIGN_DECISIONS.md`) is referenced from here.

The pipeline you're building:

```
[ your computer ]  ─── email + .apkg attachment ──→  [ Postmark Inbound ]
                                                          │
                                                          │  webhook (JSON)
                                                          ▼
                                              [ Cloudflare Worker ]
                                                          │
                                                          │  Git Data API
                                                          ▼
                                              [ erli-bg/erli.bg repo ]
                                                          │
                                                          │  push triggers Action
                                                          ▼
                                              [ GitHub Actions: build.py ]
                                                          │
                                                          │  HTML pushed back
                                                          ▼
                                              [ GitHub Pages → erli.bg ]
                                                          │
                                                          │  confirmation
                                                          ▼
                                              [ your inbox ]
```

## Step 0 — Push the four pending commits

These are sitting on local `main`, ahead of origin. They are independent of Phase 3 and should go first so the rest of the work has a clean base.

```sh
cd ~/erli.bg
brew install gh
gh auth login          # browser flow, ~30s
git push origin main
```

After this push the live site shows:
- the new index structure (Erli intro + Pronunciation TOC + Lessons + About)
- pronunciation.html
- about.html with Who/Why anchors
- the rebased lesson-release-dates commit

Confirm at <https://github.com/erli-bg/erli.bg/commits/main> and <https://erli.bg/> (give Pages a minute to rebuild).

## Step 1 — Drop the GitHub Action into place

```sh
cd ~/erli.bg
mkdir -p .github/workflows
cp setup/github-actions/build.yml .github/workflows/build.yml
git add .github/workflows/build.yml
git commit -m "GitHub Action: auto-rebuild HTML when content changes"
git push origin main
```

The Action is now installed. Nothing happens yet — it only runs when `content/`, `apkg/`, or `build.py` change. The next commit from the worker will trigger it.

## Step 2 — Postmark

Follow `POSTMARK.md` end-to-end. You walk away with:
- Postmark Server API token
- Inbound address (`<hash>@inbound.postmarkapp.com`)
- Verified sender email
- The webhook URL field left blank — you'll fill it in Step 4.

## Step 3 — Cloudflare Worker

Move the worker code into place. (Or keep it in `setup/` if you're not ready to commit it.)

```sh
cd ~/erli.bg/setup/worker
npm install              # ~30s
wrangler login           # browser flow
wrangler secret put GITHUB_TOKEN
wrangler secret put POSTMARK_SERVER_TOKEN
wrangler secret put ALLOWED_SENDER_EMAIL
wrangler secret put POSTMARK_FROM_EMAIL
wrangler deploy
```

The last command prints `https://erli-publish.<your-subdomain>.workers.dev`. Copy it.

Detailed steps and troubleshooting in `CLOUDFLARE.md`.

## Step 4 — Connect Postmark to the Worker

Postmark dashboard → `erli-publish` server → Default Inbound Stream → Settings → Webhook → paste the workers.dev URL → Save.

## Step 5 — End-to-end test with the demo deck

In a terminal, leave this running so you can watch the worker:

```sh
cd ~/erli.bg/setup/worker
wrangler tail
```

In your mail client, send a new email to your Postmark inbound address:

- To: `<hash>@inbound.postmarkapp.com` (the address from Step 2)
- Subject: anything, e.g. "Demo lesson"
- Body: anything
- Attachment: `setup/99_05-22-2026_Demo.apkg`

Within ~10 seconds you should see in `wrangler tail`:

```
publish OK: lesson 99 (Demo) → <commit URL>
```

Within ~60 seconds:
1. The commit appears at <https://github.com/erli-bg/erli.bg/commits/main>
2. The Action runs and commits a second time with the regenerated HTML
3. A confirmation email lands in your inbox with the live URL
4. <https://erli.bg/lessons/lesson-99.html> serves the demo lesson

If anything fails, you get an error email instead. The error message tells you which step blew up. Common ones:
- `unzip failed: ...` — the attachment isn't a real .apkg
- `apkg has no notes` — the deck is empty
- `GitHub POST /repos/... -> 401` — `GITHUB_TOKEN` secret is missing or wrong
- `lesson number must be >= 1` — filename doesn't match `NN_MM-DD-YYYY_Name.apkg`

## Step 6 — Clean up the demo

Once the demo confirms the pipeline works:

```sh
cd ~/erli.bg
git pull
rm content/lesson-99.md apkg/lesson-99.apkg audio/99-*.mp3
git add -A
git commit -m "Remove demo lesson 99 — pipeline verified"
git push
```

The Action runs, regenerates the index without Lesson 99, pushes the cleaned HTML. Live site is back to placeholder-only state.

## Step 7 — Set up the Anki note type

Follow `ANKI_NOTE_TYPE.md`. ~5 minutes of clicking through Anki's "Manage Note Types" dialog.

## Step 8 — Publish lesson 1 for real

Once you have your real recordings:

1. Create a deck in Anki using the `Erli Lesson Card` note type. Add notes for greetings — words, examples, audio recordings (drop-in mp3 files), and on note 1 set Vimeo to your video URL.
2. **File → Export → Anki Deck Package (`.apkg`)**. Include media. Filename: `01_06-06-2026_Greetings.apkg`.
3. Email to the Postmark inbound address.
4. Confirmation lands in ~60s. Live at <https://erli.bg/lessons/lesson-01.html>.

The first real publish also auto-removes the nine remaining placeholder lessons from the index (Variante A: as soon as ≥1 lesson is published, the index switches to showing only published lessons).

## File map — what is where

```
~/erli.bg/
├── setup/                         (NOT committed, you decide where to move things)
│   ├── MORNING_WALKTHROUGH.md     this file
│   ├── DESIGN_DECISIONS.md        choices I made; review at your leisure
│   ├── POSTMARK.md                step-by-step for Postmark
│   ├── CLOUDFLARE.md              step-by-step for Cloudflare + wrangler
│   ├── ANKI_NOTE_TYPE.md          field spec + card template + Anki config
│   ├── 99_05-22-2026_Demo.apkg    demo deck for end-to-end test
│   ├── demo-lesson.apkg           same deck, just under its build-time name
│   ├── worker/                    Cloudflare Worker source
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── wrangler.toml
│   │   └── src/
│   │       ├── index.ts           entry: fetch handler
│   │       ├── anki.ts            unzip + sql.js parsing
│   │       ├── markdown.ts        renders the lesson .md
│   │       ├── github.ts          Git Data API commit
│   │       ├── postmark.ts        outbound confirmation email
│   │       └── types.ts           shared types
│   └── github-actions/
│       └── build.yml              auto-rebuild Action, move to .github/workflows/
│
├── content/lesson-*.md            unchanged; will be overwritten by worker
├── lessons/lesson-*.html          generated by build.py
├── apkg/                          empty; worker will populate
├── audio/                         empty; worker will populate
├── build.py                       unchanged
├── pronunciation.html             new (committed)
├── about.html                     restructured (committed)
├── index.html                     new structure (committed)
├── sources.html                   unchanged
├── push-to-github.sh              unchanged (one-shot, you've already used it)
└── README.md                      unchanged
```

## Time budget

- Step 0 (push existing): 2 min
- Step 1 (Action): 1 min
- Step 2 (Postmark): 5–10 min (mostly waiting for verification email)
- Step 3 (Cloudflare): 5 min
- Step 4 (Postmark webhook): 1 min
- Step 5 (demo test): 2 min
- Step 6 (demo cleanup): 1 min
- Step 7 (Anki note type): 5 min
- **Total ~25 minutes** if nothing goes wrong.

When you have your real Lesson 1 material, Step 8 is then ~30 seconds (record deck → email → wait).
