# SSR Realty Phase 1 interactive draft

Separate HTML pages with a fresh design, eight illustrative listings, working filters, a property-detail journey, an enquiry preview and SSR Bot.

## Run locally

Requires Node.js 20 or newer. From this directory:

```sh
npm start
```

Open `http://127.0.0.1:4173/`. To run the Gemini-powered interpretation path, set `GEMINI_API_KEY` **in the server environment** before starting. If the key is in a local `.env` file, run `node --env-file=.env server.mjs` instead. An optional `GEMINI_MODEL` overrides the default `gemini-3.5-flash-lite` model. Never put the key into an HTML or JavaScript file; `.env` is excluded by this draft's `.gitignore`.

Without a key, SSR Bot clearly labels itself as a local search preview. It still searches the same demo listings. The live Gemini search path has been checked with a local key; `.env` is excluded by `.gitignore` and the key is never sent to the browser.

## Render demo deployment

Create a GitHub repository containing this `phase1` directory's contents. In Render, create a **Web Service** using the Node runtime and Free instance. If the repository contains `phase1` as a subdirectory, set **Root Directory** to `phase1`; otherwise leave it blank. Set **Build Command** to `npm install` and **Start Command** to `npm start`. Add `GEMINI_API_KEY` in Render's Environment settings, not in the repository. Render supplies `PORT`; the server detects Render and binds to `0.0.0.0` while continuing to use `127.0.0.1` locally.

This is a demo deployment. Render's free service can sleep after idle time, and the in-memory chat limit resets when the instance restarts.

## Draft boundaries

- Property names, imagery, prices, availability and descriptions are illustrative.
- The enquiry form shows a confirmation state without sending or storing details.
- Chat searches the public demo dataset only. It has no access to private spreadsheets, company contacts or external search. A local scope gate rejects unsupported questions before a Gemini call; basic website questions receive fixed, site-specific replies. Model text is used only to interpret filters, never as the final answer.
- The chat endpoint allows 20 requests per IP in a rolling 10-minute window before returning HTTP 429. This is an in-memory limit for the single local server and resets on restart; public access would need a shared limit, bot protection and deployment hardening. No chat history is stored.

Run `npm test` to check rate limiting, scope filtering and inventory search.

## Pages

- `index.html` — home and search entry
- `listings.html` — filters and result cards
- `property.html?id=<listing-id>` — property detail
- `about.html` — proposed company story with Sultan bio placeholder
- `contact.html` — non-submitting enquiry preview

The single inventory source is `data/listings.json`. The server and pages both use it, so the bot and visual search cannot disagree about which demo listings exist.
