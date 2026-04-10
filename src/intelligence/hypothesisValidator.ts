/**
 * Hypothesis Validator
 *
 * Tests hypotheses from `external_hypotheses` against actual internal
 * performance data in `growth_ledger`.  Each hypothesis specifies a condition
 * (JSONB) and a predicted direction.  We compare the treatment group (rows
 * matching the condition) against the control group (rows NOT matching) and
 * track confirmation / rejection over multiple test rounds.
 *
 * Non-fatal throughout -- all errors are caught and logged.
 */

import { getSupabaseClient } from '../db/index';
import { getCurrentFollowerCount } from '../tracking/followerCountTracker';

const TAG = '[HYPOTHESIS_VAL]';

function computeStage(followers: number): string {
  if (followers < 500) return 'bootstrap';
  if (followers < 2000) return 'early';
  if (followers < 10000) return 'growth';
  return 'established';
}

/**
 * Build a Supabase filter chain to find external_patterns rows matching
 * a hypothesis condition JSONB (matching on shared dimension keys).
 */
function buildPatternFilterFromCondition(
  query: any,
  condition: Record<string, any>,
): any {
  let q = query;
  const dimensionKeys = ['angle', 'tone', 'format', 'hour_bucket', 'topic', 'target_tier'];
  for (const key of dimensionKeys) {
    if (condition[key]) {
      q = q.eq(key, condition[key]);
    }
  }
  return q;
}

// ─── Types ───

interface Hypothesis {
  id: string;
  condition: Record<string, any>;
  predicted_metric: string;
  predicted_direction: string;
  status: string;
  times_tested: number;
  times_confirmed: number;
  times_rejected: number;
  confidence_score: number;
  is_active: boolean;
  our_stage?: string;
}

interface LedgerRow {
  views: number | null;
  reward: number | null;
  angle: string | null;
  tone: string | null;
  format: string | null;
  hour_bucket: string | null;
  topic: string | null;
  target_tier: string | null;
}

// ─── Helpers ───

