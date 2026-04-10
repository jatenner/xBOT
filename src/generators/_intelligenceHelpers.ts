/**
 * INTELLIGENCE HELPERS
 * Shared helper for building intelligence context across all generators
 */

import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { PatternAnalyzer } from '../ai/patternAnalyzer';

// 🚀 GROWTH-BASED INTELLIGENCE TYPES
export interface MomentumSignal {
  value: string;
  trajectory: string;
  momentum: 'building' | 'stable' | 'fading';
  recommendation: string;
  confidence: number;
  firstAvg: number;
  secondAvg: number;
  growthRate: number;
}

export interface GrowthIntelligencePackage {
  // Growth trend signals
  growthTrend?: {
    trend: 'accelerating' | 'growing' | 'flat' | 'declining';
    weeklyGrowthRate: number; // % per week
    momentum: 'gaining' | 'stable' | 'losing';
    recommendation: string;
  };
  
  // Momentum signals
  momentumDimensions?: {
    topics: MomentumSignal[];
    formats: MomentumSignal[];
    generators: MomentumSignal[];
    visualFormats: MomentumSignal[];
  };
  
  // Ceiling awareness
  ceilingStatus?: {
    isSettling: boolean;
    currentCeiling: number;
    potentialCeiling: number;
    recommendation: string;
  };
  
  // Pattern discoveries
  discoveredPatterns?: {
    pattern: string;
    avgViews: number;
    sampleSize: number;
    recommendation: string;
  }[];
  
  // Exploration guidance
  explorationGuidance?: {
    rate: number; // 0.3-0.7
    reasoning: string;
  };
  
  // 🆕 Recent posts from this specific generator (avoid self-repetition)
  recentPosts?: string[];
  
  // 🆕 Performance insights from actual posted content (data-driven patterns)
  performanceInsights?: string[];
  
  // 🎨 Visual formatting intelligence (learned from high-performing posts - 200+ views)
  visualFormattingInsights?: string; // Learned formatting recommendations from successful posts

  // 🌐 External Twitter intelligence (from peer_posts via twitterInsightAggregator)
  externalInsights?: {
    topPerformingTopics: { topic: string; avgEngagement: number; postCount: number; exampleTweet: string }[];
    topPerformingHooks: { hookType: string; avgEngagement: number; count: number }[];
    viralExamples: { text: string; authorHandle: string; engagement: number; hookType: string; whyItWorks: string }[];
    trendShifts: string[];
  };

  // 📊 Behavioral intelligence (from external brain behavioral analyzer)
  behavioralInsights?: {
    optimalReplyStyle: string;
    provenHookPatterns: string[];
    contentMixGuidance: string;
    replyTimingGuidance: string;
    targetingGuidance: string;
  };
}

// Type alias for generators that accept growth intelligence
export type { GrowthIntelligencePackage as IntelligencePackage };

const patternAnalyzer = new PatternAnalyzer();

