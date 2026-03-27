/**
 * Brain: Feedback Loop
 *
 * Records expected vs actual performance for every action we take.
 * Diagnoses WHY something failed using rule-based classification.
 *
 * Two components:
 * 1. FeedbackRecorder — creates feedback_events from new outcomes
 * 2. FailureDiagnoser — classifies underperformance reasons
 *
 * Runs every 15 minutes.
 */

import { getSupabaseClient } from '../db';
import { getSelfModel, insertFeedbackEvent } from './db';
import type {
  FeedbackEvent,
  OutcomeClass,
  FailureDiagnosis,
  GrowthPhase,
} from './types';

const LOG_PREFIX = '[brain/feedback]';

// =============================================================================
// Main job: Process new outcomes into feedback events
// =============================================================================

export async function runFeedbackLoop(): Promise<{ events_created: number }> {
  const supabase = getSupabaseClient();
  const selfModel = await getSelfModel();

  if (!selfModel) {
    console.warn(`${LOG_PREFIX} No self-model state — skipping`);
    return { events_created: 0 };
  }

  // Find outcomes that don't have feedback events yet
  // Look at outcomes collected in the last 48h
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: recentOutcomes } = await supabase
    .from('outcomes')
    .select('decision_id, tweet_id, impressions, likes, er_calculated, followers_gained, collected_at')
    .eq('simulated', false)
    .gte('collected_at', cutoff)
    .not('impressions', 'is', null)
    .order('collected_at', { ascending: false })
    .limit(100);

  if (!recentOutcomes || recentOutcomes.length === 0) {
    return { events_created: 0 };
  }

  // Get existing feedback events to avoid duplicates
  const decisionIds = recentOutcomes
    .map(o => o.decision_id)
    .filter(Boolean);

  const { data: existingFeedback } = await supabase
    .from('feedback_events')
    .select('decision_id')
    .in('decision_id', decisionIds.length > 0 ? decisionIds : ['none']);

  const existingSet = new Set((existingFeedback ?? []).map(f => f.decision_id));

  // Get content metadata for action type context
  const { data: metadata } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, features, posted_at, target_username')
    .in('decision_id', decisionIds.length > 0 ? decisionIds : ['none']);

  const metaMap = new Map((metadata ?? []).map(m => [m.decision_id, m]));

  let eventsCreated = 0;

  for (const outcome of recentOutcomes) {
    if (!outcome.decision_id) continue;
    if (existingSet.has(outcome.decision_id)) continue;

    const meta = metaMap.get(outcome.decision_id);
    const actionType = meta?.decision_type ?? 'unknown';
    const isReply = actionType === 'reply';

    // Get expected values from self-model based on action type
    const expectedViews = isReply
      ? selfModel.expected_views_per_reply
      : selfModel.expected_views_per_post;
    const expectedLikes = isReply
      ? selfModel.expected_likes_per_reply
      : selfModel.expected_likes_per_post;
    const expectedER = selfModel.expected_engagement_rate;

    const actualViews = outcome.impressions ?? 0;
    const actualLikes = outcome.likes ?? 0;
    const actualER = outcome.er_calculated ?? 0;

    // Compute deltas (actual / expected ratio)
    const viewsDelta = expectedViews && expectedViews > 0
      ? actualViews / expectedViews
      : null;
    const likesDelta = expectedLikes && expectedLikes > 0
      ? actualLikes / expectedLikes
      : null;
    const engagementDelta = expectedER && expectedER > 0
      ? actualER / expectedER
      : null;

    // Classify outcome
    const outcomeClass = classifyOutcome(viewsDelta);

    // Diagnose failures
    let failureDiagnosis: FailureDiagnosis | null = null;
    let diagnosisConfidence: number | null = null;
    let diagnosisDetails: Record<string, any> | null = null;

    if (outcomeClass === 'below_expected' || outcomeClass === 'failure') {
      const diagnosis = diagnoseFailure({
        actualViews,
        actualLikes,
        actualER,
        expectedViews: expectedViews ?? 0,
        actionType,
        postedHour: meta?.posted_at ? new Date(meta.posted_at).getUTCHours() : null,
        bestHours: selfModel.best_posting_hours?.map(h => Number(h.name)) ?? [],
        features: meta?.features,
        recentTopics: selfModel.best_topics?.map(t => t.name) ?? [],
        growthPhase: selfModel.growth_phase,
        followerCount: selfModel.follower_count,
      });

      failureDiagnosis = diagnosis.diagnosis;
      diagnosisConfidence = diagnosis.confidence;
      diagnosisDetails = diagnosis.details;
    }

    // Extract posted hour from metadata
    const postedAt = meta?.posted_at ? new Date(meta.posted_at) : null;

    const event: Omit<FeedbackEvent, 'id' | 'created_at'> = {
      decision_id: outcome.decision_id,
      tweet_id: outcome.tweet_id,
      action_type: actionType,

      expected_views: expectedViews ?? null,
      expected_likes: expectedLikes ?? null,
      expected_engagement_rate: expectedER ?? null,

      actual_views: actualViews,
      actual_likes: actualLikes,
      actual_engagement_rate: actualER,
      actual_followers_gained: outcome.followers_gained ?? null,

      views_delta: viewsDelta !== null ? Math.round(viewsDelta * 100) / 100 : null,
      likes_delta: likesDelta !== null ? Math.round(likesDelta * 100) / 100 : null,
      engagement_delta: engagementDelta !== null ? Math.round(engagementDelta * 100) / 100 : null,

      outcome_class: outcomeClass,
      failure_diagnosis: failureDiagnosis,
      diagnosis_confidence: diagnosisConfidence,
      diagnosis_details: diagnosisDetails,

      content_features: meta?.features ?? null,
      classification: null,
      target_username: meta?.target_username ?? null,
      target_tier: null,
      posted_hour_utc: postedAt ? postedAt.getUTCHours() : null,
      posted_day_of_week: postedAt ? postedAt.getUTCDay() : null,
      growth_phase: selfModel.growth_phase,
      follower_count_at_post: selfModel.follower_count,

      measured_at: outcome.collected_at,
    };

    const id = await insertFeedbackEvent(event);
    if (id) eventsCreated++;
  }

  if (eventsCreated > 0) {
    console.log(`${LOG_PREFIX} Created ${eventsCreated} feedback events`);
  }

  return { events_created: eventsCreated };
}

