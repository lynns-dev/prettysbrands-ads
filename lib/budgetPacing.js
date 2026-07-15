// Compares a brand's month-to-date ad spend against its configured monthly
// budget: is spend tracking ahead of, behind, or on the pace you'd expect
// for "day 12 of a 30-day month," and what does that project to by month end.

import { getAccountInsights } from './metaMarketingApi';

const OVER_PACE_THRESHOLD_PCT = 15;
const UNDER_PACE_THRESHOLD_PCT = -15;

export function computePacing({ monthlyBudgetCents, spendThisMonthCents, now = new Date() }) {
  if (!monthlyBudgetCents) return null;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const expectedFraction = dayOfMonth / daysInMonth;
  const actualFraction = spendThisMonthCents / monthlyBudgetCents;
  const projectedEndOfMonthCents = (spendThisMonthCents / dayOfMonth) * daysInMonth;
  const variancePct = Math.round(((actualFraction - expectedFraction) / expectedFraction) * 1000) / 10;

  let status = 'on_pace';
  if (variancePct > OVER_PACE_THRESHOLD_PCT) status = 'over_pace';
  else if (variancePct < UNDER_PACE_THRESHOLD_PCT) status = 'under_pace';

  return {
    monthlyBudgetCents,
    spendThisMonthCents,
    projectedEndOfMonthCents,
    variancePct,
    status,
    daysInMonth,
    dayOfMonth,
  };
}

export async function getBrandPacing(brand) {
  if (!brand.monthlyBudgetCents) return null;
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const { spend } = await getAccountInsights(brand.adAccountId, { since: fmt(firstOfMonth), until: fmt(now) });
  return computePacing({ monthlyBudgetCents: brand.monthlyBudgetCents, spendThisMonthCents: spend, now });
}