function matchesCondition(row: LedgerRow, condition: Record<string, any>): boolean {
  for (const [key, value] of Object.entries(condition)) {
    const rowVal = (row as any)[key];
    if (rowVal === undefined || rowVal === null) return false;
    if (String(rowVal).toLowerCase() !== String(value).toLowerCase()) return false;
  }
  return true;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function getMetricValue(row: LedgerRow, metric: string): number | null {
  if (metric === 'views' && row.views != null) return row.views;
  if (metric === 'reward' && row.reward != null) return row.reward;
  // Fall back to views
  if (row.views != null) return row.views;
  return null;
}

// ─── Main ───

export async function runHypothesisValidation(): Promise<{
  validated: number;
  confirmed: number;
  rejected: number;
  inconclusive: number;
}> {
  let validated = 0;
  let confirmed = 0;
  let rejected = 0;
  let inconclusive = 0;

  try {
    const sb = getSupabaseClient();

    // Determine current growth stage
    const followerCount = await getCurrentFollowerCount();
    const currentStage = computeStage(followerCount);

    // 1. Fetch active untested/testing hypotheses
    const { data: hypotheses, error: hErr } = await sb
      .from('external_hypotheses')
      .select('*')
      .in('status', ['untested', 'testing'])
      .eq('is_active', true)
      .limit(20);

    if (hErr) {
      console.error(TAG, 'Failed to fetch hypotheses:', hErr.message);
      return { validated: 0, confirmed: 0, rejected: 0, inconclusive: 0 };
    }

    if (!hypotheses || hypotheses.length === 0) {
      console.log(TAG, 'No hypotheses to validate.');
      return { validated: 0, confirmed: 0, rejected: 0, inconclusive: 0 };
    }

    console.log(TAG, `Evaluating ${hypotheses.length} hypotheses.`);

    // 2. Fetch growth_ledger data (recent, with metric columns)
    const { data: ledger, error: lErr } = await sb
      .from('growth_ledger')
      .select('views, reward, angle, tone, format, hour_bucket, topic, target_tier')
      .order('created_at', { ascending: false })
      .limit(500);

    if (lErr) {
      console.error(TAG, 'Failed to fetch growth_ledger:', lErr.message);
      return { validated: 0, confirmed: 0, rejected: 0, inconclusive: 0 };
    }

    if (!ledger || ledger.length === 0) {
      console.log(TAG, 'No growth_ledger data available for validation.');
      return { validated: 0, confirmed: 0, rejected: 0, inconclusive: 0 };
    }

    // 3. Validate each hypothesis
    for (const h of hypotheses as Hypothesis[]) {
      try {
        const condition = h.condition;
        if (!condition || Object.keys(condition).length === 0) {
          continue;
        }

        const metric = h.predicted_metric || 'views';
        const direction = h.predicted_direction || 'higher';

        // Split into treatment/control
        const treatmentValues: number[] = [];
        const controlValues: number[] = [];

        for (const row of ledger as LedgerRow[]) {
          const val = getMetricValue(row, metric);
          if (val === null) continue;

          if (matchesCondition(row, condition)) {
            treatmentValues.push(val);
          } else {
            controlValues.push(val);
          }
        }

        // Need minimum samples in both groups
        if (treatmentValues.length < 3 || controlValues.length < 3) {
          // Insufficient data -- mark as testing and move on
          if (h.status !== 'testing') {
            await sb
              .from('external_hypotheses')
              .update({ status: 'testing', updated_at: new Date().toISOString() })
              .eq('id', h.id);
          }
          continue;
        }

        const treatmentMean = mean(treatmentValues);
        const controlMean = mean(controlValues);

        let roundResult: 'confirmed' | 'rejected' | 'inconclusive' = 'inconclusive';

        if (direction === 'higher') {
          if (treatmentMean > controlMean * 1.2) {
            roundResult = 'confirmed';
          } else if (treatmentMean < controlMean * 0.8) {
            roundResult = 'rejected';
          }
        } else {
          // direction === 'lower'
          if (treatmentMean < controlMean * 0.8) {
            roundResult = 'confirmed';
          } else if (treatmentMean > controlMean * 1.2) {
            roundResult = 'rejected';
          }
        }

        const newTimesTested = (h.times_tested || 0) + 1;
        const newTimesConfirmed = (h.times_confirmed || 0) + (roundResult === 'confirmed' ? 1 : 0);
        const newTimesRejected = (h.times_rejected || 0) + (roundResult === 'rejected' ? 1 : 0);

        // Determine overall status after enough rounds
        let newStatus = 'testing';
        if (newTimesTested >= 3) {
          if (newTimesConfirmed >= 2) {
            newStatus = 'confirmed';
            confirmed++;
          } else if (newTimesRejected >= 2) {
            newStatus = 'rejected';
            rejected++;
          } else {
            newStatus = 'inconclusive';
            inconclusive++;
          }
        }

        const newConfidenceScore = Math.round(
          (newTimesConfirmed / (newTimesConfirmed + newTimesRejected + 1)) * 100
        ) / 100;

        // Retire hypotheses with too many rejections
        const shouldRetire = newTimesRejected >= 3;

        const update: Record<string, any> = {
          status: newStatus,
          times_tested: newTimesTested,
          times_confirmed: newTimesConfirmed,
          times_rejected: newTimesRejected,
          confidence_score: newConfidenceScore,
          updated_at: new Date().toISOString(),
          validation_metadata: {
            last_treatment_count: treatmentValues.length,
            last_control_count: controlValues.length,
            last_treatment_mean: Math.round(treatmentMean * 100) / 100,
            last_control_mean: Math.round(controlMean * 100) / 100,
            last_round_result: roundResult,
          },
        };

        if (shouldRetire) {
          // Stage-aware rejection: if hypothesis was from a different stage, preserve it
          if (h.our_stage && h.our_stage !== currentStage) {
            update.status = 'rejected_at_stage_' + h.our_stage;
            update.is_active = true; // don't retire stage-specific rejections
          } else {
            update.is_active = false;
            update.status = 'rejected';
          }
        }

        const { error: upErr } = await sb
          .from('external_hypotheses')
          .update(update)
          .eq('id', h.id);

        if (upErr) {
          console.error(TAG, `Failed to update hypothesis ${h.id}:`, upErr.message);
          continue;
        }

        // Update causal_status on matching external_patterns rows
        try {
          if (newStatus === 'confirmed') {
            const patQuery = buildPatternFilterFromCondition(
              sb.from('external_patterns').update({ causal_status: 'internally_confirmed', updated_at: new Date().toISOString() }),
              h.condition,
            );
            await patQuery;
          } else if (newStatus === 'rejected' || update.status?.startsWith('rejected')) {
            const patQuery = buildPatternFilterFromCondition(
              sb.from('external_patterns').update({ causal_status: 'internally_rejected', updated_at: new Date().toISOString() }),
              h.condition,
            );
            await patQuery;
          }
        } catch (causalErr: any) {
          console.warn(TAG, `Failed to update causal_status for hypothesis ${h.id} (non-fatal):`, causalErr?.message);
        }

        validated++;
        console.log(
          TAG,
          `Hypothesis ${h.id}: round=${roundResult}, tested=${newTimesTested}, status=${update.status}, confidence=${newConfidenceScore}`
        );
      } catch (err: any) {
        console.error(TAG, `Error validating hypothesis ${h.id} (non-fatal):`, err?.message ?? err);
      }
    }

    console.log(TAG, `Validation complete: validated=${validated}, confirmed=${confirmed}, rejected=${rejected}, inconclusive=${inconclusive}`);
  } catch (err: any) {
    console.error(TAG, 'Hypothesis validation failed (non-fatal):', err?.message ?? err);
  }

  return { validated, confirmed, rejected, inconclusive };
}
