// src/prompts/healthContentTemplates.ts - Health-First Content Generation Templates
export interface PromptContext {
  topic: string;
  context?: string;
  target_audience?: string;
  format?: string;
  length?: number;
  angle?: string;
  reply_mode?: string;
  original_tweet?: string;
  health_context?: string;
}

export interface RegretCheckResult {
  pass: boolean;
  confidence: number;
  non_trivial_insight: boolean;
  mechanism_or_consensus: boolean;
  no_hallucinated_facts: boolean;
  helpful_tone: boolean;
  suggested_edits?: string[];
  factual_accuracy_confidence: number;
  regret_risk: 'low' | 'medium' | 'high';
}

export class HealthContentTemplates {
  
  /**
   * Single Post Template - Health-First Content
   */
  static generateSinglePostPrompt(context: PromptContext): string {
    return `Role: Health content expert writing for Twitter/X growth
Task: Create a single tweet (≤279 chars) about ${context.topic}

Requirements:
- Provide non-trivial health insight with mechanism or evidence
- Be helpful, crisp, and human (no robotic tone)
- Include actionable takeaway if possible
- Cite source class when making claims (research/guideline/consensus)
- No hashtags unless essential; minimal emojis
- Focus on practical health benefits people can use immediately

Topic: ${context.topic}
Context: ${context.context || 'General health education'}
Target audience: ${context.target_audience || 'Health-conscious individuals seeking practical insights'}

Health Focus Areas:
- Explain WHY something works (mechanism)
- Provide specific, actionable steps
- Reference credible sources (studies, medical guidelines, expert consensus)
- Address common misconceptions
- Offer practical implementation tips

Tone: Authoritative but approachable, evidence-based but not academic
Style: Scannable, direct, immediately useful

Output format: Single tweet text only, no quotes or formatting`;
  }

  /**
   * Thread Composer Template
   */
  static generateThreadPrompt(context: PromptContext): string {
    const length = context.length || 6;
    
    return `Role: Health educator creating engaging Twitter threads
Task: Write a ${length}-tweet thread about ${context.topic}

Thread Structure:
1. Hook: Problem/curiosity that draws attention (why this matters for health)
2. Body: Mechanism/steps/examples with substance (${length - 2} tweets)
3. Close: Clear takeaway or actionable summary

Requirements for each tweet:
- Maximum 279 characters per tweet
- Progressive disclosure (build complexity thoughtfully)
- Include mechanisms behind health claims
- Cite evidence level (research/guideline/expert consensus)
- Scannable format with logical flow
- No hashtags; minimal emojis
- Each tweet should be valuable standalone but better together

Topic: ${context.topic}
Length: ${length} tweets
Angle: ${context.angle || 'Practical health optimization'}

Health Thread Guidelines:
- Start with relatable health problem or surprising insight
- Explain the biological/physiological mechanism
- Provide step-by-step implementation
- Address common obstacles or misconceptions
- End with specific next actions

Tone: Educational but engaging, evidence-based but accessible
Evidence Standards: Prefer peer-reviewed research, medical guidelines, or strong expert consensus

Output format: Numbered tweets (1/${length}, 2/${length}, etc.) with clear progression`;
  }

  /**
   * Reply Generator Template
   */
  static generateReplyPrompt(context: PromptContext): string {
    return `Role: Helpful health expert replying to Twitter discussions
Task: Write a valuable reply to: "${context.original_tweet}"

Reply Types:
- Explanation (40%): Clarify mechanisms or provide context
- Actionable (30%): Offer practical steps or tips
- Clarification (20%): Address misconceptions with evidence
- Contrarian (10%): Present alternative view with sources

Requirements:
- Always additive, never dismissive
- Include evidence or reasoning when making health claims
- Maximum 279 characters
- Match thread tone while adding genuine value
- No hashtags; help advance the conversation
- Cite source quality when relevant (study/guideline/expert opinion)

Original tweet: ${context.original_tweet}
Reply mode: ${context.reply_mode || 'explanation'}
Health angle: ${context.health_context || 'Evidence-based health insight'}

Health Reply Guidelines:
- Correct misinformation gently with better information
- Add missing context that improves understanding
- Provide specific, actionable health tips
- Reference credible sources when making claims
- Ask thoughtful follow-up questions to deepen discussion

Tone: Helpful, knowledgeable, respectful
Evidence Standard: Only cite claims you can reasonably support

Output format: Reply text only, designed to add value to the conversation`;
  }

