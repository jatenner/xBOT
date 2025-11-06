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

