/**
 * seed-external-intelligence.ts
 *
 * Pre-seeds growth_knowledge and external_patterns with researched Twitter
 * best practices so the system has useful priors on day 1.
 *
 * Safe to re-run: uses upsert with onConflict.
 *
 * Usage: npx tsx scripts/ops/seed-external-intelligence.ts
 */

// Load env first (must be before any other imports)
import './load-env';

import { getSupabaseClient } from '../../src/db/index';

// ---------------------------------------------------------------------------
// 1. growth_knowledge seeds
// ---------------------------------------------------------------------------
const knowledgeSeeds = [
  {
    question: 'What reply length gets the most engagement?',
    category: 'reply_style',
    answer:
      '[Pre-seeded] 60-100 characters. Short, specific replies outperform long ones by 2-3x. The sweet spot is one punchy sentence with a specific insight or data point. Replies over 150 chars get significantly less engagement.',
    confidence: 'medium',
    actionable_guidance:
      'Keep replies under 100 chars. One sentence. Include one specific number or mechanism.',
    applies_to: ['reply_generator'],
    evidence_sources: [
      { source: 'pre_seed', basis: 'Twitter growth research consensus', sample_size: 0 },
    ],
  },
  {
    question: 'How fast do we need to reply for maximum visibility?',
    category: 'reply_style',
    answer:
      '[Pre-seeded] Under 15 minutes. The first 5 replies on a tweet get ~80% of all reply engagement. After 30 minutes, visibility drops dramatically. Speed is the single biggest factor in reply success.',
    confidence: 'high',
    actionable_guidance:
      'Prioritize reply speed above all. Skip opportunities older than 30 minutes. Target < 10 minutes.',
    applies_to: ['opportunity_scorer', 'reply_generator'],
    evidence_sources: [
      { source: 'pre_seed', basis: 'Twitter algorithm known behavior', sample_size: 0 },
    ],
  },
  {
    question: 'What tone works best for replies?',
    category: 'reply_style',
    answer:
      '[Pre-seeded] Curious and specific beats authoritative and generic. "What most people miss about X is Y" outperforms "X is important because Y." Adding a surprising fact or counterintuitive angle drives engagement.',
    confidence: 'medium',
    actionable_guidance:
      'Default to curious tone. Lead with surprise or counterintuitive angle. Avoid textbook/authoritative tone.',
    applies_to: ['reply_generator', 'content_experiment'],
    evidence_sources: [
      { source: 'pre_seed', basis: 'Health Twitter engagement patterns', sample_size: 0 },
    ],
  },
  {
    question: 'What time of day produces the best engagement?',
    category: 'timing',
    answer:
      '[Pre-seeded] 7-10am ET and 5-8pm ET are peak engagement windows for health content. Morning commute and evening wind-down are when health-conscious audiences scroll Twitter most actively.',
    confidence: 'low',
    actionable_guidance:
      'Concentrate actions in 7-10am ET and 5-8pm ET. Reduce activity 11pm-6am ET.',
    applies_to: ['strategy_learner', 'adaptive_strategy'],
    evidence_sources: [
      { source: 'pre_seed', basis: 'General Twitter engagement data', sample_size: 0 },
    ],
  },
  {
    question: 'Which account size tier is best for reply targeting?',
    category: 'targeting',
    answer:
      '[Pre-seeded] 10K-100K followers is the sweet spot. Under 10K: not enough audience to see our reply. Over 100K: too many replies, ours gets buried. 10K-100K accounts have engaged audiences and manageable reply volume.',
    confidence: 'medium',
    actionable_guidance:
      'Prioritize 10K-100K follower accounts. Deprioritize mega accounts (500K+). Allow small accounts (5K-10K) if low reply count on tweet.',
    applies_to: ['opportunity_scorer', 'account_pool_optimizer'],
    evidence_sources: [
      { source: 'pre_seed', basis: 'Reply visibility research', sample_size: 0 },
    ],
  },
  {
    question: 'What content format gets the most views?',
    category: 'format',
    answer:
      "[Pre-seeded] For accounts under 1K followers: short single tweets massively outperform threads. Threads from unknown accounts get near-zero engagement. Short provocative takes, questions, and myth-busts work best. Save threads for after 5K+ followers.",
    confidence: 'medium',
    actionable_guidance:
      'At bootstrap stage: 90% short singles, 10% question-format singles. Zero threads until 2K+ followers.',
    applies_to: ['content_experiment', 'strategy_learner'],
    evidence_sources: [
      { source: 'pre_seed', basis: 'Small account growth patterns', sample_size: 0 },
    ],
    stage_guidance: {
      bootstrap: 'No threads. Short singles only.',
      early: 'Occasional 2-part threads OK.',
      growth: 'Threads viable for news/analysis.',
    },
  },
  {
    question: 'Do questions in content outperform statements?',
    category: 'content',
    answer:
      '[Pre-seeded] Yes, significantly. Questions drive 2-3x more replies than statements. "Did you know X?" and "Why does X happen?" formats outperform "X is true because Y." Questions create engagement loops that boost algorithmic distribution.',
    confidence: 'medium',
    actionable_guidance:
      'Include a question in 40-50% of posts. Use "Did you know" and "Why does" patterns. For replies: end with a follow-up question when natural.',
    applies_to: ['content_experiment', 'reply_generator'],
    evidence_sources: [
      { source: 'pre_seed', basis: 'Twitter engagement patterns', sample_size: 0 },
    ],
  },
  {
    question: 'Should we post more replies or more original content?',
    category: 'growth',
    answer:
      '[Pre-seeded] At 0-500 followers: 80-90% replies, 10-20% originals. Replies are how unknown accounts get discovered. Original posts from 0-follower accounts get near-zero organic reach. Replies on popular tweets are the only way to get in front of new audiences.',
    confidence: 'high',
    actionable_guidance:
      'Target 80% replies, 20% singles at bootstrap stage. Shift to 60/40 at 2K+ followers.',
    applies_to: ['strategy_learner', 'adaptive_strategy'],
    evidence_sources: [
      { source: 'pre_seed', basis: 'Consensus from Twitter growth experts', sample_size: 0 },
    ],
    stage_guidance: {
      bootstrap: '80-90% replies',
      early: '70% replies',
      growth: '60% replies',
      established: '50% replies',
    },
  },
  {
    question: 'What topics get the most follower conversions?',
    category: 'content',
    answer:
      '[Pre-seeded] Trending health angles (current news + health spin) convert best. Evergreen "health tips" get views but low follow-through. The formula is: timely topic + surprising health angle + "follow for more" implicit value proposition.',
    confidence: 'low',
    actionable_guidance:
      'Prioritize trending_topic + health_angle over evergreen health tips. News-driven content converts 2-3x better for discovery.',
    applies_to: ['content_experiment', 'trending_health_angler'],
    evidence_sources: [
      { source: 'pre_seed', basis: 'Health Twitter content analysis', sample_size: 0 },
    ],
  },
  {
    question: 'What opening hook patterns get the most engagement?',
    category: 'content',
    answer:
      '[Pre-seeded] Top patterns: (1) "Most people don\'t know..." (2) "The real reason X..." (3) "Here\'s what happens when..." (4) "Nobody talks about..." (5) "Unpopular opinion:". Avoid: starting with "I think", "In my opinion", generic statements. The hook must create curiosity or promise insider knowledge.',
    confidence: 'medium',
    actionable_guidance:
      'Open with curiosity hooks. Never start with "I" or generic statements. First 5 words must create intrigue.',
    applies_to: ['content_experiment', 'reply_generator'],
    evidence_sources: [
      { source: 'pre_seed', basis: 'Viral tweet analysis', sample_size: 0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// 2. external_patterns seeds
// ---------------------------------------------------------------------------
interface PatternSeed {
  pattern_type: string;
  combo_key: string;
  angle: string | null;
  tone: string | null;
  format: string | null;
  hour_bucket: string | null;
  topic: string | null;
  target_tier: string | null;
  ext_sample_count: number;
  combined_score: number;
  confidence: string;
  direction: string;
  our_stage: string;
  causal_status: string;
}

const patternSeeds: PatternSeed[] = [
  {
    pattern_type: 'reply',
    combo_key: 'reply|*|curious|short_take|morning',
    angle: null,
    tone: 'curious',
    format: 'short_take',
    hour_bucket: 'morning',
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.82,
    confidence: 'low',
    direction: 'do_more',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'reply',
    combo_key: 'reply|*|authoritative|long|*',
    angle: null,
    tone: 'authoritative',
    format: 'long',
    hour_bucket: null,
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.25,
    confidence: 'low',
    direction: 'do_less',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'tweet',
    combo_key: 'tweet|hot_take|curious|short_take|morning',
    angle: 'hot_take',
    tone: 'curious',
    format: 'short_take',
    hour_bucket: 'morning',
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.80,
    confidence: 'low',
    direction: 'do_more',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'tweet',
    combo_key: 'tweet|educational|authoritative|thread|*',
    angle: 'educational',
    tone: 'authoritative',
    format: 'thread',
    hour_bucket: null,
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.20,
    confidence: 'low',
    direction: 'do_less',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'tweet',
    combo_key: 'tweet|hot_take|contrarian|question|afternoon',
    angle: 'hot_take',
    tone: 'contrarian',
    format: 'question',
    hour_bucket: 'afternoon',
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.72,
    confidence: 'low',
    direction: 'do_more',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'reply',
    combo_key: 'reply|myth_bust|curious|one_liner|*',
    angle: 'myth_bust',
    tone: 'curious',
    format: 'one_liner',
    hour_bucket: null,
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.85,
    confidence: 'low',
    direction: 'do_more',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'tweet',
    combo_key: 'tweet|news_report|urgent|short_take|*',
    angle: 'news_report',
    tone: 'urgent',
    format: 'short_take',
    hour_bucket: null,
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.70,
    confidence: 'low',
    direction: 'do_more',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'reply',
    combo_key: 'reply|*|empathetic|long|*',
    angle: null,
    tone: 'empathetic',
    format: 'long',
    hour_bucket: null,
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.30,
    confidence: 'low',
    direction: 'do_less',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'reply',
    combo_key: 'reply|*|curious|question|evening',
    angle: null,
    tone: 'curious',
    format: 'question',
    hour_bucket: 'evening',
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.78,
    confidence: 'low',
    direction: 'do_more',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'tweet',
    combo_key: 'tweet|myth_bust|contrarian|short_take|morning',
    angle: 'myth_bust',
    tone: 'contrarian',
    format: 'short_take',
    hour_bucket: 'morning',
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.83,
    confidence: 'low',
    direction: 'do_more',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'reply',
    combo_key: 'reply|data_point|curious|short_take|*',
    angle: 'data_point',
    tone: 'curious',
    format: 'short_take',
    hour_bucket: null,
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.79,
    confidence: 'low',
    direction: 'do_more',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'tweet',
    combo_key: 'tweet|*|generic|long|late_night',
    angle: null,
    tone: 'generic',
    format: 'long',
    hour_bucket: 'late_night',
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.15,
    confidence: 'low',
    direction: 'do_less',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'reply',
    combo_key: 'reply|*|curious|short_take|*|10k_100k',
    angle: null,
    tone: 'curious',
    format: 'short_take',
    hour_bucket: null,
    topic: null,
    target_tier: '10k_100k',
    ext_sample_count: 0,
    combined_score: 0.84,
    confidence: 'low',
    direction: 'do_more',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'reply',
    combo_key: 'reply|*|*|*|*|500k_plus',
    angle: null,
    tone: null,
    format: null,
    hour_bucket: null,
    topic: null,
    target_tier: '500k_plus',
    ext_sample_count: 0,
    combined_score: 0.22,
    confidence: 'low',
    direction: 'do_less',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
  {
    pattern_type: 'tweet',
    combo_key: 'tweet|question|curious|question|morning',
    angle: 'question',
    tone: 'curious',
    format: 'question',
    hour_bucket: 'morning',
    topic: null,
    target_tier: null,
    ext_sample_count: 0,
    combined_score: 0.77,
    confidence: 'low',
    direction: 'do_more',
    our_stage: 'bootstrap',
    causal_status: 'pre_seeded',
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Seed External Intelligence ===\n');

  const sb = getSupabaseClient();

  // --- Seed growth_knowledge ---
  console.log(`Seeding ${knowledgeSeeds.length} growth_knowledge entries...`);

  const knowledgeRows = knowledgeSeeds.map((s) => ({
    question: s.question,
    category: s.category,
    answer: s.answer,
    confidence: s.confidence,
    actionable_guidance: s.actionable_guidance ?? null,
    applies_to: s.applies_to ?? null,
    evidence_sources: s.evidence_sources ?? [],
    stage_guidance: (s as any).stage_guidance ?? null,
    version: 1,
    last_evidence_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data: kData, error: kError } = await sb
    .from('growth_knowledge')
    .upsert(knowledgeRows, { onConflict: 'question' })
    .select('id, question');

  if (kError) {
    console.error('  ERROR seeding growth_knowledge:', kError.message);
  } else {
    console.log(`  OK: upserted ${kData?.length ?? 0} growth_knowledge rows`);
    for (const row of kData ?? []) {
      console.log(`    - ${row.question.substring(0, 60)}...`);
    }
  }

  // --- Seed external_patterns ---
  console.log(`\nSeeding ${patternSeeds.length} external_patterns entries...`);

  const patternRows = patternSeeds.map((p) => ({
    pattern_type: p.pattern_type,
    combo_key: p.combo_key,
    angle: p.angle,
    tone: p.tone,
    format: p.format,
    hour_bucket: p.hour_bucket,
    topic: p.topic,
    target_tier: p.target_tier,
    ext_sample_count: p.ext_sample_count,
    combined_score: p.combined_score,
    confidence: p.confidence,
    direction: p.direction,
    our_stage: p.our_stage,
    causal_status: p.causal_status,
    last_updated_at: new Date().toISOString(),
    update_count: 1,
  }));

  const { data: pData, error: pError } = await sb
    .from('external_patterns')
    .upsert(patternRows, { onConflict: 'combo_key' })
    .select('id, combo_key, combined_score, direction');

  if (pError) {
    console.error('  ERROR seeding external_patterns:', pError.message);
  } else {
    console.log(`  OK: upserted ${pData?.length ?? 0} external_patterns rows`);
    for (const row of pData ?? []) {
      const icon = row.direction === 'do_more' ? '+' : '-';
      console.log(`    [${icon}] ${row.combo_key}  (score=${row.combined_score})`);
    }
  }

  // --- Summary ---
  console.log('\n=== Summary ===');
  console.log(`  growth_knowledge: ${kError ? 'FAILED' : `${kData?.length ?? 0} seeded`}`);
  console.log(`  external_patterns: ${pError ? 'FAILED' : `${pData?.length ?? 0} seeded`}`);
  console.log('\nDone.');

  process.exit(kError || pError ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