// =============================================================================
// Outcome Classification
// =============================================================================

function classifyOutcome(viewsDelta: number | null): OutcomeClass {
  if (viewsDelta === null) return 'expected'; // No baseline to compare

  if (viewsDelta >= 3.0) return 'breakout';
  if (viewsDelta >= 1.5) return 'above_expected';
  if (viewsDelta >= 0.5) return 'expected';
  if (viewsDelta >= 0.2) return 'below_expected';
  return 'failure';
}

// =============================================================================
// Failure Diagnosis (Rule-Based)
// =============================================================================

interface DiagnosisInput {
  actualViews: number;
  actualLikes: number;
  actualER: number;
  expectedViews: number;
  actionType: string;
  postedHour: number | null;
  bestHours: number[];
  features: any;
  recentTopics: string[];
  growthPhase: GrowthPhase;
  followerCount: number;
}

interface DiagnosisResult {
  diagnosis: FailureDiagnosis;
  confidence: number;
  details: Record<string, any>;
}

function diagnoseFailure(input: DiagnosisInput): DiagnosisResult {
  const scores: { diagnosis: FailureDiagnosis; score: number; details: Record<string, any> }[] = [];

  // --- algo_didnt_push: Very low views despite decent content ---
  if (input.actualViews < 50 && input.followerCount > 50) {
    scores.push({
      diagnosis: 'algo_didnt_push',
      score: 0.8,
      details: {
        reason: 'Views extremely low — algorithm likely did not distribute',
        actual_views: input.actualViews,
        follower_count: input.followerCount,
        view_to_follower: input.followerCount > 0 ? input.actualViews / input.followerCount : 0,
      },
    });
  }

  // --- timing_bad: Posted outside our optimal hours ---
  if (input.postedHour !== null && input.bestHours.length > 0) {
    const isOptimalHour = input.bestHours.includes(input.postedHour);
    if (!isOptimalHour) {
      scores.push({
        diagnosis: 'timing_bad',
        score: 0.5,
        details: {
          reason: 'Posted outside proven optimal hours',
          posted_hour: input.postedHour,
          best_hours: input.bestHours,
        },
      });
    }
  }

  // --- authority_gap: Strategy works for bigger accounts but not us ---
  if (input.growthPhase === 'cold_start' && input.actionType !== 'reply') {
    scores.push({
      diagnosis: 'authority_gap',
      score: 0.6,
      details: {
        reason: 'Cold start phase — original posts lack authority signal. Replies may perform better.',
        growth_phase: input.growthPhase,
        action_type: input.actionType,
      },
    });
  }

  // --- content_bad: Poor structural features ---
  if (input.features) {
    const f = input.features;
    const hasHook = f.starts_with_question || f.starts_with_bold_claim || f.starts_with_number || f.has_question;
    const hasSpecificity = f.contains_specific_data || f.has_numbers;

    if (!hasHook && !hasSpecificity && (f.word_count ?? 0) < 15) {
      scores.push({
        diagnosis: 'content_bad',
        score: 0.7,
        details: {
          reason: 'Content lacks hook, specificity, and substance',
          has_hook: hasHook,
          has_specificity: hasSpecificity,
          word_count: f.word_count,
        },
      });
    }
  }

  // --- saturation: Same topic posted too many times recently ---
  // This would need recent growth_ledger data — simplified check
  if (input.features?.topic_cluster && input.recentTopics.length > 0) {
    const topic = input.features.topic_cluster;
    const topicCount = input.recentTopics.filter(t => t === topic).length;
    if (topicCount >= 3) {
      scores.push({
        diagnosis: 'saturation',
        score: 0.5,
        details: {
          reason: 'Topic has been posted about frequently recently',
          topic,
          recent_count: topicCount,
        },
      });
    }
  }

  // --- topic_mismatch: Topic doesn't match audience interests ---
  if (input.actualLikes === 0 && input.actualViews > 20) {
    scores.push({
      diagnosis: 'topic_mismatch',
      score: 0.4,
      details: {
        reason: 'Some views but zero engagement — content may not resonate with audience',
        views: input.actualViews,
        likes: input.actualLikes,
      },
    });
  }

  // Pick highest-scoring diagnosis
  if (scores.length === 0) {
    return {
      diagnosis: 'content_bad', // Default
      confidence: 0.3,
      details: { reason: 'No specific failure pattern detected — defaulting to content quality' },
    };
  }

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  return {
    diagnosis: best.diagnosis,
    confidence: best.score,
    details: best.details,
  };
}
