/**
 * Content Experiment Engine
 *
 * Every piece of content is an experiment with tagged dimensions (topic_source,
 * angle, tone, format). After metrics arrive, the system learns which dimension
 * combinations drive the most views / engagement / followers.
 *
 * Uses an 80/20 exploit/explore split (configurable via CONTENT_EXPLORE_RATE).
 * With < 5 total experiments we always explore — not enough signal to exploit.
 */

import { getSupabaseClient } from '../db/index';

// ─── Types ───

export type TopicSource = 'trending' | 'discovered_buzz' | 'evergreen' | 'news' | 'cultural_moment';
export type Angle = 'hot_take' | 'science_explainer' | 'news_report' | 'educational' | 'provocative' | 'myth_bust' | 'personal_insight';
export type Tone = 'authoritative' | 'curious' | 'contrarian' | 'empathetic' | 'urgent' | 'conversational';
export type Format = 'short_take' | 'thread' | 'question' | 'list' | 'story' | 'one_liner';

/** The strategic dimensions we track for each piece of content */
export interface ContentExperiment {
  experiment_id: string;          // = decision_id

  // INTENT dimensions (tagged at generation time)
  topic_source: TopicSource;
  angle: Angle;
  tone: Tone;
  format: Format;

  // OUTCOME (filled after metrics arrive)
  views_1h?: number;
  views_24h?: number;
  engagement_rate?: number;
  followers_gained?: number;

  created_at: string;
}

/** What the engine recommends for the next post */
export interface ContentStrategy {
  recommended_topic_source: string;
  recommended_angle: string;
  recommended_tone: string;
  recommended_format: string;
  confidence: number;              // 0-1, how confident in recommendation
  is_exploration: boolean;         // true = trying something new, false = exploiting known winner
  reasoning: string;               // human-readable explanation
}

// ─── Dimension value lists (used for exploration) ───

const TOPIC_SOURCES: TopicSource[] = ['trending', 'discovered_buzz', 'evergreen', 'news', 'cultural_moment'];
const ANGLES: Angle[] = ['hot_take', 'science_explainer', 'news_report', 'educational', 'provocative', 'myth_bust', 'personal_insight'];
const TONES: Tone[] = ['authoritative', 'curious', 'contrarian', 'empathetic', 'urgent', 'conversational'];
const FORMATS: Format[] = ['short_take', 'thread', 'question', 'list', 'story', 'one_liner'];

// ─── Config ───

const EXPLORE_RATE = Math.min(1, Math.max(0, Number(process.env.CONTENT_EXPLORE_RATE) || 0.2));
const MIN_DATA_POINTS = 2;   // per combination before we trust it for exploitation
const MIN_TOTAL_EXPERIMENTS = 5; // below this we always explore

const TAG = '[CONTENT_EXPERIMENT]';

// ─── Helpers ───

/** Build a stable key for a dimension combination */
function comboKey(topic_source: string, angle: string, tone: string, format: string): string {
  return `${topic_source}|${angle}|${tone}|${format}`;
}

interface ExperimentRow {
  decision_id: string;
  features: Record<string, any> | null;
  views_1h: number | null;
  views_24h: number | null;
  engagement_rate: number | null;
  followers_gained: number | null;
  created_at: string;
}

interface ComboStats {
  topic_source: string;
  angle: string;
  tone: string;
  format: string;
  count: number;
  avg_views: number;
  total_views: number;
}

/**
 * Load all past experiments that have experiment tags stored in features.
 */
async function loadExperiments(): Promise<ExperimentRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, features, views_1h, views_24h, engagement_rate, followers_gained, created_at')
    .not('features', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.warn(`${TAG} Failed to load experiments: ${error.message}`);
    return [];
  }

  // Filter to only rows that actually have experiment tags
  return (data || []).filter((row: any) => {
    const exp = row.features?.experiment;
    return exp && exp.topic_source && exp.angle && exp.tone && exp.format;
  }) as ExperimentRow[];
}

