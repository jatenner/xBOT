/**
 * Behavioral Hypothesis Engine
 *
 * When the behavioral analyzer finds statistically significant patterns,
 * this engine generates testable hypotheses and inserts them into
 * external_hypotheses (which the tick advisor already reads).
 *
 * Example hypothesis:
 *   "Accounts at 500-2K followers that reply to 50K-500K accounts
 *    within 5 minutes grow 3x faster than those replying to peers"
 *
 * The hypothesis can then be validated against our own reply data
 * (did we try this? what happened?).
 *
 * Runs every 2 hours, after the behavioral analyzer.
 * Uses one GPT-4o-mini call per hypothesis (~$0.10/day = 20 hypotheses).
 */

import { getSupabaseClient } from '../../db';

const LOG_PREFIX = '[observatory/behavioral-hypothesis]';
const MAX_HYPOTHESES_PER_RUN = 5;
const MIN_SAMPLE_SIZE = 10;

export async function runBehavioralHypothesisEngine(): Promise<{
  hypotheses_created: number;
  hypotheses_validated: number;
}> {
  const supabase = getSupabaseClient();
  let created = 0;
  let validated = 0;

  // =========================================================================
  // Step 1: Find significant behavioral patterns that don't have hypotheses yet
  // =========================================================================
  const { data: patterns } = await supabase
    .from('external_patterns')
    .select('id, pattern_type, combo_key, target_tier, hour_bucket, ext_avg_likes, ext_sample_count, direction, confidence')
    .in('pattern_type', ['reply_timing', 'reply_targeting', 'content_mix', 'reply_behavior'])
    .eq('direction', 'do_more')
    .in('confidence', ['medium', 'high'])
    .gte('ext_sample_count', MIN_SAMPLE_SIZE)
    .order('ext_avg_likes', { ascending: false })
    .limit(20);

  if (!patterns || patterns.length === 0) {
    return { hypotheses_created: 0, hypotheses_validated: 0 };
  }

  // Check which patterns already have hypotheses
  const { data: existingHypotheses } = await supabase
    .from('external_hypotheses')
    .select('source_pattern_id')
    .eq('is_active', true);

  const existingPatternIds = new Set((existingHypotheses ?? []).map(h => h.source_pattern_id));

  // =========================================================================
  // Step 2: Generate hypotheses for new significant patterns
  // =========================================================================
  for (const pattern of patterns) {
    if (existingPatternIds.has(pattern.id)) continue;
    if (created >= MAX_HYPOTHESES_PER_RUN) break;

    const hypothesis = generateHypothesisFromPattern(pattern);
    if (!hypothesis) continue;

    const { error } = await supabase.from('external_hypotheses').insert({
      hypothesis_text: hypothesis.text,
      hypothesis_type: 'behavioral',
      condition: hypothesis.condition,
      predicted_metric: hypothesis.predicted_metric,
      predicted_direction: 'increase',
      predicted_magnitude: hypothesis.predicted_magnitude,
      external_evidence: {
        pattern_type: pattern.pattern_type,
        combo_key: pattern.combo_key,
        sample_count: pattern.ext_sample_count,
        avg_likes: pattern.ext_avg_likes,
        confidence: pattern.confidence,
      },
      source_pattern_id: pattern.id,
      status: 'untested',
      confidence_score: pattern.confidence === 'high' ? 0.8 : 0.5,
      is_active: true,
    });

    if (!error) {
      created++;
      console.log(`${LOG_PREFIX} Created hypothesis: "${hypothesis.text}"`);
    }
  }

  // =========================================================================
  // Step 3: Validate untested hypotheses against our own data
  // =========================================================================
  const { data: untestedHypotheses } = await supabase
    .from('external_hypotheses')
    .select('*')
    .eq('hypothesis_type', 'behavioral')
    .eq('status', 'untested')
    .eq('is_active', true)
    .limit(5);

  for (const hyp of (untestedHypotheses ?? [])) {
    try {
      const result = await validateAgainstOurData(supabase, hyp);
      if (result) {
        await supabase
          .from('external_hypotheses')
          .update({
            status: result.confirmed ? 'confirmed' : 'testing',
            internal_evidence: result.evidence,
            validation_sample_size: result.sampleSize,
            times_tested: (hyp.times_tested ?? 0) + 1,
            times_confirmed: (hyp.times_confirmed ?? 0) + (result.confirmed ? 1 : 0),
            validated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', hyp.id);
        validated++;
      }
    } catch {
      // Validation is non-fatal per hypothesis
    }
  }

  if (created > 0 || validated > 0) {
    console.log(`${LOG_PREFIX} Created ${created} hypotheses, validated ${validated}`);
  }

  return { hypotheses_created: created, hypotheses_validated: validated };
}

// =============================================================================
// Hypothesis generation from patterns
// =============================================================================

function generateHypothesisFromPattern(pattern: any): {
  text: string;
  condition: Record<string, any>;
  predicted_metric: string;
  predicted_magnitude: number;
} | null {
  switch (pattern.pattern_type) {
    case 'reply_timing':
      return {
        text: `Replies within ${pattern.hour_bucket} of the parent tweet get higher engagement than slower replies`,
        condition: { reply_delay_bucket: pattern.hour_bucket },
        predicted_metric: 'reply_likes',
        predicted_magnitude: pattern.ext_avg_likes ?? 1,
      };

    case 'reply_targeting':
      return {
        text: `Replying to accounts ${pattern.target_tier} your size produces the best engagement`,
        condition: { target_size_ratio: pattern.target_tier },
        predicted_metric: 'reply_likes',
        predicted_magnitude: pattern.ext_avg_likes ?? 1,
      };

    case 'content_mix':
      const replyPct = Math.round((pattern.ext_avg_engagement_rate ?? 0.7) * 100);
      return {
        text: `Growing accounts at ${pattern.target_tier} range use a ~${replyPct}% reply ratio`,
        condition: { follower_range: pattern.target_tier, reply_ratio: replyPct / 100 },
        predicted_metric: 'follower_growth_rate',
        predicted_magnitude: replyPct / 100,
      };

    case 'reply_behavior':
      if (pattern.combo_key?.includes('reply_ratio_increase')) {
        return {
          text: `Increasing reply ratio correlates with growth (${Math.round((pattern.ext_breakout_rate ?? 0) * 100)}% of growing accounts increased their reply ratio)`,
          condition: { behavior: 'increase_reply_ratio' },
          predicted_metric: 'follower_growth_rate',
          predicted_magnitude: pattern.ext_breakout_rate ?? 0.5,
        };
      }
      if (pattern.combo_key?.includes('volume_increase')) {
        return {
          text: `Increasing posting volume correlates with growth`,
          condition: { behavior: 'increase_volume' },
          predicted_metric: 'follower_growth_rate',
          predicted_magnitude: pattern.ext_breakout_rate ?? 0.5,
        };
      }
      return null;

    default:
      return null;
  }
}

// =============================================================================
// Validate hypotheses against our own reply data
// =============================================================================

async function validateAgainstOurData(
  supabase: any,
  hypothesis: any,
): Promise<{ confirmed: boolean; evidence: Record<string, any>; sampleSize: number } | null> {
  const condition = hypothesis.condition;
  if (!condition) return null;

  // Check reply timing hypothesis
  if (condition.reply_delay_bucket) {
    const { data: ourReplies } = await supabase
      .from('growth_ledger')
      .select('reply_delay_minutes, likes, views')
      .eq('action_type', 'reply')
      .not('reply_delay_minutes', 'is', null)
      .not('likes', 'is', null)
      .limit(200);

    if (!ourReplies || ourReplies.length < 5) return null;

    // Bucket our replies by delay
    const delayMap: Record<string, [number, number]> = {
      '0-5min': [0, 5], '5-15min': [5, 15], '15-60min': [15, 60], '1h+': [60, Infinity],
    };
    const bounds = delayMap[condition.reply_delay_bucket];
    if (!bounds) return null;

    const matching = ourReplies.filter((r: any) => r.reply_delay_minutes >= bounds[0] && r.reply_delay_minutes < bounds[1]);
    const others = ourReplies.filter((r: any) => r.reply_delay_minutes < bounds[0] || r.reply_delay_minutes >= bounds[1]);

    if (matching.length < 3 || others.length < 3) return null;

    const avg = (arr: any[], key: string) => arr.reduce((s, r) => s + (r[key] ?? 0), 0) / arr.length;
    const matchAvg = avg(matching, 'likes');
    const otherAvg = avg(others, 'likes');

    return {
      confirmed: matchAvg > otherAvg * 1.2,
      evidence: {
        our_matching_avg_likes: Math.round(matchAvg * 10) / 10,
        our_other_avg_likes: Math.round(otherAvg * 10) / 10,
        our_matching_count: matching.length,
        our_other_count: others.length,
        ratio: otherAvg > 0 ? Math.round((matchAvg / otherAvg) * 100) / 100 : null,
      },
      sampleSize: ourReplies.length,
    };
  }

  // Check target sizing hypothesis
  if (condition.target_size_ratio) {
    const { data: ourReplies } = await supabase
      .from('growth_action_logs')
      .select('target_followers, likes, followers_gained')
      .eq('action_type', 'reply')
      .not('target_followers', 'is', null)
      .not('likes', 'is', null)
      .limit(200);

    if (!ourReplies || ourReplies.length < 5) return null;

    // Get our follower count
    const { data: selfModel } = await supabase
      .from('self_model_state')
      .select('follower_count')
      .eq('id', 1)
      .single();

    const ourFollowers = selfModel?.follower_count ?? 1;

    // Compare replies to optimal-ratio targets vs others
    const ratioMap: Record<string, [number, number]> = {
      'peer': [0.5, 2], 'bigger_2-10x': [2, 10], 'bigger_10-100x': [10, 100], 'mega_100x+': [100, Infinity],
    };
    const bounds = ratioMap[condition.target_size_ratio];
    if (!bounds) return null;

    const matching = ourReplies.filter((r: any) => {
      const ratio = (r.target_followers ?? 0) / Math.max(ourFollowers, 1);
      return ratio >= bounds[0] && ratio < bounds[1];
    });
    const others = ourReplies.filter((r: any) => {
      const ratio = (r.target_followers ?? 0) / Math.max(ourFollowers, 1);
      return ratio < bounds[0] || ratio >= bounds[1];
    });

    if (matching.length < 3 || others.length < 3) return null;

    const avg = (arr: any[], key: string) => arr.reduce((s, r) => s + (r[key] ?? 0), 0) / arr.length;

    return {
      confirmed: avg(matching, 'likes') > avg(others, 'likes') * 1.2,
      evidence: {
        our_matching_avg_likes: Math.round(avg(matching, 'likes') * 10) / 10,
        our_other_avg_likes: Math.round(avg(others, 'likes') * 10) / 10,
        our_matching_count: matching.length,
        our_matching_avg_followers_gained: Math.round(avg(matching, 'followers_gained') * 10) / 10,
      },
      sampleSize: ourReplies.length,
    };
  }

  return null;
}
