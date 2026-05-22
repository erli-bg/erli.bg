# Postmark setup

Postmark sits at the front of the pipeline: you forward an email with the `.apkg` attached to a Postmark inbound address, Postmark POSTs the parsed payload as JSON to the worker, the worker does the rest.

You'll need:
- A Postmark account (free tier is fine — 100 inbound emails/month, 100 outbound/month)
- A few minutes to click through the dashboard
- Your sender email (the one you'll send `.apkg` files FROM) verified

## 1. Create the Postmark account

1. Go to <https://postmarkapp.com/> and sign up. Pick "Sending and receiving emails", confirm the email.
2. After confirmation you land on the dashboard. There's no "select a plan" step — free tier is the default.

## 2. Create a server

A Postmark "Server" is a logical group with its own API token and streams.

1. Dashboard → "Servers" tab → **Add Server**.
2. Name: `erli-publish`. Colour doesn't matter.
3. Save.

You're now inside the server. Note the **Server API token** under the API Tokens tab — you'll paste it into the Worker secret `POSTMARK_SERVER_TOKEN` later. Keep this browser tab open.

## 3. Set up an Inbound Stream

By default the server has an "Inbound" stream. Postmark gives it a unique email address.

1. Inside the `erli-publish` server, click **Default Inbound Stream** (it's pre-created).
2. **Settings → Webhook**. Paste the worker URL here. You don't have it yet — leave this blank for now, come back after `wrangler deploy` runs (it prints the URL). Format is `https://erli-publish.<your-cf-subdomain>.workers.dev/`.
3. **Settings → Custom forwarding domain (optional)**: skip for now. Default address looks like `<32-hex-chars>@inbound.postmarkapp.com`. Save it.
4. **Settings → Spam filter**: leave at default (Postmark drops obvious spam before calling the webhook — fine).

Your inbound address now exists. Save it somewhere — that's where you mail the `.apkg`.

## 4. Verify the sender address (for outbound confirmation emails)

The worker sends a confirmation email back to you via Postmark's outbound API. Postmark requires the `From:` address to be a verified sender.

1. Inside the `erli-publish` server → **Sender Signatures** in the sidebar (or top-level **Servers** → **Sender Signatures**).
2. **Add Sender Signature**.
3. Email: `info@erli.bg` (or whatever address you want the confirmation emails to come from). Name: `erli.bg`.
4. Postmark sends a verification email to that address. Open the email, click the verification link.

If you don't have a mailbox at `info@erli.bg`, the simplest path is to set up a free email forward at your registrar (Netim) that forwards `info@erli.bg` → your personal mailbox, then click the verification link from there. One-time setup.

Alternative: verify your whole domain via DNS (DKIM + SPF + DMARC). More work, but you can then send from any `*@erli.bg`. The dashboard walks you through the records.

## 5. (Optional) Custom inbound domain

By default Postmark's inbound address is ugly: `<hash>@inbound.postmarkapp.com`. If you want a nicer one like `publish@erli.bg`:

1. **Inbound Stream → Settings → Custom forwarding domain**.
2. Add a CNAME at Netim: `publish.erli.bg` → Postmark's MX target (Postmark shows the exact value).
3. Wait for DNS to propagate, click verify.

Skip this for now; the ugly address works fine and you can change it later.

## What you walk away with

- **Server API token** (paste into `POSTMARK_SERVER_TOKEN` worker secret)
- **Inbound address** (where you mail the `.apkg`)
- **Verified sender** (paste into `POSTMARK_FROM_EMAIL` worker secret)
- **Webhook URL** to come back and fill in once the worker is deployed

Now go to `CLOUDFLARE.md`.