/**
 * Group experiments by dimension combination and compute avg views.
 */
function buildComboStats(experiments: ExperimentRow[]): Map<string, ComboStats> {
  const map = new Map<string, ComboStats>();

  for (const row of experiments) {
    const exp = row.features!.experiment;
    const key = comboKey(exp.topic_source, exp.angle, exp.tone, exp.format);
    const views = row.views_24h ?? row.views_1h ?? 0;

    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.total_views += views;
      existing.avg_views = existing.total_views / existing.count;
    } else {
      map.set(key, {
        topic_source: exp.topic_source,
        angle: exp.angle,
        tone: exp.tone,
        format: exp.format,
        count: 1,
        avg_views: views,
        total_views: views,
      });
    }
  }

  return map;
}

/**
 * Pick a random value from an array.
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Exploration: prefer combinations we've NEVER tried, then under-sampled ones.
 */
function exploreStrategy(comboStats: Map<string, ComboStats>): ContentStrategy {
  // Build the set of tried combinations
  const triedKeys = new Set(Array.from(comboStats.keys()));

  // Try to find a completely untried combination (random sampling)
  for (let attempt = 0; attempt < 50; attempt++) {
    const ts = pickRandom(TOPIC_SOURCES);
    const ag = pickRandom(ANGLES);
    const tn = pickRandom(TONES);
    const fm = pickRandom(FORMATS);
    const key = comboKey(ts, ag, tn, fm);

    if (!triedKeys.has(key)) {
      return {
        recommended_topic_source: ts,
        recommended_angle: ag,
        recommended_tone: tn,
        recommended_format: fm,
        confidence: 0.1,
        is_exploration: true,
        reasoning: `Exploring untried combination: ${ts}/${ag}/${tn}/${fm}`,
      };
    }
  }

  // All random samples were already tried — pick the least-sampled combination
  const sorted = Array.from(comboStats.values()).sort((a, b) => a.count - b.count);
  if (sorted.length > 0) {
    const pick = sorted[0];
    return {
      recommended_topic_source: pick.topic_source,
      recommended_angle: pick.angle,
      recommended_tone: pick.tone,
      recommended_format: pick.format,
      confidence: 0.2,
      is_exploration: true,
      reasoning: `Re-exploring under-sampled combination (${pick.count} data points): ${pick.topic_source}/${pick.angle}/${pick.tone}/${pick.format}`,
    };
  }

  // Absolute fallback — random everything
  return {
    recommended_topic_source: pickRandom(TOPIC_SOURCES),
    recommended_angle: pickRandom(ANGLES),
    recommended_tone: pickRandom(TONES),
    recommended_format: pickRandom(FORMATS),
    confidence: 0.05,
    is_exploration: true,
    reasoning: 'Pure random exploration (no data yet)',
  };
}

/**
 * Exploitation: pick the combination with highest avg views that has enough data.
 */
function exploitStrategy(comboStats: Map<string, ComboStats>): ContentStrategy | null {
  const eligible = Array.from(comboStats.values())
    .filter(c => c.count >= MIN_DATA_POINTS)
    .sort((a, b) => b.avg_views - a.avg_views);

  if (eligible.length === 0) return null;

  const best = eligible[0];
  const confidence = Math.min(0.95, 0.4 + (best.count / 20)); // more data → more confidence, cap 0.95

  return {
    recommended_topic_source: best.topic_source,
    recommended_angle: best.angle,
    recommended_tone: best.tone,
    recommended_format: best.format,
    confidence,
    is_exploration: false,
    reasoning: `Exploiting best combination (${best.avg_views.toFixed(0)} avg views, ${best.count} experiments): ${best.topic_source}/${best.angle}/${best.tone}/${best.format}`,
  };
}

// ─── Public API ───

/**
 * Recommend the next content strategy based on past experiment results.
 *
 * - < 5 total experiments → always explore
 * - Otherwise 80% exploit (best known combo), 20% explore (untried/under-sampled)
 */
