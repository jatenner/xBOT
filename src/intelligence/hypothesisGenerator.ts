/**
 * Hypothesis Generator
 *
 * Reads strong patterns from `external_patterns` and generates testable
 * hypotheses in the `external_hypotheses` table.  Each hypothesis captures
 * a specific condition (angle + tone + format + timing, etc.) that external
 * data suggests should outperform the baseline.
 *
 * Non-fatal throughout -- all errors are caught and logged.
 */

import { getSupabaseClient } from '../db/index';
import { getCurrentFollowerCount } from '../tracking/followerCountTracker';

const TAG = '[HYPOTHESIS_GEN]';

function computeStage(followers: number): string {
  if (followers < 500) return 'bootstrap';
  if (followers < 2000) return 'early';
  if (followers < 10000) return 'growth';
  return 'established';
}
const MAX_NEW_PER_RUN = 5;

// ─── Types ───

interface StrongPattern {
  id: string;
  pattern_type: string;
  angle: string | null;
  tone: string | null;
  format: string | null;
  hour_bucket: string | null;
  topic: string | null;
  target_tier: string | null;
  confidence: string;
  direction: string;
  ext_sample_count: number;
  ext_avg_engagement_rate: number;
  ext_avg_likes: number;
}

interface ExistingHypothesis {
  id: string;
  condition: Record<string, any>;
  is_active: boolean;
}

// ─── Helpers ───

function conditionKey(cond: Record<string, any>): string {
  const parts = ['angle', 'tone', 'format', 'hour_bucket', 'topic', 'target_tier']
    .map((k) => `${k}=${cond[k] ?? 'any'}`)
    .sort();
  return parts.join('|');
}

function buildCondition(p: StrongPattern): Record<string, any> {
  const cond: Record<string, any> = {};
  if (p.angle) cond.angle = p.angle;
  if (p.tone) cond.tone = p.tone;
  if (p.format) cond.format = p.format;
  if (p.hour_bucket) cond.hour_bucket = p.hour_bucket;
  if (p.topic) cond.topic = p.topic;
  if (p.target_tier) cond.target_tier = p.target_tier;
  return cond;
}

function inferHypothesisType(p: StrongPattern): string {
  if (p.hour_bucket) return 'timing';
  if (p.target_tier) return 'targeting';
  if (p.format) return 'format';
  if (p.angle) return 'content';
  if (p.tone) return 'tone';
  if (p.topic) return 'topic';
  return 'content';
}

function buildHypothesisText(p: StrongPattern, magnitude: number): string {
  const parts: string[] = [];
  if (p.angle) parts.push(`${p.angle} angle`);
  if (p.tone) parts.push(`${p.tone} tone`);
  if (p.format) parts.push(`${p.format} format`);
  if (p.hour_bucket) parts.push(`posted during ${p.hour_bucket}`);
  if (p.topic) parts.push(`on topic "${p.topic}"`);
  if (p.target_tier) parts.push(`targeting ${p.target_tier} accounts`);

  const dimensionDesc = parts.length > 0 ? parts.join(' and ') : 'this combination';
  return `Content with ${dimensionDesc} gets ${magnitude.toFixed(1)}x more engagement (based on ${p.ext_sample_count} external tweets)`;
}

// ─── Main ───

