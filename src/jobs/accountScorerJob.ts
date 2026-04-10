/**
 * Account Scorer Job
 *
 * Runs daily to re-score all tracked accounts based on recent engagement data.
 * Updates the `account_scores` column (or table) with fresh relevance scores.
 *
 * 5-component source trust score:
 * - Niche relevance (30%): % of health-classified tweets
 * - Engagement consistency (20%): lower stddev in ER = more reliable
 * - Replicability (20%): penalize mega accounts, boost similar-stage
 * - Recency (15%): exponential decay, half-life 14 days
 * - Growth trajectory (15%): 7d avg ER vs 30d avg ER
 */

import { getSupabaseClient } from '../db/index';

const TAG = '[ACCOUNT_SCORER]';

export interface AccountScorerResult {
  scored: number;
  skipped: number;
  errors: number;
}

export async function runAccountScorer(): Promise<AccountScorerResult> {
  const result: AccountScorerResult = { scored: 0, skipped: 0, errors: 0 };

  try {
    const supabase = getSupabaseClient();

    // Fetch accounts that need re-scoring (scored > 24h ago or never scored)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: accounts, error } = await supabase
      .from('curated_accounts')
      .select('id, username, tier, follower_count, last_scored_at')
      .or(`last_scored_at.is.null,last_scored_at.lt.${oneDayAgo}`)
      .limit(100);

    if (error) {
      console.warn(`${TAG} Failed to fetch accounts: ${error.message}`);
      return result;
    }

    if (!accounts || accounts.length === 0) {
      console.log(`${TAG} No accounts need re-scoring`);
      return result;
    }

    for (const account of accounts) {
      try {
        // 1. Niche relevance: % of health-classified tweets
        let nicheRelevance = 0.5; // default
        try {
          const { count: healthCount } = await supabase
            .from('vi_content_classification')
            .select('*', { count: 'exact', head: true })
            .eq('author_username', account.username)
            .in('topic', ['sleep','exercise','supplements','nutrition','longevity','mental_health','biohacking','peptides','hormones','gut_health','research']);
          const { count: totalCount } = await supabase
            .from('vi_content_classification')
            .select('*', { count: 'exact', head: true })
            .eq('author_username', account.username);
          if (totalCount && totalCount > 0) {
            nicheRelevance = (healthCount || 0) / totalCount;
          }
        } catch { /* fallback to 0.5 */ }

        // 2. Engagement consistency: lower stddev = more reliable
        let engagementConsistency = 0.5;
        try {
          const { data: erData } = await supabase
            .from('vi_collected_tweets')
            .select('engagement_rate')
            .eq('author_username', account.username)
            .order('scraped_at', { ascending: false })
            .limit(30);
          if (erData && erData.length >= 5) {
            const rates = erData.map(r => r.engagement_rate || 0);
            const mean = rates.reduce((a,b) => a+b, 0) / rates.length;
            const variance = rates.reduce((a,b) => a + (b - mean) ** 2, 0) / rates.length;
            const stddev = Math.sqrt(variance);
            engagementConsistency = Math.max(0, 1 - Math.min(1, stddev / 0.05));
          }
        } catch { /* fallback */ }

        // 3. Replicability: penalize huge accounts (fame not content), boost similar-stage
        const followers = account.follower_count || 10000;
        let replicability: number;
        if (followers > 500000) replicability = 0.1;
        else if (followers > 100000) replicability = 0.3;
        else if (followers > 50000) replicability = 0.5;
        else if (followers > 10000) replicability = 0.9;
        else if (followers > 1000) replicability = 1.0;
        else replicability = 0.7;

        // 4. Recency: exponential decay, half-life 14 days
        let recencyScore = 0.5;
        try {
          const { data: latest } = await supabase
            .from('vi_collected_tweets')
            .select('scraped_at')
            .eq('author_username', account.username)
            .order('scraped_at', { ascending: false })
            .limit(1);
          if (latest && latest[0]) {
            const daysSince = (Date.now() - new Date(latest[0].scraped_at).getTime()) / (24*60*60*1000);
            recencyScore = Math.exp(-daysSince / 14);
          }
        } catch { /* fallback */ }

        // 5. Growth trajectory: 7d avg ER vs 30d avg ER
        let growthTrajectory = 0.5;
        try {
          const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
          const { data: recent7d } = await supabase
            .from('vi_collected_tweets')
            .select('engagement_rate')
            .eq('author_username', account.username)
            .gte('scraped_at', sevenDaysAgo);
          const { data: all30d } = await supabase
            .from('vi_collected_tweets')
            .select('engagement_rate')
            .eq('author_username', account.username)
            .limit(100);
          if (recent7d && recent7d.length >= 3 && all30d && all30d.length >= 5) {
            const avg7d = recent7d.reduce((a,b) => a + (b.engagement_rate||0), 0) / recent7d.length;
            const avg30d = all30d.reduce((a,b) => a + (b.engagement_rate||0), 0) / all30d.length;
            growthTrajectory = avg30d > 0 ? Math.min(1.5, avg7d / avg30d) : 0.5;
          }
        } catch { /* fallback */ }

        // Composite source trust score (weighted sum, 0-1 range)
        const sourceTrustScore =
          nicheRelevance * 0.3 +
          engagementConsistency * 0.2 +
          replicability * 0.2 +
          recencyScore * 0.15 +
          growthTrajectory * 0.15;

        const score = Math.min(100, Math.max(0, Math.round(sourceTrustScore * 100)));

        // Update vi_scrape_targets with raw trust score
        await supabase.from('vi_scrape_targets')
          .update({ source_trust_score: Math.round(sourceTrustScore * 100) / 100 })
          .eq('username', account.username);

        // Update curated_accounts with integer relevance score
        const { error: updateErr } = await supabase
          .from('curated_accounts')
          .update({
            relevance_score: score,
            last_scored_at: new Date().toISOString(),
          })
          .eq('id', account.id);

        if (updateErr) {
          console.warn(`${TAG} Failed to update score for ${account.username}: ${updateErr.message}`);
          result.errors++;
        } else {
          console.log(`${TAG} ${account.username}: trust=${sourceTrustScore.toFixed(3)} score=${score} (niche=${nicheRelevance.toFixed(2)} consist=${engagementConsistency.toFixed(2)} replic=${replicability} recency=${recencyScore.toFixed(2)} growth=${growthTrajectory.toFixed(2)})`);
          result.scored++;
        }
      } catch (accErr: any) {
        console.warn(`${TAG} Error scoring ${account.username}: ${accErr.message}`);
        result.errors++;
      }
    }

    console.log(`${TAG} Scored ${result.scored} accounts, skipped ${result.skipped}, errors ${result.errors}`);
  } catch (err: any) {
    console.warn(`${TAG} Account scoring failed: ${err.message}`);
  }

  return result;
}
