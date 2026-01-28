/**
 * 🎯 REPLY STRATEGIES MODULE
 * Phase 6.4: Explicit multi-strategy reply variants for ε-greedy learning
 * 
 * Defines distinct reply strategies with unique prompt templates.
 * Each strategy is optimized for different engagement patterns in health/wellness Twitter.
 */

/**
 * Reply strategy definition
 */
export interface ReplyStrategy {
  strategy_id: string;
  strategy_version: string;
  description: string;
  promptTemplate: string;
}

/**
 * Available reply strategies
 * 
 * Each strategy targets a different engagement pattern:
 * - insight_punch: Authority + concise insight
 * - actionable_checklist: Practical steps/habits
 * - myth_correction: Polite misconception correction
 * - question_hook: Thoughtful question + insight
 */
export const REPLY_STRATEGIES: ReplyStrategy[] = [
  {
    strategy_id: 'insight_punch',
    strategy_version: '1',
    description: 'Concise, authoritative insight (1-2 sentences). Leads with a strong claim backed by mechanism/data.',
    promptTemplate: `YOUR REPLY MUST FOLLOW THIS STRATEGY: INSIGHT_PUNCH

CRITICAL REQUIREMENTS:
1. **LEAD WITH AUTHORITY**: First sentence makes a bold, specific claim
   - "The real issue is X..."
   - "What most people miss: X..."
   - "The mechanism here is X..."

2. **BACK IT UP**: Second sentence provides one concrete mechanism, stat, or mechanism
   - Not generic advice
   - Specific to their point
   - Actionable insight

3. **LENGTH**: 1-2 sentences max, 180-220 chars total

4. **TONE**: Confident but not arrogant, educational

HARD BANS:
- NO "Studies show" without naming the study
- NO generic "improves health" endings
- NO questions (save for question_hook strategy)
- NO thread markers (1/, 🧵, Part)

EXAMPLE STRUCTURE:
"The real issue is [specific mechanism]. [One concrete insight/data point that supports this]."`,
  },
  {
    strategy_id: 'actionable_checklist',
    strategy_version: '1',
    description: 'Practical steps or habits (bulleted or comma-separated). Focuses on actionable takeaways.',
    promptTemplate: `YOUR REPLY MUST FOLLOW THIS STRATEGY: ACTIONABLE_CHECKLIST

CRITICAL REQUIREMENTS:
1. **ECHO FIRST**: First sentence paraphrases their point
   - "You're right about X..."
   - "That point on X is spot on..."
   - "Makes sense — when you consider X..."

2. **PRACTICAL STEPS**: Provide 2-3 concrete, actionable steps
   - Use bullets (•) or commas
   - Each step is specific and measurable
   - Focus on habits, timing, or protocols

3. **LENGTH**: 2-3 sentences, 200-250 chars total

4. **TONE**: Helpful, practical, no-nonsense

HARD BANS:
- NO vague "try this" without specifics
- NO medical disclaimers
- NO generic "improves health" without mechanism
- NO thread markers

EXAMPLE STRUCTURE:
"You're right about [their point]. Try: [Step 1], [Step 2], [Step 3]."`,
  },
  {
    strategy_id: 'myth_correction',
    strategy_version: '1',
    description: 'Polite correction of a common misconception. Respectful tone, backed by mechanism.',
    promptTemplate: `YOUR REPLY MUST FOLLOW THIS STRATEGY: MYTH_CORRECTION

CRITICAL REQUIREMENTS:
1. **ACKNOWLEDGE FIRST**: Start by validating what they got right
   - "I see where you're coming from..."
   - "That's a common belief, but..."
   - "Partially true — here's the nuance..."

2. **POLITE CORRECTION**: One key correction with mechanism
   - Not condescending
   - Focus on mechanism, not just "you're wrong"
   - Provide the "why" behind the correction

3. **LENGTH**: 2-3 sentences, 200-250 chars total

4. **TONE**: Respectful, educational, not preachy

HARD BANS:
- NO "Actually..." or "Wrong..." openings
- NO condescending tone
- NO medical advice
- NO thread markers

EXAMPLE STRUCTURE:
"I see where you're coming from, but [nuance]. The mechanism is [explanation]."`,
  },
  {
    strategy_id: 'question_hook',
    strategy_version: '1',
    description: 'Thoughtful question + brief insight. Designed to drive engagement through curiosity.',
    promptTemplate: `YOUR REPLY MUST FOLLOW THIS STRATEGY: QUESTION_HOOK

CRITICAL REQUIREMENTS:
1. **THOUGHTFUL QUESTION**: Lead with a question that makes them think
   - "Have you noticed X?"
   - "What if the real issue is Y?"
   - "Ever wonder why Z happens?"

2. **BRIEF INSIGHT**: Follow with one concise insight or mechanism
   - Answers or partially answers the question
   - Provides value, not just curiosity bait
   - Specific to their point

3. **LENGTH**: 2 sentences, 200-250 chars total

4. **TONE**: Curious, engaging, thought-provoking

HARD BANS:
- NO generic "What do you think?" questions
- NO questions without insight
- NO clickbait-style hooks
- NO thread markers

EXAMPLE STRUCTURE:
"[Thoughtful question]? [Brief insight that answers or expands on the question]."`,
  },
];

/**
 * Get strategy by ID and version
 */
export function getStrategy(strategyId: string, strategyVersion: string = '1'): ReplyStrategy | null {
  return REPLY_STRATEGIES.find(
    s => s.strategy_id === strategyId && s.strategy_version === strategyVersion
  ) || null;
}

/**
 * Get default/baseline strategy
 */
export function getDefaultStrategy(): ReplyStrategy {
  return REPLY_STRATEGIES[0]; // insight_punch as default
}

/**
 * Get all available strategies
 */
export function getAllStrategies(): ReplyStrategy[] {
  return REPLY_STRATEGIES;
}

/**
 * Format strategy prompt for reply generation
 * 
 * Combines the strategy template with the existing reply context
 */
export function formatStrategyPrompt(
  strategy: ReplyStrategy,
  basePrompt: string
): string {
  return `${strategy.promptTemplate}

${basePrompt}`;
}
