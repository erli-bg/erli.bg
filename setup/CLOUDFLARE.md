# Cloudflare Worker deploy

You already have a Cloudflare account (per your message). Steps to get the `erli-publish` worker live:

## 1. Install wrangler

```sh
npm install -g wrangler
# or with brew:
# brew install cloudflare-wrangler2
```

Verify:

```sh
wrangler --version
# should print something like 3.80.x
```

## 2. Authenticate

Two options, pick one:

### Option A — `wrangler login` (interactive, easiest)

```sh
wrangler login
```

This opens a browser. Sign in to Cloudflare, approve. Done.

### Option B — API token (CI-friendly)

1. Dashboard → top-right profile → **My Profile** → **API Tokens** → **Create Token**.
2. Use the **Edit Cloudflare Workers** template.
3. Permissions: `Account: Workers Scripts: Edit`, `User: Memberships: Read`. Account resources: the account you want to deploy to. Save the token.
4. Export it:
   ```sh
   export CLOUDFLARE_API_TOKEN=<paste here>
   ```

## 3. Install worker dependencies

From the `setup/worker/` directory (or wherever you moved the worker code):

```sh
cd setup/worker
npm install
```

This pulls `wrangler`, `fflate`, `sql.js`, and the TypeScript types. ~30 seconds.

## 4. Set the secrets

The worker reads four secrets from the Cloudflare environment. Set them once via:

```sh
wrangler secret put GITHUB_TOKEN
# Paste a fine-grained PAT scoped to erli-bg/erli.bg with
# Contents: Read & Write. Get one at
# https://github.com/settings/personal-access-tokens

wrangler secret put POSTMARK_SERVER_TOKEN
# Paste the Server Token from your Postmark erli-publish server

wrangler secret put ALLOWED_SENDER_EMAIL
# Paste your email address (the one you'll send .apkg from)

wrangler secret put POSTMARK_FROM_EMAIL
# Paste the verified Postmark sender (e.g. info@erli.bg)
```

Each `secret put` opens an editor or prompts. Hit save / press enter.

The plain (non-secret) vars `GITHUB_REPO`, `GITHUB_BRANCH`, `SITE_BASE_URL` are already in `wrangler.toml` and don't need separate setup.

## 5. Deploy

```sh
wrangler deploy
```

On first deploy wrangler prints something like:

```
Published erli-publish (1.42 sec)
  https://erli-publish.<your-subdomain>.workers.dev
```

**Copy that URL.** That's the webhook Postmark will POST to.

## 6. Wire the webhook into Postmark

Back in the Postmark dashboard:

1. **Server: erli-publish → Default Inbound Stream → Settings → Webhook**.
2. Paste the `workers.dev` URL.
3. Save.

Done.

## 7. (Optional) Custom domain

If you'd rather have `publish.erli.bg` than `erli-publish.<subdomain>.workers.dev`:

1. Cloudflare dashboard → Workers & Pages → `erli-publish` → **Triggers → Custom Domains → Add Custom Domain**.
2. Enter `publish.erli.bg`. Cloudflare creates the DNS record automatically if the zone is theirs; otherwise add a CNAME at Netim pointing to the workers.dev URL.
3. After cert propagates (~1 minute), Postmark webhook URL can be updated to `https://publish.erli.bg/`.

Skip unless you specifically want it.

## 8. Tail logs (for debugging)

```sh
wrangler tail
```

Streams stderr from the worker live. Leave this open in a terminal while sending the demo `.apkg` for the first end-to-end test.

## Troubleshooting

- **`Module not found: sql.js/dist/sql-wasm.wasm`** at deploy: wrangler's WASM rule in `wrangler.toml` should pick it up automatically. If it fails, fall back to fetching from CDN — the code already does this (`locateFile: () => 'https://sql.js.org/dist/...'`).
- **`401` on GitHub commit calls**: PAT lacks `Contents: Read & Write` or has expired. Regenerate.
- **`422` on the ref-update**: branch protection is set and the bot can't push directly. Either disable protection on `main` or push to a side branch and PR.
- **Postmark webhook never fires**: check Postmark → Activity tab for the inbound. Common cause: the webhook URL has a typo. Postmark's inbound activity page tells you exactly what it tried to POST.