export async function buildIntelligenceContext(intelligence?: GrowthIntelligencePackage): Promise<string> {
  if (!intelligence) return '';
  
  // Get pattern feedback from entire database (last 30 days, or all if less data)
  let patternFeedback = '';
  try {
    const feedback = await patternAnalyzer.analyzeRecentPatterns(30);
    
    // Only show pattern feedback if there are issues with variety
    if (feedback.opening_patterns.variety_score < 60 || 
        feedback.structure_patterns.variety_score < 60 ||
        feedback.ending_patterns.variety_score < 60 ||
        feedback.sentence_patterns.length_variety < 60) {
      patternFeedback = `
📊 PATTERN ANALYSIS - Avoid These Overused Patterns:

${feedback.opening_patterns.recommendation}
${feedback.structure_patterns.recommendation}
${feedback.sentence_patterns.recommendation}
${feedback.ending_patterns.recommendation}

${feedback.creativity_instructions}
`;
    }
  } catch (error) {
    // Silently fail - pattern analysis is optional
    console.warn('Pattern analysis failed:', error);
  }
  
  // Build context based on what fields are available
  let contextString = '\n🧠 INTELLIGENCE CONTEXT:\n\n';
  
  // Growth trend intelligence (new format)
  if (intelligence.growthTrend) {
    contextString += `📊 GROWTH ANALYSIS:
• Trend: ${intelligence.growthTrend.trend} (${(intelligence.growthTrend.weeklyGrowthRate * 100).toFixed(1)}% per week)
• Momentum: ${intelligence.growthTrend.momentum}
• ${intelligence.growthTrend.recommendation}

`;
  }
  
  // Ceiling awareness (new format)
  if (intelligence.ceilingStatus) {
    contextString += `🚨 PERFORMANCE CEILING:
• Current best: ${intelligence.ceilingStatus.currentCeiling} views
• Potential: ${intelligence.ceilingStatus.potentialCeiling}+ views
${intelligence.ceilingStatus.isSettling ? `• ⚠️ SETTLING DETECTED - Try bold new approaches!` : '• ✅ Healthy variance - keep experimenting'}
• ${intelligence.ceilingStatus.recommendation}

`;
  }
  
  // Discovered patterns (new format)
  if (intelligence.discoveredPatterns && intelligence.discoveredPatterns.length > 0) {
    contextString += `📈 PATTERNS DISCOVERED:
${intelligence.discoveredPatterns.slice(0, 3).map(p => `• ${p.pattern}: ${Math.round(p.avgViews)} views avg (${p.sampleSize} posts)
  → ${p.recommendation}`).join('\n')}

`;
  }
  
  // Exploration guidance (new format)
  if (intelligence.explorationGuidance) {
    contextString += `🎲 EXPLORATION STRATEGY:
• Rate: ${(intelligence.explorationGuidance.rate * 100).toFixed(0)}% - ${intelligence.explorationGuidance.reasoning}

`;
  }
  
  // 🆕 Performance insights (data-driven patterns from actual results)
  if (intelligence.performanceInsights && intelligence.performanceInsights.length > 0) {
    contextString += `📊 PERFORMANCE INSIGHTS (From Your Actual Posted Content):
${intelligence.performanceInsights.map(insight => `• ${insight}`).join('\n')}

💡 USE THESE INSIGHTS:
- These are patterns discovered from your ACTUAL performance data
- Apply successful patterns intelligently - understand WHY they worked
- Don't copy blindly - adapt these insights to this new content
- Use this data to make better decisions, not as rigid rules

`;
    
    // 🆕 INTERESTING DEPTH INSIGHTS: Extract depth-related insights
    const depthInsights = intelligence.performanceInsights.filter((insight: string) => 
      insight.toLowerCase().includes('mechanism') || 
      insight.toLowerCase().includes('depth') || 
      insight.toLowerCase().includes('interesting')
    );
    
    if (depthInsights.length > 0) {
      contextString += `🔍 INTERESTING DEPTH PATTERNS (From Your Top Performers):
${depthInsights.map((insight: string) => `• ${insight}`).join('\n')}

💡 KEY TAKEAWAY: Deep content with mechanisms (HOW/WHY it works) performs better than shallow quotes.
- Add mechanisms to make content deep and interesting
- Include interesting details (numbers, comparisons, biological specifics)
- Make it INTERESTING, not educational/academic

`;
    }
  }
  
  // 🎨 Visual formatting intelligence (learned from HIGH-PERFORMING posts - 200+ views)
  if (intelligence.visualFormattingInsights) {
    contextString += `🎨 VISUAL FORMATTING INTELLIGENCE (Learned from High-Performing Posts - 200+ Views):
${intelligence.visualFormattingInsights}

🚀 CRITICAL: These are LEARNED patterns from your BEST posts (200+ views = aspirational targets).
- The system analyzed what Twitter's algorithm and audience REWARDED for formatting
- Apply these patterns to EXCEED your current best performance
- Don't just match current best - use these to get MORE views and followers
- These aren't hardcoded rules - they're what actually worked for high-performing content

`;
  }
  
  // 🌐 External Twitter insights (from peer accounts via twitterInsightAggregator)
  if (intelligence.externalInsights) {
    const ext = intelligence.externalInsights;
    contextString += `🌐 WHAT'S WORKING ON HEALTH TWITTER RIGHT NOW:\n\n`;

    if (ext.topPerformingTopics.length > 0) {
      contextString += `📊 TOP TOPICS (by engagement among health accounts):\n`;
      ext.topPerformingTopics.slice(0, 5).forEach((t, i) => {
        contextString += `  ${i + 1}. "${t.topic}" — ${(t.avgEngagement * 100).toFixed(1)}% normalized ER (${t.postCount} posts)\n`;
      });
      contextString += `\n`;
    }

    if (ext.topPerformingHooks.length > 0) {
      contextString += `🎣 TOP HOOKS:\n`;
      ext.topPerformingHooks.slice(0, 5).forEach((h, i) => {
        contextString += `  ${i + 1}. "${h.hookType}" — ${(h.avgEngagement * 100).toFixed(1)}% ER (${h.count} posts)\n`;
      });
      contextString += `\n`;
    }

    if (ext.viralExamples.length > 0) {
      contextString += `🔥 VIRAL EXAMPLES (study these patterns):\n`;
      ext.viralExamples.slice(0, 3).forEach((v, i) => {
        contextString += `  ${i + 1}. @${v.authorHandle}: "${v.text}"\n`;
        contextString += `     Hook: ${v.hookType} | ${v.whyItWorks}\n`;
      });
      contextString += `\n`;
    }

    if (ext.trendShifts.length > 0) {
      contextString += `💡 TREND SHIFTS:\n`;
      ext.trendShifts.forEach(s => {
        contextString += `  - ${s}\n`;
      });
      contextString += `\n`;
    }
  }

  // Behavioral intelligence
  if (intelligence.behavioralInsights) {
    const bi = intelligence.behavioralInsights;
    contextString += `📊 BEHAVIORAL INTELLIGENCE (proven from external account analysis):\n\n`;

    if (bi.optimalReplyStyle) {
      contextString += `  Reply style: ${bi.optimalReplyStyle}\n`;
    }
    if (bi.provenHookPatterns.length > 0) {
      contextString += `  Proven hooks: ${bi.provenHookPatterns.join(', ')}\n`;
    }
    if (bi.replyTimingGuidance) {
      contextString += `  Timing: ${bi.replyTimingGuidance}\n`;
    }
    if (bi.targetingGuidance) {
      contextString += `  Targeting: ${bi.targetingGuidance}\n`;
    }
    if (bi.contentMixGuidance) {
      contextString += `  Mix: ${bi.contentMixGuidance}\n`;
    }
    contextString += `\n`;
  }

  // Recent posts (avoid repetition)
  if (intelligence.recentPosts && intelligence.recentPosts.length > 0) {
    contextString += `

🚫 AVOID REPETITION - Your recent posts:
${intelligence.recentPosts.slice(0, 5).map((post, i) => `${i + 1}. "${post.substring(0, 100)}..."`).join('\n')}

⚠️ YOUR POST MUST BE UNIQUE:
- Cover a DIFFERENT topic/subject than these recent posts
- Use a DIFFERENT angle/perspective  
- Provide insights NOT covered in recent posts
- Make it feel FRESH and NOVEL compared to what was just posted
- If same general topic area, find completely new angle/mechanism/application

`;
  }
  
  // 🆕 RELATABLE LANGUAGE MANDATE (Fixes technical/boring content issue)
  contextString += `🎯 CRITICAL: RELATABLE LANGUAGE MANDATE
Even if the topic mentions a technical term (like "myostatin", "BDNF", "phosphatidylserine"), you MUST reframe it in relatable language:
- "Myostatin" → "The hormone that limits muscle growth" or "Why your body stops building muscle"
- "BDNF" → "Your brain's growth factor" or "The molecule that helps your brain grow"
- "Phosphatidylserine" → "A brain supplement" or "The compound that helps memory"
- "Cortisol dysregulation" → "Why your stress hormones are out of whack"
- "Mitochondrial function" → "Your cells' energy system"
- "HPA axis" → "Your stress response system"

ALWAYS ask: "Would a normal person (not a biohacker) understand and care about this?" If no, reframe it.
Make it FUN, RELATABLE, and INTERESTING - not like a biology textbook.
The topic might be technical, but your CONTENT should be accessible and engaging.

`;
  
  // 🆕 INTERESTING DEPTH REQUIREMENT (Catches shallow quotes)
  contextString += `🎯 INTERESTING DEPTH REQUIREMENT (MANDATORY):
Every tweet must explain HOW/WHY it works (mechanism) AND include interesting details.

REQUIRED:
- Mechanism explanation: HOW/WHY it works (via, because, works by, activates, triggers, etc.)
- Interesting details: Numbers, comparisons (vs/compared to), or biological specifics

EXAMPLES OF INTERESTING DEPTH:
✅ "Walking boosts creativity 60% via increased prefrontal cortex blood flow (15-20% increase) activating alpha brain waves (8-12Hz). Beta waves keep you rigid."
✅ "Cold showers work because you're training your nervous system to override panic. The cold is just the catalyst."
❌ "Walking boosts creativity 60%. It's good for you." (missing mechanism)
❌ "Myth: X. Truth: Y. It's smart." (shallow quote format)

The difference: DEEP content explains mechanisms and adds interesting details. SHALLOW content just states facts.

⚠️ IMPORTANT: Make it INTERESTING, not educational/academic. Use relatable language, not textbook terms.

`;
  
  // Creativity mandate
  contextString += `🎨 CREATIVITY MANDATE:
- Invent NEW approaches every time - never repeat patterns
- Surprise people with unexpected presentation methods
- Experiment wildly within your generator's core purpose
- Use ANY structure that makes your point powerfully
- Create content that makes people think differently
- Vary your sentence rhythm and flow dramatically
${patternFeedback}

⚠️ REMINDER: Maintain third-person expert voice.
NO "we/us/our/I/me/my" - write as objective expert.
NO emojis (max 1 if absolutely needed).
`;

  // ─── Brain v2: Phase-calibrated content guidance ───
  // External brain provides patterns proven at accounts OUR size.
  try {
    const { brainQuery } = await import('../brain/brainQuery');

    const gaps = await brainQuery.getContentGaps(3);
    if (gaps.length > 0) {
      contextString += `\n🧠 BRAIN: UNTESTED HIGH-POTENTIAL PATTERNS (proven at similar accounts but we haven't tried):\n`;
      for (const gap of gaps) {
        contextString += `• ${gap.dimension}: "${gap.value}" — ${(gap.potential_lift).toFixed(1)}x potential lift (${gap.confidence} confidence)\n`;
      }
      contextString += `Consider testing one of these in your next post.\n\n`;
    }

    const health = await brainQuery.getStrategyHealth();
    if (health && health.decaying.length > 0) {
      contextString += `⚠️ BRAIN: DECAYING STRATEGIES (used to work, performance dropping):\n`;
      for (const d of health.decaying.slice(0, 3)) {
        contextString += `• ${d.dimension}: "${d.strategy}" — 7d: ${d.effectiveness_7d.toFixed(1)} vs 30d: ${d.effectiveness_30d.toFixed(1)}\n`;
      }
      contextString += `Avoid these or try a fresh angle on them.\n\n`;
    }

    const trending = await brainQuery.getTrendingTopics(3);
    if (trending.length > 0) {
      contextString += `📈 BRAIN: TRENDING NOW:\n`;
      for (const t of trending) {
        contextString += `• "${t.keyword}" — ${t.tweet_count} tweets, avg ${Math.round(t.avg_engagement)} likes\n`;
      }
      contextString += `\n`;
    }
  } catch {
    // Brain enrichment is non-fatal
  }

  // ─── Growth Observatory: What growing accounts at our stage actually do ───
  try {
    const { brainQuery } = await import('../brain/brainQuery');

    const playbook = await brainQuery.getGrowthPlaybook();
    if (playbook.length > 0) {
      contextString += `\n🔭 GROWTH OBSERVATORY — What accounts at our stage do to grow:\n`;

      for (const strategy of playbook.slice(0, 3)) {
        const wp = strategy.winning_patterns || {};
        const diffs = strategy.key_differentiators || {};

        contextString += `\n📋 ${strategy.strategy_name} (${strategy.strategy_category})`;
        if (strategy.win_rate) contextString += ` — ${(strategy.win_rate * 100).toFixed(0)}% win rate`;
        if (strategy.sample_size) contextString += `, ${strategy.sample_size} accounts studied`;
        contextString += `:\n`;

        // Show winning patterns
        if (wp.reply_ratio) contextString += `  • Reply ratio: ${(wp.reply_ratio * 100).toFixed(0)}%\n`;
        if (wp.tweets_per_day) contextString += `  • Volume: ${wp.tweets_per_day} tweets/day\n`;
        if (wp.avg_word_count) contextString += `  • Length: ~${wp.avg_word_count} words/tweet\n`;
        if (wp.common_targets?.length) contextString += `  • Reply to: @${wp.common_targets.slice(0, 3).join(', @')}\n`;

        // Show key differentiators
        for (const [, diff] of Object.entries(diffs).slice(0, 2)) {
          contextString += `  • ${diff}\n`;
        }
      }
      contextString += `\n`;
    }

    // Show retrospective insights (real growth stories)
    const insights = await brainQuery.getRetrospectiveInsights();
    if (insights && insights.length > 0) {
      contextString += `🔭 REAL GROWTH STORIES from accounts at our stage:\n`;
      for (const r of insights.slice(0, 2)) {
        if (r.analysis_summary) {
          contextString += `  • @${r.username}: ${r.analysis_summary}\n`;
        }
      }
      contextString += `\n`;
    }

    // Show our experiment status
    const experiments = await brainQuery.getOurExperiments();
    if (experiments.active.length > 0) {
      contextString += `🧪 OUR ACTIVE EXPERIMENTS:\n`;
      for (const exp of experiments.active.slice(0, 2)) {
        contextString += `  • Testing "${exp.strategy_name}" (test #${exp.test_number}) — ${exp.verdict}\n`;
      }
      contextString += `\n`;
    }

    // Populate behavioral insights from external_patterns behavioral data
    try {
      const { getSupabaseClient } = await import('../db');
      const supabase = getSupabaseClient();

      const { data: behavioralPatterns } = await supabase
        .from('external_patterns')
        .select('pattern_type, combo_key, target_tier, hour_bucket, ext_avg_likes, ext_sample_count, direction, confidence')
        .in('pattern_type', ['reply_timing', 'reply_targeting', 'content_mix', 'reply_behavior'])
        .eq('direction', 'do_more')
        .order('ext_avg_likes', { ascending: false })
        .limit(10);

      if (behavioralPatterns && behavioralPatterns.length > 0) {
        const timing = behavioralPatterns.find(p => p.pattern_type === 'reply_timing');
        const targeting = behavioralPatterns.find(p => p.pattern_type === 'reply_targeting');
        const mix = behavioralPatterns.find(p => p.pattern_type === 'content_mix');

        if (intelligence) {
          intelligence.behavioralInsights = {
            optimalReplyStyle: targeting
              ? `Reply to accounts ${targeting.target_tier} your size for best engagement`
              : '',
            provenHookPatterns: [], // Populated from reply classification data as it accumulates
            contentMixGuidance: mix
              ? `Growing accounts at your range: ${Math.round((mix.ext_avg_engagement_rate ?? 0.7) * 100)}% replies, ${Math.round(mix.ext_avg_views ?? 20)}% originals, ${Math.round(mix.ext_avg_likes ?? 10)}% threads`
              : '',
            replyTimingGuidance: timing
              ? `Replies within ${timing.hour_bucket} get the most engagement (${timing.ext_sample_count} samples)`
              : '',
            targetingGuidance: targeting
              ? `Best target size: ${targeting.target_tier} your follower count (${targeting.ext_sample_count} samples, ${targeting.confidence} confidence)`
              : '',
          };
        }
      }
    } catch {
      // Behavioral enrichment is non-fatal
    }
  } catch {
    // Observatory enrichment is non-fatal
  }

  return contextString;
}