export async function runHypothesisGeneration(): Promise<{ generated: number; skipped: number }> {
  let generated = 0;
  let skipped = 0;

  try {
    const sb = getSupabaseClient();

    // Determine current growth stage
    const followerCount = await getCurrentFollowerCount();
    const ourStage = computeStage(followerCount);
    console.log(TAG, `Current stage: ${ourStage} (${followerCount} followers)`);

    // 1. Fetch strong patterns
    const { data: patterns, error: patErr } = await sb
      .from('external_patterns')
      .select('*')
      .in('confidence', ['medium', 'high'])
      .gte('ext_sample_count', 20)
      .eq('direction', 'do_more')
      .order('ext_avg_engagement_rate', { ascending: false })
      .limit(20);

    if (patErr) {
      console.error(TAG, 'Failed to fetch strong patterns:', patErr.message);
      return { generated: 0, skipped: 0 };
    }

    if (!patterns || patterns.length === 0) {
      console.log(TAG, 'No strong patterns found to generate hypotheses from.');
      return { generated: 0, skipped: 0 };
    }

    console.log(TAG, `Found ${patterns.length} strong patterns to evaluate.`);

    // 2. Fetch existing active hypotheses for dedup
    const { data: existing, error: exErr } = await sb
      .from('external_hypotheses')
      .select('id, condition, is_active')
      .eq('is_active', true);

    if (exErr) {
      console.error(TAG, 'Failed to fetch existing hypotheses:', exErr.message);
      return { generated: 0, skipped: 0 };
    }

    const existingKeys = new Set<string>();
    if (existing) {
      for (const h of existing as ExistingHypothesis[]) {
        if (h.condition) {
          existingKeys.add(conditionKey(h.condition));
        }
      }
    }

    // 3. Compute overall median engagement rate for magnitude calculation
    let medianEngagement = 0.02; // fallback
    try {
      const engagementRates = (patterns as StrongPattern[])
        .map((p) => p.ext_avg_engagement_rate)
        .filter((r) => r > 0)
        .sort((a, b) => a - b);
      if (engagementRates.length > 0) {
        const mid = Math.floor(engagementRates.length / 2);
        medianEngagement = engagementRates.length % 2 === 0
          ? (engagementRates[mid - 1] + engagementRates[mid]) / 2
          : engagementRates[mid];
      }
    } catch {
      // keep fallback
    }

    // 4. Generate hypotheses for uncovered patterns
    const toInsert: any[] = [];

    for (const p of patterns as StrongPattern[]) {
      if (toInsert.length >= MAX_NEW_PER_RUN) break;

      const cond = buildCondition(p);
      const key = conditionKey(cond);

      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      const magnitude = medianEngagement > 0
        ? p.ext_avg_engagement_rate / medianEngagement
        : 1.0;

      if (magnitude < 1.1) {
        skipped++;
        continue;
      }

      const hypothesis = {
        hypothesis_text: buildHypothesisText(p, magnitude),
        hypothesis_type: inferHypothesisType(p),
        condition: cond,
        predicted_metric: 'views',
        predicted_direction: 'higher',
        predicted_magnitude: Math.round(magnitude * 100) / 100,
        external_evidence: {
          sample_size: p.ext_sample_count,
          avg_er: Math.round(p.ext_avg_engagement_rate * 10000) / 10000,
          avg_likes: Math.round(p.ext_avg_likes * 100) / 100,
          source_pattern_id: p.id,
        },
        our_stage: ourStage,
        status: 'untested',
        is_active: true,
        times_tested: 0,
        times_confirmed: 0,
        times_rejected: 0,
        confidence_score: 0,
        created_at: new Date().toISOString(),
      };

      toInsert.push(hypothesis);
      existingKeys.add(key); // prevent duplicates within the same batch
    }

    skipped += (patterns.length - toInsert.length - skipped);

    // 5. Insert
    if (toInsert.length > 0) {
      const { error: insErr } = await sb
        .from('external_hypotheses')
        .insert(toInsert);

      if (insErr) {
        console.error(TAG, 'Failed to insert hypotheses:', insErr.message);
        return { generated: 0, skipped: patterns.length };
      }

      generated = toInsert.length;
      console.log(TAG, `Generated ${generated} new hypotheses, skipped ${skipped}.`);
    } else {
      console.log(TAG, `All patterns already covered. Skipped ${skipped}.`);
    }
  } catch (err: any) {
    console.error(TAG, 'Hypothesis generation failed (non-fatal):', err?.message ?? err);
  }

  return { generated, skipped };
}
