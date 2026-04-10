/**
 * Growth Knowledge Updater
 *
 * Maintains the `growth_knowledge` table -- the system's long-term memory of
 * what works.  Seeds initial questions on first run, then iteratively answers
 * them using data from `external_patterns` and confirmed `external_hypotheses`.
 *
 * All answers are template-based (no LLM calls).
 * Non-fatal throughout -- all errors are caught and logged.
 */

import { getSupabaseClient } from '../db/index';
import { getCurrentFollowerCount } from '../tracking/followerCountTracker';

const TAG = '[KNOWLEDGE_UPD]';

function computeStage(followers: number): string {
  if (followers < 500) return 'bootstrap';
  if (followers < 2000) return 'early';
  if (followers < 10000) return 'growth';
  return 'established';
}

// ─── Seed questions ───

interface SeedQuestion {
  question: string;
  category: string;
  applies_to: string;
}

const SEED_QUESTIONS: SeedQuestion[] = [
  { question: 'What reply length gets the most engagement?', category: 'reply_style', applies_to: 'replies' },
  { question: 'What time of day produces the best engagement?', category: 'timing', applies_to: 'all' },
  { question: 'Which account size tier is best for reply targeting?', category: 'targeting', applies_to: 'replies' },
  { question: 'What tone works best for replies?', category: 'reply_style', applies_to: 'replies' },
  { question: 'What content format gets the most views?', category: 'format', applies_to: 'original' },
  { question: 'How fast do we need to reply for maximum visibility?', category: 'reply_style', applies_to: 'replies' },
  { question: 'Do questions in content outperform statements?', category: 'content', applies_to: 'all' },
  { question: 'What topics get the most follower conversions?', category: 'content', applies_to: 'all' },
  { question: 'Should we post more replies or more original content?', category: 'growth', applies_to: 'all' },
  { question: 'What opening hook patterns get the most engagement?', category: 'content', applies_to: 'original' },
];

// ─── Category → pattern dimension mapping ───

const CATEGORY_DIMENSIONS: Record<string, string[]> = {
  reply_style: ['tone', 'format'],
  timing: ['hour_bucket'],
  targeting: ['target_tier'],
  format: ['format'],
  content: ['angle', 'topic'],
  growth: ['pattern_type'],
  tone: ['tone'],
};

const CATEGORY_PATTERN_TYPE: Record<string, string | null> = {
  reply_style: 'reply',
  timing: null,    // all types
  targeting: 'reply',
  format: null,
  content: null,
  growth: null,
  tone: null,
};

// ─── Helpers ───

interface PatternRow {
  id: string;
  pattern_type: string;
  angle: string | null;
  tone: string | null;
  format: string | null;
  hour_bucket: string | null;
  topic: string | null;
  target_tier: string | null;
  confidence: string;
  ext_sample_count: number;
  ext_avg_engagement_rate: number;
  ext_avg_likes: number;
  int_sample_count: number | null;
  avg_recency_days: number | null;
}

interface ConfirmedHypothesis {
  id: string;
  hypothesis_type: string;
  condition: Record<string, any>;
  confidence_score: number;
  external_evidence: Record<string, any> | null;
}

function pickBestByDimension(
  patterns: PatternRow[],
  dimension: string,
): { value: string; score: number; count: number } | null {
  const grouped = new Map<string, { totalEr: number; count: number }>();

  for (const p of patterns) {
    const val = (p as any)[dimension];
    if (!val) continue;
    const key = String(val);
    const existing = grouped.get(key) || { totalEr: 0, count: 0 };
    existing.totalEr += p.ext_avg_engagement_rate * p.ext_sample_count;
    existing.count += p.ext_sample_count;
    grouped.set(key, existing);
  }

  let best: { value: string; score: number; count: number } | null = null;

  for (const [value, agg] of Array.from(grouped.entries())) {
    const avgScore = agg.count > 0 ? agg.totalEr / agg.count : 0;
    if (!best || avgScore > best.score) {
      best = { value, score: Math.round(avgScore * 10000) / 10000, count: agg.count };
    }
  }

  return best;
}

function determineConfidence(
  extSamples: number,
  intSamples: number,
): 'proven' | 'high' | 'medium' | 'low' {
  if (intSamples >= 10 && extSamples >= 100) return 'proven';
  if (extSamples >= 50) return 'high';
  if (extSamples >= 20) return 'medium';
  return 'low';
}

