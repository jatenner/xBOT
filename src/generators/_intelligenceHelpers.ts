/**
 * INTELLIGENCE HELPERS
 * Shared helper for building intelligence context across all generators
 */

import { IntelligencePackage } from '../intelligence/intelligenceTypes';

export function buildIntelligenceContext(intelligence?: IntelligencePackage): string {
  if (!intelligence) return '';
  
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
- If same general topic area, find completely new angle/mechanism/application` : ''}

⚠️ REMINDER: Use this intelligence BUT maintain third-person expert voice.
NO "we/us/our/I/me/my" - write as objective expert analysis.
NO emojis (max 2 if absolutely needed).
`;
}

