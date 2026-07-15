// Looks back over a brand's cost-cap ("scaling") ad sets day by day and asks
// Claude to find what the highest-ROAS, highest-spend days had in common —
// how many winning creatives were live at once, what cap amount was in
// force, what bid type — and turn that into a plain-English recommendation.
// Read-only, like winner detection: it never changes anything in the ad
// account, only produces a recommendation for a human to act on.
//
// Caveat baked into the prompt: Meta's Insights API doesn't expose *historical*
// bid_strategy/bid_amount changes, only each ad set's current values. So the
// cap/bid-type figures joined onto each day are "whatever that ad set is set
// to right now," which is a reasonable proxy when caps don't change often but
// isn't strictly what was true on that day if they've since been edited.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the top-level 'zod' classic export — see lib/aiInsights.js
// for why (zodOutputFormat requires zod/v4-built schemas).
import { z } from 'zod/v4';
import { listAdSets, listAds, getInsightsTimeSeries } from './metaMarketingApi';
import { lookbackRange } from './dateRange';

const TrendAnalysisSchema = z.object({
  recommendation: z.string(),
  suggestedLiveCreativeCount: z.string().nullable(),
  suggestedCostCap: z.string().nullable(),
  suggestedBidStrategy: z.string().nullable(),
  keyTrends: z.array(z.object({ finding: z.string(), evidence: z.string() })),
  confidence: z.enum(['low', 'medium', 'high']),
});

export async function analyzeTrends(brand, { lookbackDays = 90 } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }

  const adSets = await listAdSets(brand.adAccountId);
  const costCapAdSets = adSets.filter((a) => a.bid_strategy === 'COST_CAP' && Number(a.bid_amount) > 0);
  if (costCapAdSets.length === 0) {
    return { days: [], recommendation: null, message: 'No cost-cap ad sets found to analyze — trend analysis looks at your scaling (COST_CAP) ad sets specifically.' };
  }

  const adSetIds = new Set(costCapAdSets.map((a) => a.id));
  const allAds = await listAds(brand.adAccountId);
  const scalingAds = allAds.filter((a) => adSetIds.has(a.adset_id));
  if (scalingAds.length === 0) {
    return { days: [], recommendation: null, message: 'No ads found in your cost-cap ad sets.' };
  }

  const range = lookbackRange(lookbackDays);
  const series = await getInsightsTimeSeries(brand.adAccountId, { level: 'ad', ids: scalingAds.map((a) => a.id), ...range });

  const adSetIdByAdId = Object.fromEntries(scalingAds.map((a) => [a.id, a.adset_id]));
  const adSetById = Object.fromEntries(costCapAdSets.map((a) => [a.id, a]));

  const days = Object.entries(series).map(([date, byAdId]) => {
    let spend = 0;
    let revenue = 0;
    let liveCreativeCount = 0;
    const capsInUse = new Set();
    for (const [adId, insight] of Object.entries(byAdId)) {
      if (insight.spend <= 0) continue;
      liveCreativeCount += 1;
      spend += insight.spend;
      revenue += insight.revenue;
      const adSet = adSetById[adSetIdByAdId[adId]];
      if (adSet) capsInUse.add(`$${(Number(adSet.bid_amount) / 100).toFixed(2)} ${adSet.bid_strategy}`);
    }
    return {
      date,
      spendCents: spend,
      revenueCents: revenue,
      roas: spend > 0 ? revenue / spend : 0,
      liveCreativeCount,
      capsInUse: [...capsInUse],
    };
  }).sort((a, b) => a.date.localeCompare(b.date));

  if (days.length === 0) {
    return { days: [], recommendation: null, message: 'No spend recorded in your cost-cap ad sets over the lookback window.' };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.parse({
    model: 'claude-opus-4-8',
    max_tokens: 8192,
    thinking: { type: 'adaptive' },
    system: `You are a senior performance marketing analyst reviewing ${lookbackDays} days of daily performance for the brand "${brand.name}"'s cost-cap (scaling) ad sets on Meta. Its target ROAS is ${brand.targetRoas}x.

Each row is one calendar day: total spend/revenue/ROAS across all ads that actually spent that day, how many distinct ads were live (spent money) that day, and which cap-amount/bid-strategy combinations were in force among those ads' ad sets. Money figures are in cents.

Important caveat to factor in: capsInUse reflects each ad set's *current* cap/bid setting, not necessarily what it was set to on that historical day — caps don't change often, but treat any correlation you draw from them as a reasonable proxy, not certain fact, and say so if relevant.

Your job: find what the highest-ROAS, highest-spend days had in common, specifically around (a) how many winning creatives were live at once, (b) what cost-cap amount was in force, and (c) bid strategy. Look for real patterns across multiple days, not a one-day fluke. Then write one clear, actionable recommendation a media buyer could act on today (e.g. "keep 3-4 winning creatives live in the scaling ad sets — days with 2 or fewer show lower ROAS, and above 5 spend gets diluted across weaker creative"). If the data doesn't support a confident recommendation, say so plainly and set confidence to "low" rather than forcing a conclusion.`,
    messages: [{
      role: 'user',
      content: `Daily performance data:\n\n${JSON.stringify(days, null, 2)}`,
    }],
    output_config: { format: zodOutputFormat(TrendAnalysisSchema) },
  });

  const analysis = response.parsed_output;
  if (!analysis) {
    throw new Error(response.stop_reason === 'refusal' ? 'Claude declined to analyze this data.' : 'Claude returned an unparseable response — try again.');
  }

  return { days, ...analysis, message: null };
}
