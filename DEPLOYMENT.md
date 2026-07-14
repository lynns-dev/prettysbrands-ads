# Smells Iconic Full E-Commerce Site — Deployment Guide

This is a Next.js e-commerce site with a full product catalog, detailed product pages, shopping cart, and a custom checkout page that charges cards directly via QuickBooks Payments (no Shopify, no hosted redirect). Built in Smells Iconic's blush-and-cream, internet-archive aesthetic.

## What You Get

- **Homepage** with hero, featured products, brand story, and value proposition
- **Product catalog page** with all Smells Iconic body mists
- **Individual product detail pages** with full descriptions, scent notes, and product specifications
- **Shopping cart** (persists across pages via localStorage, sticky sidebar)
- **Custom single-page checkout** (`/checkout`, styled after Shopify's checkout) that charges QuickBooks Payments directly
- **Deployed to Vercel** (free, automatic scaling, HTTPS included)

---

## Step 1: Set Up QuickBooks Payments

1. Go to https://developer.intuit.com and sign in (or create an Intuit account).
2. Create a new app → **QuickBooks Online and Payments**.
3. On the app's **Payments** tab, enable QuickBooks Payments. This is tied to a merchant account — if you don't already have QuickBooks Payments active on your QuickBooks Online account, you'll need to complete Intuit's merchant underwriting first.
4. Under **Keys & OAuth**, grab the **Client ID** and **Client Secret** for the Sandbox environment (use Production once you're ready to take real charges). These go in `QB_CLIENT_ID` / `QB_CLIENT_SECRET`.
5. In that same **Keys & OAuth** section, add a redirect URI: `https://YOUR_DOMAIN/api/qb-auth/callback` (use your Vercel URL, or `http://localhost:3000/api/qb-auth/callback` for local testing).

### ⚠️ Two non-obvious ways to get the Charges API to fail even with a valid OAuth connection

Both of these were root-caused by direct testing against Intuit's sandbox and are easy to hit again if this integration is ever rebuilt or reconnected:

1. **Development vs. Production credentials must match `QB_ENVIRONMENT`.** Intuit issues a completely separate Client ID/Secret pair per environment (Keys & Credentials → Development / Production tabs), each with its own Redirect URIs list (Settings → Redirect URIs → Development / Production tabs). Using a Production Client ID while `QB_ENVIRONMENT=sandbox` (or vice versa) produces an access token whose environment doesn't match the API base URL it's sent to — Intuit's gateway rejects it with an **empty-body 403** before the request ever reaches real charge logic. Fix: make sure `QB_CLIENT_ID`/`QB_CLIENT_SECRET` come from the same Development/Production tab as `QB_ENVIRONMENT`, and that the matching redirect URI is registered under that same tab.
2. **Don't request `com.intuit.quickbooks.accounting` together with `com.intuit.quickbooks.payment`** in the same OAuth authorization. A combined-scope token consistently 401s (`AuthenticationFailed`) on the Payments Charges API even though it's otherwise valid — request `com.intuit.quickbooks.payment` alone (see `pages/api/qb-auth/connect.js`). This was confirmed by testing both variants directly against `sandbox.api.intuit.com/quickbooks/v4/payments/charges`.

If charges still fail after both of the above are correct, the remaining possibility is Intuit's separate Payments production-access approval (business verification / security questionnaire, found under the app's **Payments** tab if applicable) — but rule out #1 and #2 first, since they're far more common and produce very similar-looking errors.

---

## Step 1b: Set Up Facebook Ads Cost-Cap Auto-Adjust (optional)

This connects to a Meta (Facebook) ad account, reads each COST_CAP ad set's
recent spend and Meta-attributed purchase revenue, and automatically nudges
its bid cap toward your target ROAS — bounded by hard min/max guardrails so
one bad signal can't move spend far in a single pass. Skip this whole section
if you don't want automatic bid changes; the rest of the site works without it.

1. Go to https://developers.facebook.com and create an app (type **Business**).
2. Add the **Marketing API** product to the app, and under **App Review →
   Permissions and Features**, request `ads_management` and `ads_read`. Apps
   in development mode can use these immediately for admins/testers/developers
   of the app — full public/agency use needs Meta's App Review.
3. Under **Settings → Basic**, grab the **App ID** / **App Secret** →
   `META_APP_ID` / `META_APP_SECRET`.
4. Under **Facebook Login → Settings**, add a valid OAuth redirect URI:
   `https://YOUR_DOMAIN/api/meta-ads-auth/callback`.
5. Find the ad account ID you want to manage (Ads Manager → Account overview,
   format `act_1234567890`) → `META_AD_ACCOUNT_ID`.
6. Decide your bidding guardrails, in your ad account's currency **minor
   units** (cents for USD):
   - `META_TARGET_ROAS` — target revenue-per-ad-dollar, e.g. `3` for 3x.
   - `META_MIN_COST_CAP_CENTS` / `META_MAX_COST_CAP_CENTS` — hard floor/ceiling
     the auto-adjust will never move a cap outside of, regardless of signal.
   - `META_MAX_ADJUSTMENT_PCT` (optional, default `20`) — max % a single run
     can move any one ad set's cap.
   - `META_MIN_SPEND_MULTIPLIER` (optional, default `10`) — an ad set is
     skipped until it's spent at least this many times its current cap in the
     lookback window, so a handful of early results can't swing the cap.
   - `META_INSIGHTS_LOOKBACK_DAYS` (optional, default `7`).
7. Visit `/api/meta-ads-auth/connect` once to authorize. Unlike QuickBooks,
   this token can't silently refresh — it lasts ~60 days, and the admin panel
   shows the expiry so you can re-authorize before it lapses.
8. In `/admin`, the **Facebook Ads — cost cap bidding** panel shows every
   active COST_CAP ad set's spend/revenue/ROAS and what the next pass would
   do. **Auto-adjust is off by default** — flip it on there once you're happy
   with the preview. A daily Vercel Cron job (`vercel.json`) then runs the
   pass automatically; "Run adjustment now" in the panel runs it on demand
   regardless of that switch. Set `CRON_SECRET` (any random string) so only
   Vercel's own scheduled invocations can trigger it.

Only ad sets already on Meta's `COST_CAP` bid strategy are touched — other
bid strategies are left alone. Revenue comes from Meta's own Insights
`action_values` for purchases, which already reflects the Purchase events this
site sends via `lib/metaCapi.js` (Conversions API) — no extra wiring needed.

---

## Step 2: Deploy to Vercel

### Option A: Quick Deploy (Recommended)

1. Go to https://vercel.com and sign up (or log in with GitHub)
2. Click "New Project" → "Import Git Repository"
3. Select this repo
4. Click "Deploy"
5. After deployment, go to "Settings" → "Environment Variables"
6. Add:
   - `QB_CLIENT_ID` / `QB_CLIENT_SECRET`: from Step 1
   - `QB_ENVIRONMENT` and `NEXT_PUBLIC_QB_ENVIRONMENT`: both `sandbox` (or both `production` once approved — see Step 1)
   - `KV_REST_API_URL` / `KV_REST_API_TOKEN`: from a KV store (Vercel Storage → Marketplace → Upstash, or a standalone Upstash Redis database — same REST API either way)
   - `NEXT_PUBLIC_BASE_URL`: your Vercel domain (e.g., `https://smells-iconic.vercel.app`)
   - (optional) `META_APP_ID` / `META_APP_SECRET` / `META_AD_ACCOUNT_ID` / `META_TARGET_ROAS` / `META_MIN_COST_CAP_CENTS` / `META_MAX_COST_CAP_CENTS` / `CRON_SECRET`: from Step 1b, for Facebook Ads cost-cap auto-adjust
7. Redeploy by going to "Deployments" → last deployment → "Redeploy"
8. Visit `/api/qb-auth/connect` once to authorize QuickBooks (see Step 1)

### Option B: Deploy via Git

1. Push this folder to a GitHub repo
2. Connect that repo to Vercel
3. Add environment variables (same as above)
4. Vercel auto-deploys every push

---

## Step 3: Connect Your Domain (Squarespace)

1. In Vercel, go to "Settings" → "Domains"
2. Click "Add Domain"
3. Enter the domain you want (e.g., `checkout.smellsiconic.com`)
4. Vercel will show you nameservers or CNAME record to add
5. In Squarespace:
   - Go to Settings → Domains
   - Find your domain settings
   - Add the Vercel DNS records
   - Wait ~24 hours for DNS to propagate
6. Once DNS is live, Vercel will auto-generate an SSL certificate

---

## Step 4: Test the Checkout

1. Go to your deployed domain
2. Add a product to the cart and click "Checkout"
3. In sandbox mode, use one of Intuit's [test cards](https://developer.intuit.com/app/developer/qbpayments/docs/develop/sandboxes/payments-test-cards)
4. Check your QuickBooks Payments dashboard — the charge should appear

---

## Customizing Products

All products live in `lib/products.js`.

To change them:
1. Edit `lib/products.js`
2. Update product names, prices, images, descriptions, scent notes
3. Push to GitHub (or redeploy to Vercel)
4. Changes go live automatically

---

## Site Structure

### Pages
- `/` — Homepage with hero, featured products, brand story
- `/shop` — Full product catalog
- `/product/[id]` — Individual product detail pages
- `/checkout` — Custom single-page checkout
- `/success` — Order confirmation page

### Components
- `Header.jsx` — Navigation, cart button, logo
- `CartDrawer.jsx` — Slide-in cart, links to `/checkout`
- Product data at `lib/products.js`

### Architecture
- **Frontend**: Next.js React app (all pages)
- **Cart state**: React Context (`lib/useCart.js`), persisted to `localStorage` so it survives navigation to `/checkout`
- **Backend**: Vercel serverless functions at `/api/qb-checkout` (charges a card token via the QuickBooks Payments API) and `/api/qb-auth/connect` + `/api/qb-auth/callback` (one-time OAuth authorization)
- **Payments**: QuickBooks Payments — card details are tokenized client-side (`lib/qbPayments.js`, a direct call to Intuit's Payments Tokens REST endpoint) before ever reaching the server
- **Token refresh**: `lib/qbServerAuth.js` transparently refreshes the QuickBooks access token using a refresh token persisted in the KV store (`lib/qbTokenStore.js`) before every charge — no manual token rotation
- **Hosting**: Vercel (free tier handles all traffic)

---

## Security Notes

- `QB_CLIENT_SECRET` and the KV-stored tokens live only in Vercel's environment variables / KV store (never in code)
- Card numbers are tokenized in the browser before submission — the server only ever sees a one-time token, not raw card data
- HTTPS is automatic (Vercel provides free SSL)

---

## Troubleshooting

**"QuickBooks Payments is not connected yet" error:**
- Visit `/api/qb-auth/connect` to complete the one-time authorization

**Charge fails with a 403, and the OAuth connection is valid:**
- This is almost always the missing Payments production-access approval described in Step 1, not a bug — confirm the same flow works in `sandbox` first, then chase down that approval with Intuit for `production`

**"KV_REST_API_URL / KV_REST_API_TOKEN are not set" error:**
- Provision a KV store (Vercel Storage → Marketplace → Upstash, or a standalone Upstash Redis database) and add its REST URL/token to your environment variables

**Domain not connecting:**
- DNS can take 24–48 hours to propagate
- Check Vercel's domain status (should show green ✓)

---

## Next Steps

1. Deploy this to Vercel
2. Provision a KV store and add `QB_CLIENT_ID` / `QB_CLIENT_SECRET` / `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Development/sandbox credentials to start — see Step 1)
3. Visit `/api/qb-auth/connect` once to authorize QuickBooks, with `QB_ENVIRONMENT=sandbox`
4. Test a full checkout with an Intuit sandbox test card
5. When ready for real charges, swap to the Production Client ID/Secret + redirect URI, switch `QB_ENVIRONMENT` / `NEXT_PUBLIC_QB_ENVIRONMENT` to `production`, and re-run `/api/qb-auth/connect`
6. Connect your domain