// ─── Main ───

export async function runGrowthKnowledgeUpdate(): Promise<{ updated: number; seeded: number }> {
  let updated = 0;
  let seeded = 0;

  try {
    const sb = getSupabaseClient();

    // Determine current growth stage
    const followerCount = await getCurrentFollowerCount();
    const stage = computeStage(followerCount);
    console.log(TAG, `Current stage: ${stage} (${followerCount} followers)`);

    // 1. Check if table is empty → seed
    const { data: existingRows, error: checkErr } = await sb
      .from('growth_knowledge')
      .select('id')
      .limit(1);

    if (checkErr) {
      console.error(TAG, 'Failed to check growth_knowledge table:', checkErr.message);
      return { updated: 0, seeded: 0 };
    }

    if (!existingRows || existingRows.length === 0) {
      console.log(TAG, 'growth_knowledge is empty -- seeding initial questions.');

      const seedRows = SEED_QUESTIONS.map((sq) => ({
        question: sq.question,
        category: sq.category,
        applies_to: sq.applies_to,
        answer: 'Insufficient data',
        confidence: 'low',
        evidence_sources: [],
        actionable_guidance: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: seedErr } = await sb
        .from('growth_knowledge')
        .insert(seedRows);

      if (seedErr) {
        console.error(TAG, 'Failed to seed growth_knowledge:', seedErr.message);
        return { updated: 0, seeded: 0 };
      }

      seeded = seedRows.length;
      console.log(TAG, `Seeded ${seeded} initial knowledge questions.`);
      return { updated: 0, seeded };
    }

    // 2. Fetch all knowledge rows
    const { data: knowledgeRows, error: kErr } = await sb
      .from('growth_knowledge')
      .select('*');

    if (kErr || !knowledgeRows) {
      console.error(TAG, 'Failed to fetch knowledge rows:', kErr?.message);
      return { updated: 0, seeded: 0 };
    }

    // 3. Fetch external patterns (recent, high quality)
    const { data: allPatterns, error: pErr } = await sb
      .from('external_patterns')
      .select('*')
      .gte('ext_sample_count', 5)
      .order('ext_avg_engagement_rate', { ascending: false })
      .limit(200);

    if (pErr) {
      console.error(TAG, 'Failed to fetch external_patterns:', pErr.message);
      return { updated: 0, seeded: 0 };
    }

    const patterns = (allPatterns || []) as PatternRow[];

    // 4. Fetch confirmed hypotheses
    const { data: confirmedHyps, error: hErr } = await sb
      .from('external_hypotheses')
      .select('id, hypothesis_type, condition, confidence_score, external_evidence')
      .eq('status', 'confirmed')
      .eq('is_active', true);

    if (hErr) {
      console.warn(TAG, 'Failed to fetch confirmed hypotheses (continuing):', hErr.message);
    }

    const hypotheses = (confirmedHyps || []) as ConfirmedHypothesis[];

    // 5. Update each knowledge question
    for (const row of knowledgeRows) {
      try {
        const category = row.category as string;
        const patternType = CATEGORY_PATTERN_TYPE[category];
        const dimensions = CATEGORY_DIMENSIONS[category] || [];

        // Filter patterns relevant to this category
        let relevantPatterns = patterns;
        if (patternType) {
          relevantPatterns = patterns.filter((p) => p.pattern_type === patternType);
        }

        // Filter hypotheses relevant to this category
        const relevantHyps = hypotheses.filter((h) => {
          if (h.hypothesis_type === category) return true;
          // Map hypothesis types to categories
          if (category === 'reply_style' && h.hypothesis_type === 'tone') return true;
          if (category === 'content' && h.hypothesis_type === 'content') return true;
          if (category === 'timing' && h.hypothesis_type === 'timing') return true;
          if (category === 'format' && h.hypothesis_type === 'format') return true;
          if (category === 'targeting' && h.hypothesis_type === 'targeting') return true;
          return false;
        });

        // Build evidence sources
        const evidenceSources: any[] = [];
        let extSampleTotal = 0;
        let intSampleTotal = 0;

        for (const p of relevantPatterns) {
          extSampleTotal += p.ext_sample_count || 0;
          intSampleTotal += p.int_sample_count || 0;
        }

        if (relevantPatterns.length > 0) {
          evidenceSources.push({
            type: 'external_patterns',
            count: relevantPatterns.length,
            total_samples: extSampleTotal,
          });
        }

        if (relevantHyps.length > 0) {
          evidenceSources.push({
            type: 'confirmed_hypotheses',
            count: relevantHyps.length,
            avg_confidence: Math.round(
              (relevantHyps.reduce((s, h) => s + (h.confidence_score || 0), 0) / relevantHyps.length) * 100
            ) / 100,
          });
        }

        // Generate answer from best dimension data
        let answer = 'Insufficient data';
        let guidance: string | null = null;

        if (relevantPatterns.length > 0 && dimensions.length > 0) {
          const bestResults: string[] = [];

          // Compute avg recency across relevant patterns for staleness annotation
          const recencyValues = relevantPatterns
            .map(p => p.avg_recency_days)
            .filter((v): v is number => v != null);
          const avgRecency = recencyValues.length > 0
            ? recencyValues.reduce((a, b) => a + b, 0) / recencyValues.length
            : null;

          for (const dim of dimensions) {
            const best = pickBestByDimension(relevantPatterns, dim);
            if (best && best.count >= 5) {
              let recencyNote = '';
              if (avgRecency != null && avgRecency > 21) recencyNote = ' (potentially outdated)';
              else if (avgRecency != null && avgRecency < 7) recencyNote = ' (fresh signal)';
              bestResults.push(
                `[At ${stage} stage] Based on ${extSampleTotal} external tweets and ${intSampleTotal} internal posts, ${dim} = '${best.value}' performs best with ${best.score} avg engagement.${recencyNote}`
              );

              // Generate guidance per dimension
              if (dim === 'tone') {
                guidance = `Prioritize ${best.value} tone in replies.`;
              } else if (dim === 'format') {
                guidance = `Prefer ${best.value} format for new content.`;
              } else if (dim === 'hour_bucket') {
                guidance = `Schedule posts during ${best.value} for best engagement.`;
              } else if (dim === 'target_tier') {
                guidance = `Focus reply targeting on ${best.value} tier accounts.`;
              } else if (dim === 'angle') {
                guidance = `Set reply target angle to ${best.value}. Prioritize ${best.value} angle.`;
              } else if (dim === 'topic') {
                guidance = `Create more content around "${best.value}" topic.`;
              } else if (dim === 'pattern_type') {
                guidance = `Shift content mix toward more ${best.value} posts.`;
              }
            }
          }

          if (bestResults.length > 0) {
            answer = bestResults.join(' ');
          }
        }

        // Also incorporate confirmed hypothesis evidence
        if (relevantHyps.length > 0 && answer === 'Insufficient data') {
          const topHyp = relevantHyps.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))[0];
          const condParts = Object.entries(topHyp.condition || {}).map(([k, v]) => `${k}=${v}`).join(', ');
          answer = `[At ${stage} stage] Confirmed hypothesis suggests: ${condParts} (confidence: ${topHyp.confidence_score}).`;
          guidance = `Apply confirmed pattern: ${condParts}.`;
        }

        const confidence = determineConfidence(extSampleTotal, intSampleTotal);
        const currentVersion = row.version || 0;

        // Skip update if nothing changed
        if (row.answer === answer && row.confidence === confidence) {
          continue;
        }

        const { error: upErr } = await sb
          .from('growth_knowledge')
          .update({
            answer,
            confidence,
            evidence_sources: evidenceSources,
            actionable_guidance: guidance,
            version: currentVersion + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        if (upErr) {
          console.error(TAG, `Failed to update knowledge row ${row.id}:`, upErr.message);
          continue;
        }

        updated++;
        console.log(TAG, `Updated knowledge "${row.question}" → confidence=${confidence}, version=${currentVersion + 1}`);
      } catch (err: any) {
        console.error(TAG, `Error updating knowledge row ${row.id} (non-fatal):`, err?.message ?? err);
      }
    }

    console.log(TAG, `Knowledge update complete: updated=${updated}, seeded=${seeded}`);
  } catch (err: any) {
    console.error(TAG, 'Growth knowledge update failed (non-fatal):', err?.message ?? err);
  }

  return { updated, seeded };
}
