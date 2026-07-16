# Prettys Brands Ads

A minimal Facebook/Meta ad management dashboard: one shared Meta connection,
multiple brands (ad accounts), and — for now — exactly one thing per brand:
today's spend, ROAS, and CPA for every active ad set. No storefront, no
public pages — the whole app sits behind a single admin login.

This is a deliberately stripped-down restart. A much larger version of this
app (cost-cap bidding automation, AI winner detection, ad-refresh/fatigue
detection, trend analysis, budget pacing, push notifications) was built and
then cut back down to this core on purpose, to rebuild features one at a
time on a small, well-understood base rather than all at once.

## What it does

- **Connect once, manage many brands.** One Facebook OAuth connection
  (`ads_management` + `ads_read`) is authorized once and reused for every
  brand's ad account, as long as the authorizing Facebook user is an admin on
  each ad account in Business Manager.
- **Today's performance, per ad set.** For every active ad set in a brand's
  account: today's spend, ROAS (revenue ÷ spend from Meta's own attributed
  purchase data), and CPA (cost per acquisition — spend ÷ purchases). Sorted
  by spend, highest first.
- **Revive winning creatives.** On demand, scans every paused/inactive ad
  for a historical ROAS at or above the brand's target (over a configurable
  lookback, with a minimum spend to trust the number) and flags the ones
  that once worked but aren't live now. Duplicating one copies a
  brand-designated "template" ad set's targeting/placements/optimization
  goal into the brand's designated scaling campaign as a fresh ad set on
  `COST_CAP` bidding with its own ad-set-level (ABO) daily budget, then
  creates a new ad there reusing the winning creative. Manual, reviewed
  action — nothing is created until you click "Duplicate" on a specific
  candidate.

That's the entire feature set right now.

## Deploy to Vercel

1. Push this repo to GitHub (already done if you're reading this from
   `lynns-dev/prettysbrands-ads`).
2. In Vercel, **Add New → Project**, import the repo. Framework preset:
   **Next.js** (auto-detected).
3. Add these Environment Variables, then redeploy:

   | Name | Value |
   |------|-------|
   | `REDIS_URL` | a Redis connection string (Redis Cloud, or any provider giving a `redis://`/`rediss://` URL) — sessions, brand configs, the Meta token |
   | `NEXT_PUBLIC_BASE_URL` | your deployed URL, e.g. `https://prettysbrands-ads.vercel.app` |
   | `ADMIN_PASSWORD` | password for this app — there's no per-user login, just one shared operator password |
   | `META_APP_ID` / `META_APP_SECRET` | from a Meta app with the Marketing API product added — see "Facebook app setup" below |

4. Visit `/api/meta-auth/connect` once to authorize Facebook Ads.
5. Sign in at `/login`, add a brand from the dashboard (name + ad account
   ID), and open it to see today's per-ad-set performance.

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
- `pages/index.jsx` — brand list dashboard: connection status, add/remove brands
- `pages/brand/[id].jsx` — per-brand detail: today's spend/ROAS/CPA per ad set, creative revival scan/duplicate, editable settings
- `pages/api/meta-auth/connect.js`, `pages/api/meta-auth/callback.js` — one-time, shared Facebook OAuth flow
- `pages/api/brands/*` — brand CRUD + per-brand overview endpoint; `[id]/revivable.js` (scan) and `[id]/revive.js` (duplicate) for creative revival
- `lib/metaMarketingApi.js` — Meta Marketing API client: active ad sets, all ads (any status), Insights (spend/revenue/purchases) at ad-set or ad level, ad-set copy (into a different campaign), COST_CAP + ABO budget update, ad creation from an existing creative
- `lib/todayPerformance.js` — today's spend/ROAS/CPA per active ad set, sorted by spend
- `lib/creativeRevival.js` — finds past-winning ads that aren't live now and duplicates one into a fresh ad set; `lib/creativeRevivalStore.js` is its per-brand audit log
- `lib/brandsStore.js` — KV-backed brand configs (name, ad account ID, creative-revival thresholds/destination)
- `lib/metaAdsTokenStore.js`, `lib/metaAdsAuth.js` — the shared Meta OAuth token
- `lib/adminAuth.js`, `lib/kv.js` — session handling and the shared Redis (ioredis) helper
- `lib/requireAuth.js` — API-route auth guard (session check runs here and via `getServerSideProps` on protected pages — not in middleware, since the Redis client needs a Node.js runtime that Edge middleware doesn't provide)

## Notes

- **Currency assumption:** spend/revenue figures are stored in the account's
  currency *minor unit* (cents for USD/EUR/GBP/...). Meta's Insights API
  reports them in the major unit, so `lib/metaMarketingApi.js` converts by
  ×100 — this doesn't hold for zero-decimal currencies (JPY, KRW, ...).
- **Multi-brand ad accounts:** every brand shares the one Meta connection,
  so the authorizing Facebook user needs to already be an admin on each
  brand's ad account before you add it here.
- **"Today" is genuinely today:** Meta's attribution can lag by up to a day
  or two, so today's numbers are necessarily partial and will keep climbing
  as more conversions get attributed — that's the platform, not a bug here.
- **ABO requires a non-CBO destination campaign:** the scaling campaign a
  revived creative lands in must NOT have Campaign Budget Optimization
  turned on — Meta rejects an ad-set-level daily budget under a CBO
  campaign. If "Duplicate" fails with a budget-related error, this is the
  first thing to check.
- **Template ad set ID and scaling campaign ID are raw Meta IDs**, not
  names — find them in Ads Manager (or the URL when viewing that ad
  set/campaign) and paste the numeric ID in, same as the ad account ID.
