// Same idea as budgetPacing.js (month-to-date vs. monthly budget) but at
// day granularity: is *today's* spend tracking ahead of or behind the pace
// you'd expect for "3pm on a day with $X of daily budget," checked hourly by
// the pacing-check cron and pushed to the phone when it drifts. There's no
// separate daily-budget field on a brand — the expected daily amount is just
// the monthly budget split evenly across the days in the current month.

import { getAccountInsights } from './metaMarketingApi';
import { listBrands } from './brandsStore';
import { sendPushToAll } from './webPush';
import { kvGetJson, kvSetJson } from './kv';

const OVER_PACE_THRESHOLD_PCT = 25;
const UNDER_PACE_THRESHOLD_PCT = -25;
// Skip alerting in the first few hours of the day — with so little of the
// day's budget expected to be spent yet, small absolute swings look like
// huge percentage swings and would just be noise.
const MIN_HOURS_ELAPSED = 3;

const ALERT_STATE_KEY = (brandId, dateKey) => `pacing-alert:${brandId}:${dateKey}`;

export function computeDailyPacing({ dailyBudgetCents, spendTodayCents, now = new Date() }) {
  if (!dailyBudgetCents) return null;

  const hoursElapsed = now.getUTCHours() + now.getUTCMinutes() / 60;
  if (hoursElapsed < MIN_HOURS_ELAPSED) {
    return { dailyBudgetCents, spendTodayCents, status: 'too_early', variancePct: 0, hoursElapsed, projectedEndOfDayCents: spendTodayCents };
  }

  const expectedFraction = hoursElapsed / 24;
  const actualFraction = spendTodayCents / dailyBudgetCents;
  const projectedEndOfDayCents = (spendTodayCents / hoursElapsed) * 24;
  const variancePct = Math.round(((actualFraction - expectedFraction) / expectedFraction) * 1000) / 10;

  let status = 'on_pace';
  if (variancePct > OVER_PACE_THRESHOLD_PCT) status = 'over_pace';
  else if (variancePct < UNDER_PACE_THRESHOLD_PCT) status = 'under_pace';

  return { dailyBudgetCents, spendTodayCents, projectedEndOfDayCents, variancePct, status, hoursElapsed };
}

export async function getBrandDailyPacing(brand) {
  if (!brand.monthlyBudgetCents) return null;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyBudgetCents = brand.monthlyBudgetCents / daysInMonth;

  const today = now.toISOString().slice(0, 10);
  const { spend } = await getAccountInsights(brand.adAccountId, { since: today, until: today });
  return computeDailyPacing({ dailyBudgetCents, spendTodayCents: spend, now });
}

// Only pushes a notification when a brand's status *changes* for the day
// (into over/under pace, or back to on-pace after one) — an hourly cron
// checking every brand would otherwise re-send the same alert all day.
async function maybeNotify(brand, pacing) {
  if (pacing.status === 'too_early') return null;

  const dateKey = new Date().toISOString().slice(0, 10);
  const stateKey = ALERT_STATE_KEY(brand.id, dateKey);
  const lastAlertedStatus = await kvGetJson(stateKey, 'on_pace');
  if (pacing.status === lastAlertedStatus) return null;

  await kvSetJson(stateKey, pacing.status);

  if (pacing.status === 'on_pace') {
    if (lastAlertedStatus === 'on_pace') return null;
    return sendPushToAll({
      title: `${brand.name}: back on pace`,
      body: `Today's spend is back within expected pace ($${(pacing.spendTodayCents / 100).toFixed(2)} so far).`,
      url: '/',
    });
  }

  const direction = pacing.status === 'over_pace' ? 'spending too fast' : 'spending too slow';
  return sendPushToAll({
    title: `${brand.name}: ${direction} today`,
    body: `$${(pacing.spendTodayCents / 100).toFixed(2)} so far vs. an expected daily budget of $${(pacing.dailyBudgetCents / 100).toFixed(2)} (${pacing.variancePct > 0 ? '+' : ''}${pacing.variancePct}% vs. pace). Projected end of day: $${(pacing.projectedEndOfDayCents / 100).toFixed(2)}.`,
    url: '/',
  });
}

// The hourly cron entry point — checks every brand with a monthly budget set
// (that's what makes daily pacing computable) and notifies on any status
// transition. One brand's failure doesn't stop the others.
export async function runPacingCheckAllBrands() {
  const brands = (await listBrands()).filter((b) => b.monthlyBudgetCents);
  const summary = [];
  for (const brand of brands) {
    try {
      const pacing = await getBrandDailyPacing(brand);
      if (pacing) await maybeNotify(brand, pacing);
      summary.push({ brandId: brand.id, brandName: brand.name, pacing });
    } catch (err) {
      summary.push({ brandId: brand.id, brandName: brand.name, error: err.message });
    }
  }
  return summary;
}