  /**
   * Regret Checker Template
   */
  static generateRegretCheckPrompt(content: string): string {
    return `Role: Content quality auditor for health-focused social media
Task: Evaluate if this content meets quality standards for health education

Content to check: "${content}"

Evaluation Criteria (Rate each as Pass/Fail):
1. Non-trivial insight: Does this provide genuine value beyond obvious advice?
   - Avoid: "Drink water for hydration" 
   - Prefer: "Drinking water 30 minutes before meals can reduce caloric intake by 13%"

2. Mechanism or consensus: Are health claims supported by evidence/reasoning?
   - Look for: biological mechanisms, research citations, expert consensus
   - Flag: unsupported claims, personal anecdotes as universal advice

3. No hallucinated facts: Are all specific claims verifiable?
   - Check: statistics, research findings, medical recommendations
   - Flag: made-up numbers, misattributed studies, outdated guidelines

4. Helpful tone: Is this crisp, human, and genuinely useful?
   - Prefer: actionable, specific, empowering
   - Avoid: preachy, obvious, fear-mongering

Additional Assessment:
- Confidence level in health claims (0-1 scale)
- Potential for regret/backlash (low/medium/high)
- Factual accuracy confidence (0-1 scale)
- Could this mislead someone about their health?

If any major criteria fail or confidence <0.9, suggest:
- Reframe as question ("Could X help with Y?")
- Add qualifying language ("research suggests", "may help")
- Include source attribution ("according to the Mayo Clinic")
- Soften absolute claims ("often helps" vs "always works")

Output format: JSON with the following structure:
{
  "pass": boolean,
  "confidence": number,
  "non_trivial_insight": boolean,
  "mechanism_or_consensus": boolean,
  "no_hallucinated_facts": boolean,
  "helpful_tone": boolean,
  "suggested_edits": ["edit1", "edit2"],
  "factual_accuracy_confidence": number,
  "regret_risk": "low|medium|high"
}`;
  }

  /**
   * Topic Trend Analyzer Template
   */
  static generateTrendAnalysisPrompt(trends: string[]): string {
    return `Role: Health content strategist analyzing trending topics
Task: Identify health-relevant opportunities from current trends

Current trends: ${trends.join(', ')}

Analysis Framework:
1. Health Relevance: Which trends have genuine health implications?
2. Educational Opportunity: What misconceptions could we address?
3. Actionable Insights: What practical advice could we provide?
4. Evidence Base: What claims can we support with research?

Quality Gates:
- Must provide non-obvious health insight
- Must be supported by credible evidence
- Must offer actionable takeaways
- Must avoid political or controversial angles unless directly health-related

For each relevant trend, provide:
- Health angle (how it connects to wellbeing)
- Key insight (non-obvious connection or mechanism)
- Actionable advice (what people can do)
- Evidence level (research/guideline/expert opinion)
- Content format recommendation (single/thread/reply opportunity)

Output format: JSON array of health-relevant trend opportunities with rationale`;
  }

  /**
   * Quality Enhancement Template
   */
  static generateQualityEnhancementPrompt(content: string, issues: string[]): string {
    return `Role: Health content editor improving social media posts
Task: Enhance this content to meet quality standards

Original content: "${content}"
Issues identified: ${issues.join(', ')}

Enhancement Guidelines:
1. Add evidence/mechanisms when missing
2. Qualify uncertain claims appropriately
3. Make insights more specific and actionable
4. Improve tone to be more helpful and human
5. Add source attribution when appropriate

Health Content Standards:
- Include "why" (biological mechanism) when possible
- Specify "how" (implementation steps) clearly
- Reference "source" (research/guideline/expert) when making claims
- Address "who" (target population) if relevant

Style Requirements:
- Maximum 279 characters for single tweets
- No hashtags unless essential
- Minimal emojis
- Scannable and direct
- Immediately useful

Output format: Enhanced content that addresses all identified issues while maintaining the original intent`;
  }
}

// Helper functions for prompt generation
export function selectReplyMode(originalTweet: string): string {
  const tweet = originalTweet.toLowerCase();
  
  if (tweet.includes('why') || tweet.includes('how') || tweet.includes('?')) {
    return 'explanation';
  }
  
  if (tweet.includes('help') || tweet.includes('advice') || tweet.includes('tips')) {
    return 'actionable';
  }
  
  if (tweet.includes('wrong') || tweet.includes('myth') || tweet.includes('false')) {
    return 'clarification';
  }
  
  return 'explanation'; // default
}

export function extractHealthContext(content: string): string {
  const healthKeywords = {
    'nutrition': ['eat', 'food', 'diet', 'nutrition', 'meal', 'calories'],
    'exercise': ['workout', 'exercise', 'training', 'fitness', 'gym', 'cardio'],
    'sleep': ['sleep', 'rest', 'tired', 'insomnia', 'melatonin', 'bed'],
    'stress': ['stress', 'anxiety', 'mental', 'pressure', 'overwhelmed'],
    'recovery': ['recovery', 'healing', 'inflammation', 'pain', 'injury']
  };
  
  const contentLower = content.toLowerCase();
  
  for (const [category, keywords] of Object.entries(healthKeywords)) {
    if (keywords.some(keyword => contentLower.includes(keyword))) {
      return category;
    }
  }
  
  return 'general_health';
}

export function generatePromptContext(
  topic: string,
  format: 'single' | 'thread' | 'reply',
  options: Partial<PromptContext> = {}
): PromptContext {
  return {
    topic,
    format,
    target_audience: 'Health-conscious individuals seeking evidence-based insights',
    ...options
  };
}
