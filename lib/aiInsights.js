// Uses Claude to review a brand's testing-pool ads (any campaign whose name
// contains brand.testingCampaignPattern) and flag winners worth promoting
// into their own COST_CAP scaling campaign. This is judgment on ambiguous,
// multi-signal data (ROAS vs. target, spend/purchase sample size, relative
// performance across the test set) — better suited to Claude reasoning over
// the numbers than a rigid threshold rule. Read-only: it never changes
// anything in the ad account, only produces a recommendation for a human to
// act on (see the "Recommendation only" choice for this feature).

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { listCampaigns, listAdSets, listAds, getInsights } from './metaMarketingApi';
import { lookbackRange } from './dateRange';

const WinnerAnalysisSchema = z.object({
  ads: z.array(z.object({
    adId: z.string(),
    verdict: z.enum(['winner', 'promising', 'not_yet', 'underperforming']),
    confidence: z.enum(['low', 'medium', 'high']),
    reasoning: z.string(),
  })),
});

export async function findWinningTestAds(brand) {
  if (!brand.testingCampaignPattern) {
    throw new Error('Set a "testing campaign pattern" in this brand\'s settings before running winner detection.');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }

  const pattern = brand.testingCampaignPattern.toLowerCase();
  const [campaigns, adSets, ads] = await Promise.all([
    listCampaigns(brand.adAccountId),
    listAdSets(brand.adAccountId),
    listAds(brand.adAccountId),
  ]);

  const testingCampaigns = campaigns.filter((c) => c.name.toLowerCase().includes(pattern) && c.effective_status === 'ACTIVE');
  if (testingCampaigns.length === 0) {
    return { ads: [], message: `No active campaigns matched "${brand.testingCampaignPattern}".` };
  }
  const testingCampaignIds = new Set(testingCampaigns.map((c) => c.id));
  const testingAdSets = adSets.filter((a) => testingCampaignIds.has(a.campaign_id));
  const testingAdSetIds = new Set(testingAdSets.map((a) => a.id));
  const testingAds = ads.filter((a) => testingAdSetIds.has(a.adset_id) && a.effective_status === 'ACTIVE');

  if (testingAds.length === 0) {
    return { ads: [], message: 'No active ads found in the matched testing campaigns.' };
  }

  const range = lookbackRange(brand.lookbackDays);
  const insights = await getInsights(brand.adAccountId, { level: 'ad', ids: testingAds.map((a) => a.id), ...range });

  const adSetById = Object.fromEntries(testingAdSets.map((a) => [a.id, a]));
  const campaignById = Object.fromEntries(testingCampaigns.map((c) => [c.id, c]));

  const dataset = testingAds.map((ad) => {
    const insight = insights[ad.id] || { spend: 0, revenue: 0, purchases: 0 };
    const adSet = adSetById[ad.adset_id];
    const campaign = campaignById[adSet?.campaign_id];
    return {
      adId: ad.id,
      adName: ad.name,
      campaignName: campaign?.name || 'Unknown',
      adSetName: adSet?.name || 'Unknown',
      spendCents: insight.spend,
      revenueCents: insight.revenue,
      purchases: insight.purchases,
      roas: insight.spend > 0 ? insight.revenue / insight.spend : 0,
    };
  });

  const sampleSizeFloorCents = brand.minCostCapCents * brand.minSpendMultiplier;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.parse({
    model: 'claude-opus-4-8',
    max_tokens: 8192,
    thinking: { type: 'adaptive' },
    system: `You are a senior performance marketing analyst reviewing Facebook/Meta ad tests for the brand "${brand.name}". Its target ROAS is ${brand.targetRoas}x.

A "winner" is an ad with strong, sustained ROAS relative to that target AND enough spend/purchases that the result isn't just noise from one or two lucky conversions — as a rule of thumb, distrust anything under roughly $${(sampleSizeFloorCents / 100).toFixed(0)} of spend or 3 purchases; call those "not_yet", not "underperforming". "promising" is for ads trending well but not yet past that sample-size bar. "underperforming" is for ads with enough spend to trust the number and a ROAS meaningfully below target.

Money figures in the data are in cents. Give a one or two sentence reasoning per ad that cites the actual spend/ROAS numbers, and classify every ad in the dataset — not just the winners.`,
    messages: [{
      role: 'user',
      content: `Classify each of these test ads:\n\n${JSON.stringify(dataset, null, 2)}`,
    }],
    output_config: { format: zodOutputFormat(WinnerAnalysisSchema) },
  });

  const analysis = response.parsed_output;
  if (!analysis) {
    throw new Error(response.stop_reason === 'refusal' ? 'Claude declined to analyze this data.' : 'Claude returned an unparseable response — try again.');
  }

  const verdictById = Object.fromEntries(analysis.ads.map((a) => [a.adId, a]));
  const merged = dataset.map((ad) => ({ ...ad, ...verdictById[ad.adId] }));

  return { ads: merged, message: null };
}