export async function recommendNextStrategy(): Promise<ContentStrategy> {
  try {
    const experiments = await loadExperiments();
    const comboStats = buildComboStats(experiments);
    const totalExperiments = experiments.length;

    console.log(`${TAG} ${totalExperiments} past experiments, ${comboStats.size} unique combos`);

    // Not enough data — always explore
    if (totalExperiments < MIN_TOTAL_EXPERIMENTS) {
      const strategy = exploreStrategy(comboStats);
      strategy.reasoning = `Only ${totalExperiments} experiments (need ${MIN_TOTAL_EXPERIMENTS}). ${strategy.reasoning}`;
      console.log(`${TAG} EXPLORE (insufficient data): ${strategy.reasoning}`);
      return strategy;
    }

    // Portfolio allocation: 50% proven_winner, 25% variant, 15% hypothesis_test, 10% wild_card
    const roll = Math.random();

    if (roll < 0.50) {
      // 50%: proven_winner — exploit top combo
      const exploitResult = exploitStrategy(comboStats);
      if (exploitResult) {
        exploitResult.reasoning = `[proven_winner] ${exploitResult.reasoning}`;
        console.log(`${TAG} PROVEN_WINNER (roll=${roll.toFixed(2)}): ${exploitResult.reasoning}`);
        return exploitResult;
      }
      // Fall through to explore if no exploitable combo
    } else if (roll < 0.75) {
      // 25%: variant — top combo with 1 dimension randomly mutated
      const exploitResult = exploitStrategy(comboStats);
      if (exploitResult) {
        const dimensionArrays: { key: keyof ContentStrategy; values: readonly string[] }[] = [
          { key: 'recommended_topic_source', values: TOPIC_SOURCES },
          { key: 'recommended_angle', values: ANGLES },
          { key: 'recommended_tone', values: TONES },
          { key: 'recommended_format', values: FORMATS },
        ];
        const dimToMutate = dimensionArrays[Math.floor(Math.random() * dimensionArrays.length)];
        const currentVal = exploitResult[dimToMutate.key] as string;
        const alternatives = dimToMutate.values.filter(v => v !== currentVal);
        if (alternatives.length > 0) {
          (exploitResult as any)[dimToMutate.key] = pickRandom(alternatives);
        }
        exploitResult.is_exploration = true;
        exploitResult.confidence = Math.max(0.15, exploitResult.confidence * 0.6);
        exploitResult.reasoning = `[variant] Mutated ${dimToMutate.key.replace('recommended_', '')} from ${currentVal} → ${exploitResult[dimToMutate.key]}. ${exploitResult.reasoning}`;
        console.log(`${TAG} VARIANT (roll=${roll.toFixed(2)}): ${exploitResult.reasoning}`);
        return exploitResult;
      }
    } else if (roll < 0.90) {
      // 15%: hypothesis_test — pick an untested hypothesis condition
      try {
        const supabase = getSupabaseClient();
        const { data: hyps } = await supabase
          .from('external_hypotheses')
          .select('id, condition')
          .eq('status', 'untested')
          .eq('is_active', true)
          .limit(5);

        if (hyps && hyps.length > 0) {
          const hyp = pickRandom(hyps);
          const cond = hyp.condition || {};
          const strategy: ContentStrategy = {
            recommended_topic_source: cond.topic_source || pickRandom(TOPIC_SOURCES),
            recommended_angle: cond.angle || pickRandom(ANGLES),
            recommended_tone: cond.tone || pickRandom(TONES),
            recommended_format: cond.format || pickRandom(FORMATS),
            confidence: 0.25,
            is_exploration: true,
            reasoning: `[hypothesis_test] Testing hypothesis ${hyp.id}: ${JSON.stringify(cond)}`,
          };
          console.log(`${TAG} HYPOTHESIS_TEST (roll=${roll.toFixed(2)}): ${strategy.reasoning}`);
          return strategy;
        }
      } catch (e: any) {
        console.warn(`${TAG} hypothesis_test lookup failed (non-fatal): ${e.message}`);
      }
      // Fall through to wild_card if no hypotheses
    }
    // 10% (or fallthrough): wild_card — completely random
    const wildCard = exploreStrategy(comboStats);
    wildCard.reasoning = `[wild_card] ${wildCard.reasoning}`;
    console.log(`${TAG} WILD_CARD (roll=${roll.toFixed(2)}): ${wildCard.reasoning}`);
    return wildCard;
  } catch (err: any) {
    console.error(`${TAG} Error recommending strategy: ${err.message}`);
    // Graceful degradation: random exploration
    return {
      recommended_topic_source: pickRandom(TOPIC_SOURCES),
      recommended_angle: pickRandom(ANGLES),
      recommended_tone: pickRandom(TONES),
      recommended_format: pickRandom(FORMATS),
      confidence: 0,
      is_exploration: true,
      reasoning: `Error loading experiments: ${err.message}. Falling back to random exploration.`,
    };
  }
}