/**
 * 🚀 BUILD GROWTH INTELLIGENCE CONTEXT
 * Feed growth signals to AI (as insights, not commands!)
 */
export async function buildGrowthIntelligenceContext(intelligence?: GrowthIntelligencePackage): Promise<string> {
  if (!intelligence) return '';
  
  let context = '\n📊 GROWTH INTELLIGENCE:\n\n';
  
  // Growth trend
  if (intelligence.growthTrend) {
    context += `🎯 TREND: ${intelligence.growthTrend.trend}\n`;
    context += `   Growth: ${(intelligence.growthTrend.weeklyGrowthRate * 100).toFixed(1)}% per week\n`;
    context += `   Momentum: ${intelligence.growthTrend.momentum}\n`;
    context += `   ${intelligence.growthTrend.recommendation}\n\n`;
  }
  
  // Momentum signals
  if (intelligence.momentumDimensions?.topics && intelligence.momentumDimensions.topics.length > 0) {
    context += `🔥 MOMENTUM SIGNALS:\n`;
    intelligence.momentumDimensions.topics.slice(0, 3).forEach(t => {
      context += `   - ${t.value}: ${t.trajectory}\n`;
    });
    context += '\n';
  }
  
  // Discovered patterns
  if (intelligence.discoveredPatterns && intelligence.discoveredPatterns.length > 0) {
    context += `📈 PATTERNS DISCOVERED:\n`;
    intelligence.discoveredPatterns.slice(0, 2).forEach(p => {
      context += `   - ${p.pattern} (${p.avgViews.toFixed(0)} views avg)\n`;
      context += `     ${p.recommendation}\n`;
    });
    context += '\n';
  }
  
  // Ceiling awareness
  if (intelligence.ceilingStatus?.isSettling) {
    context += `⚠️ SETTLING DETECTED:\n`;
    context += `   Current: ${intelligence.ceilingStatus.currentCeiling} views\n`;
    context += `   Potential: ${intelligence.ceilingStatus.potentialCeiling}+ views\n`;
    context += `   ${intelligence.ceilingStatus.recommendation}\n\n`;
  }
  
  // Exploration guidance
  if (intelligence.explorationGuidance) {
    context += `🎲 EXPLORATION: ${(intelligence.explorationGuidance.rate * 100).toFixed(0)}% recommended\n`;
    context += `   ${intelligence.explorationGuidance.reasoning}\n\n`;
  }
  
  context += `💡 USE THESE SIGNALS:\n`;
  context += `- Make informed experiments based on these trends\n`;
  context += `- Don't limit yourself to what worked - discover what could work BETTER\n`;
  context += `- Apply successful patterns to NEW topics (not same topics)\n`;
  context += `- If settling detected, try COMPLETELY new approaches\n`;
  context += `- Always aim higher than current performance\n`;
  
  return context;
}

