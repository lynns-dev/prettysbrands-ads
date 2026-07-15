# Prettys Brands Ads

A standalone Facebook/Meta ad management dashboard for multiple brands: one
shared Meta connection, a campaign/ad-set/creative performance browser per
brand, budget pacing against a monthly target, and automatic cost-cap bid
adjustment toward each brand's target ROAS. No storefront, no public pages —
the whole app sits behind a single admin login.

## What it does

- **Connect once, manage many brands.** One Facebook OAuth connection
  (`ads_management` + `ads_read`) is authorized once and reused for every
  brand's ad account, as long as the authorizing Facebook user is an admin on
  each ad account in Business Manager.
- **Per-brand campaign/ad-set browser** — spend, revenue, and ROAS for every
  campaign and ad set in the lookback window, not just the ones being
  auto-adjusted.
- **Creative-level performance** — the same numbers broken down to
  individual ads, with thumbnails.
- **Budget pacing** — for brands with a monthly budget set, tracks spend to
  date against the pace you'd expect for "day N of an M-day month," projects
  an end-of-month total, and flags over/under pace.
- **Cost-cap bidding auto-adjust** — for ad sets already on Meta's `COST_CAP`
  bid strategy, nudges the bid cap toward the value that would hit a target
  ROAS, using Meta's own Insights purchase revenue (whatever the brand's
  Conversions API/Pixel already reports). Bounded by hard min/max caps and a
  max %-change per run, and skips ad sets that haven't spent enough yet to
  trust the signal. **Off by default per brand** — an operator switches it on
  from that brand's page once the live preview looks right.

## Deploy to Vercel

1. Push this repo to GitHub (already done if you're reading this from
   `lynns-dev/prettysbrands-ads`).
2. In Vercel, **Add New → Project**, import the repo. Framework preset:
   **Next.js** (auto-detected).
3. Add these Environment Variables, then redeploy:

   | Name | Value |
   |------|-------|
   | `REDIS_URL` | a Redis connection string (Redis Cloud, or any provider giving a `redis://`/`rediss://` URL) — sessions, brand configs, the Meta token, adjustment history |
   | `NEXT_PUBLIC_BASE_URL` | your deployed URL, e.g. `https://prettysbrands-ads.vercel.app` |
   | `ADMIN_PASSWORD` | password for this app — there's no per-user login, just one shared operator password |
   | `META_APP_ID` / `META_APP_SECRET` | from a Meta app with the Marketing API product added — see "Facebook app setup" below |
   | `CRON_SECRET` | any random string (e.g. `openssl rand -hex 16`) — restricts the daily auto-adjust cron job to Vercel's own scheduled calls |

4. Visit `/api/meta-auth/connect` once to authorize Facebook Ads.
5. Sign in at `/login`, add a brand from the dashboard (name, ad account ID,
   target ROAS, min/max cost-cap guardrails, optional monthly budget), and
   review its Cost-cap bidding preview before switching auto-adjust on.

## Facebook app setup

1. Go to https://developers.facebook.com, create an app (type **Business**).
2. Add the **Marketing API** product, and under **App Review → Permissions
   and Features** request `ads_management` and `ads_read`. Apps in
   development mode can use these immediately for admins/testers/developers
   of the app — public/agency-wide use needs Meta's App Review.
3. **Settings → Basic** → App ID / App Secret → `META_APP_ID` / `META_APP_SECRET`.
4. **Facebook Login → Settings → Valid OAuth Redirect URIs** → add
   `https://YOUR_DOMAIN/api/meta-auth/callback`.
5. For each brand you add in the dashboard, find its ad account ID in Ads
   Manager (format `act_1234567890`) — the app will prefix `act_`
   automatically if you paste just the number.

The connection lasts about 60 days (Meta's long-lived token limit) and can't
silently refresh like an OAuth refresh token — the dashboard shows the
expiry so you can re-authorize via `/api/meta-auth/connect` before it lapses.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

## Structure

- `pages/login.jsx`, `pages/api/login.js`, `pages/api/logout.js` — single shared admin login
- `pages/index.jsx` — brand list dashboard: connection status, add/remove brands, auto-adjust toggle, budget pacing at a glance
- `pages/brand/[id].jsx` — per-brand detail: cost-cap bidding panel (preview/run now/history), campaign & ad-set browser, creative performance, budget pacing, editable settings
- `pages/api/meta-auth/connect.js`, `pages/api/meta-auth/callback.js` — one-time, shared Facebook OAuth flow
- `pages/api/brands/*` — brand CRUD, per-brand overview/auto-adjust/toggle endpoints
- `pages/api/cron/ads-auto-adjust.js` — daily Vercel Cron job (see `vercel.json`), loops every brand with auto-adjust enabled
- `lib/metaMarketingApi.js` — Meta Marketing API client: campaigns, ad sets, ads/creatives, Insights, bid updates
- `lib/costCapBidding.js` — computes each ad set's bid-cap adjustment from its ROAS vs. a brand's target, with min/max/step guardrails
- `lib/budgetPacing.js` — month-to-date spend vs. a brand's monthly budget
- `lib/brandsStore.js` — KV-backed brand configs (ad account, ROAS target, cost-cap bounds, budget, auto-adjust flag)
- `lib/adSpendStore.js` — per-brand audit log of applied adjustments
- `lib/metaAdsTokenStore.js`, `lib/metaAdsAuth.js` — the shared Meta OAuth token
- `lib/adminAuth.js`, `lib/kv.js` — session handling and the shared Redis (ioredis) helper
- `lib/requireAuth.js` — API-route auth guard (session check runs here and via `getServerSideProps` on protected pages — not in middleware, since the Redis client needs a Node.js runtime that Edge middleware doesn't provide)

## Notes

- **Currency assumption:** cost-cap and budget figures are stored in the
  account's currency *minor unit* (cents for USD/EUR/GBP/...). Meta's
  Insights API reports spend/revenue in the major unit, so `lib/metaMarketingApi.js`
  converts by ×100 — this doesn't hold for zero-decimal currencies (JPY, KRW, ...).
- **Multi-brand ad accounts:** every brand shares the one Meta connection,
  so the authorizing Facebook user needs to already be an admin on each
  brand's ad account before you add it here.