/**
 * Record experiment dimensions for a decision.
 *
 * Stores the experiment tags in the features JSONB column of
 * content_generation_metadata_comprehensive, merging with any existing features.
 */
export async function recordExperiment(experiment: ContentExperiment): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    // Read existing features so we merge rather than overwrite
    const { data: existing, error: readError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('features')
      .eq('decision_id', experiment.experiment_id)
      .single();

    if (readError && readError.code !== 'PGRST116') {
      // PGRST116 = no rows, which is fine (we'll upsert below)
      console.warn(`${TAG} Failed to read existing features for ${experiment.experiment_id}: ${readError.message}`);
    }

    const existingFeatures = existing?.features || {};
    const updatedFeatures = {
      ...existingFeatures,
      experiment: {
        topic_source: experiment.topic_source,
        angle: experiment.angle,
        tone: experiment.tone,
        format: experiment.format,
      },
    };

    const { error: updateError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .update({ features: updatedFeatures })
      .eq('decision_id', experiment.experiment_id);

    if (updateError) {
      console.error(`${TAG} Failed to record experiment for ${experiment.experiment_id}: ${updateError.message}`);
      return;
    }

    console.log(`${TAG} Recorded experiment ${experiment.experiment_id}: ${experiment.topic_source}/${experiment.angle}/${experiment.tone}/${experiment.format}`);
  } catch (err: any) {
    console.error(`${TAG} Error recording experiment: ${err.message}`);
  }
}

/**
 * Update an experiment's outcome after metrics arrive.
 *
 * Called by the metrics scraper when views/engagement data comes in.
 */
export async function updateExperimentOutcome(
  decision_id: string,
  outcome: { views: number; engagement_rate: number; followers_gained: number },
): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    // Read current row to verify it has experiment tags
    const { data: row, error: readError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('features')
      .eq('decision_id', decision_id)
      .single();

    if (readError) {
      console.warn(`${TAG} Cannot update outcome for ${decision_id}: ${readError.message}`);
      return;
    }

    if (!row?.features?.experiment) {
      console.warn(`${TAG} Decision ${decision_id} has no experiment tags — skipping outcome update`);
      return;
    }

    // Store outcome metrics on the row
    const { error: updateError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .update({
        views_24h: outcome.views,
        engagement_rate: outcome.engagement_rate,
        followers_gained: outcome.followers_gained,
      })
      .eq('decision_id', decision_id);

    if (updateError) {
      console.error(`${TAG} Failed to update outcome for ${decision_id}: ${updateError.message}`);
      return;
    }

    console.log(`${TAG} Updated outcome for ${decision_id}: views=${outcome.views} eng=${outcome.engagement_rate} followers=+${outcome.followers_gained}`);
  } catch (err: any) {
    console.error(`${TAG} Error updating outcome: ${err.message}`);
  }
}
