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
- **AI winner detection** — on demand, Claude reviews every active ad in
  campaigns matching a brand's "testing campaign pattern" and flags which
  ones look like winners worth promoting into their own `COST_CAP` scaling
  campaign, with reasoning per ad. Read-only — it's a recommendation, not an
  automated action; requires `ANTHROPIC_API_KEY`.
- **Ad-refresh (fatigue) auto-detection** — for single-ad `COST_CAP` ad sets,
  flags an ad as fatigued when its actual cost per result has drifted well
  over the ad set's cost cap *while spend hasn't dropped off* (Meta is still
  feeding it budget on accumulated relevance rather than genuinely meeting
  the cap). When triggered, the ad set is deep-copied into a fresh one (new
  ad, same targeting/budget/cap) and the original is paused. **Off by
  default per brand.**
- **Performance trends & recommendation** — on demand, Claude looks back
  across a brand's `COST_CAP` ad sets day by day and finds what the
  highest-ROAS, highest-spend days had in common: how many winning creatives
  were live at once, cost-cap amount, and bid strategy — then writes one
  actionable recommendation. Read-only, like winner detection; requires
  `ANTHROPIC_API_KEY`.
- **Live ad-spend ticker** — today's spend, polled every ~30s, shown as a
  total across all brands on the dashboard and per-brand on each brand page.
- **Pacing alerts (phone push)** — a once-daily check (see the Vercel Cron
  plan note below) compares each brand's spend so far today against an
  expected daily budget (its monthly budget split across the days in the
  month) and pushes a notification to any opted-in device when it's tracking
  too fast or too slow, and again when it recovers. Requires a brand to have
  a monthly budget set, and Web Push to be configured (see below) and
  enabled from the dashboard's "Enable phone notifications" button.

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
   | `CRON_SECRET` | any random string (e.g. `openssl rand -hex 16`) — restricts the daily auto-adjust and pacing-check cron jobs to Vercel's own scheduled calls |
   | `ANTHROPIC_API_KEY` | *(optional)* powers "Winner detection" and "Performance trends & recommendation" — get one at console.anthropic.com |
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | *(optional)* powers phone push notifications for pacing alerts — generate with `npx web-push generate-vapid-keys`; set `VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the same public key value, keep the private key secret |

   > **Vercel Cron plan note:** the Hobby plan rejects the *entire deployment*
   > if `vercel.json` has any cron schedule that would run more than once a
   > day — it's not a soft downgrade, the build fails outright. That's why
   > both cron entries in `vercel.json` (`ads-auto-adjust` at 13:00 UTC,
   > `pacing-check` at 20:00 UTC) are once-daily by default. If you're on a
   > Pro plan or higher and want the pacing check to run more often (hourly
   > catches same-day drift much faster), change its schedule to `0 * * * *`.

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
- `pages/api/cron/pacing-check.js` — once-daily Vercel Cron job (hourly on Pro+, see the plan note above), checks every brand's daily pacing and pushes a phone notification on status changes
- `pages/api/live-spend.js`, `components/LiveSpendTicker.jsx` — today's spend, polled every ~30s, Redis-cached briefly to survive multiple tabs
- `pages/api/push/subscribe.js`, `lib/webPush.js`, `public/sw.js`, `components/NotificationOptIn.jsx` — Web Push opt-in, subscription storage, and sending
- `lib/metaMarketingApi.js` — Meta Marketing API client: campaigns, ad sets, ads/creatives, Insights (including day-by-day time series), bid updates, ad-set copy/status
- `lib/costCapBidding.js` — computes each ad set's bid-cap adjustment from its ROAS vs. a brand's target, with min/max/step guardrails
- `lib/adFatigue.js` — detects single-ad `COST_CAP` ad sets whose cost per result has drifted over cap without spend dropping off, and deep-copies + pauses them; `lib/adRefreshStore.js` is its per-brand audit log
- `lib/aiInsights.js` — Claude-powered winner detection over a brand's testing-pool ads (see `pages/api/brands/[id]/winners.js`)
- `lib/trendAnalysis.js` — Claude-powered day-by-day trend analysis + recommendation over a brand's cost-cap ad sets (see `pages/api/brands/[id]/trends.js`)
- `lib/budgetPacing.js` — month-to-date spend vs. a brand's monthly budget
- `lib/pacingAlerts.js` — day-level pacing vs. an expected daily budget, with push-notification de-duping so alerts fire once per status change per day
- `lib/brandsStore.js` — KV-backed brand configs (ad account, ROAS target, cost-cap bounds, budget, testing pattern, fatigue guardrails, auto-adjust/auto-refresh flags)
- `lib/adSpendStore.js` — per-brand audit log of applied cost-cap adjustments
- `lib/dateRange.js` — shared "last N days" helper
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
- **Ad-refresh scope:** only ad sets with exactly one active ad are
  evaluated for fatigue — deep-copying an ad set with several ads would
  duplicate all of them, not just the fatigued one, so multi-ad ad sets are
  skipped rather than guessed at.
- **Winner detection cost:** each run calls the Claude API (`claude-opus-4-8`)
  over every active ad in the matched testing campaigns — it's a manual
  button, not part of the daily cron, precisely so it only runs (and costs
  tokens) when you ask for it.
- **Trend analysis caveat:** the cap-amount/bid-strategy figures joined onto
  each historical day come from each ad set's *current* settings — Meta's
  Insights API doesn't expose a history of bid/cap changes. Fine as a proxy
  when caps don't change often, but not literally what was set on that day
  if it's been edited since.
- **Phone notifications on iPhone:** iOS Safari only delivers Web Push to a
  site that's been added to the Home Screen (Share → Add to Home Screen,
  iOS 16.4+) and opened from there at least once — a plain browser tab won't
  receive pushes. Android/desktop Chrome and Firefox work from a normal tab.
