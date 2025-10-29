/**
 * INTELLIGENCE HELPERS
 * Shared helper for building intelligence context across all generators
 */

import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { PatternAnalyzer } from '../ai/patternAnalyzer';

const patternAnalyzer = new PatternAnalyzer();

export async function buildIntelligenceContext(intelligence?: IntelligencePackage): Promise<string> {
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
  
  return `
🧠 DEEP INTELLIGENCE GATHERED:

📚 RESEARCH INSIGHTS:
• Common Belief: ${intelligence.research.common_belief}
• Scientific Reality: ${intelligence.research.scientific_reality}
• Surprise Factor: ${intelligence.research.surprise_factor}
• Expert Insight: ${intelligence.research.expert_insight}
${intelligence.research.controversy ? `• Controversy: ${intelligence.research.controversy}` : ''}

💡 PERSPECTIVES (${intelligence.perspectives.length} unique angles):
${intelligence.perspectives.slice(0, 3).map(p => `• ${p.angle} (uniqueness: ${p.uniqueness_score}/10, controversy: ${p.controversy_level}/10)
  → Implication: ${p.implication}
  → Action Hook: ${p.action_hook}`).join('\n')}

📰 CONTEXT:
• Current Narrative: ${intelligence.context.current_narrative}
• Gaps: ${intelligence.context.gaps.join(', ')}
• Controversies: ${intelligence.context.controversies.join(', ')}
${intelligence.context.trending_angle ? `• Trending Angle: ${intelligence.context.trending_angle}` : ''}
${intelligence.recentPosts && intelligence.recentPosts.length > 0 ? `

🚫 AVOID REPETITION - Recently posted (last 10 posts):
${intelligence.recentPosts.slice(0, 5).map((post, i) => `${i + 1}. "${post.substring(0, 70)}..."`).join('\n')}

⚠️ YOUR POST MUST BE UNIQUE:
- Cover a DIFFERENT topic/subject than these recent posts
- Use a DIFFERENT angle/perspective  
- Provide insights NOT covered in recent posts
- Make it feel FRESH and NOVEL compared to what was just posted
- If same general topic area, find completely new angle/mechanism/application

🎨 CREATIVITY MANDATE:
- Invent NEW approaches every time - never repeat patterns
- Surprise people with unexpected presentation methods
- Experiment wildly within your generator's core purpose
- Use ANY structure that makes your point powerfully
- Create content that makes people think differently
- Vary your sentence rhythm and flow dramatically
- Make this post feel completely unique from recent ones
${patternFeedback}` : `

🎨 CREATIVITY MANDATE:
- Invent NEW approaches every time - never repeat patterns
- Surprise people with unexpected presentation methods
- Experiment wildly within your generator's core purpose
- Use ANY structure that makes your point powerfully
- Create content that makes people think differently
- Vary your sentence rhythm and flow dramatically
${patternFeedback}`}

⚠️ REMINDER: Use this intelligence BUT maintain third-person expert voice.
NO "we/us/our/I/me/my" - write as objective expert analysis.
NO emojis (max 2 if absolutely needed).
`;
}

