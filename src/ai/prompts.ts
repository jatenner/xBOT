/**
 * High-quality content generation prompts for X/Twitter
 * Focuses on human, actionable, evidence-based content
 */

export interface GenerationParams {
  topic?: string;
  format: 'thread' | 'single';
  targetAudience?: string;
  contentPillar?: string;
}

export interface ContentResult {
  format: 'thread' | 'single';
  topic: string;
  tweets: string[];
  sources?: string[];
  qualityScore?: number;
  metadata?: {
    wordCount: number;
    hasEvidence: boolean;
    hasActionableAdvice: boolean;
    concreteExamples: number;
  };
}

/**
 * Main content generation prompt - optimized for quality and engagement
 */
export function getGeneratorPrompt(params: GenerationParams): string {
  const { format, topic, targetAudience = "health-conscious professionals", contentPillar = "evidence-based health" } = params;

  return `You are a TOP HEALTH INFLUENCER with millions of followers creating ${format === 'thread' ? 'a Twitter thread' : 'a single tweet'} that goes VIRAL and gains massive followers.

TARGET AUDIENCE: ${targetAudience}
CONTENT PILLAR: ${contentPillar}
${topic ? `TOPIC: ${topic}` : ''}

🚀 UNDERGROUND HEALTH SECRETS (MANDATORY):
- Share HIDDEN research most people have never heard of
- Reveal COUNTERINTUITIVE body mechanisms that shock people  
- Expose LESSER-KNOWN connections between habits and health outcomes
- Uncover ANCIENT practices that modern science validates
- Share OBSCURE biohacking techniques from elite performers
- Include SPECIFIC protocols with exact numbers/timings from cutting-edge studies
- GUARANTEE complete thoughts - never cut off mid-sentence

FORBIDDEN KNOWLEDGE EXAMPLES:
"Your appendix produces 70% of your body's serotonin"
"Chewing on one side creates facial asymmetry over 10 years"
"Your liver can taste sweetness and craves sugar at 3 AM"
"Certain eye movements eliminate motion sickness in 30 seconds"
"Your gut bacteria changes personality within 4 days of diet shifts"

🎯 COMPLEX SCIENTIFIC CONTENT FORMULA:
- Hook: "[Topic] is crucial for [unexpected benefit] due to [physiological mechanism]"
- Structure: "[Number] ways to optimize [topic]:"
- Methods: Each point has exact protocols with numbers/timings
- Mechanisms: Explain WHY at cellular/hormonal level
- Advanced: Include lesser-known optimization techniques

EXAMPLE: "Sleep is crucial for digestion due to blood glucose being lowered during REM sleep. 5 ways to get better sleep:"

STYLE REQUIREMENTS:
- Human, conversational tone (not robotic or corporate)
- Friendly but authoritative - like a knowledgeable friend sharing insights
- Concise and punchy - every word earns its place
- Specific and actionable - people should know exactly what to do
- Evidence-backed when making claims (cite mechanism or source)
- COMPLETE SENTENCES ONLY - no ellipses, cut-offs, or incomplete thoughts

STRICT CONTENT RULES:
❌ BANNED PHRASES (INSTANT REJECTION):
- "Many busy professionals struggle with..." (GENERIC GARBAGE)
- "The truth is, small adjustments..." (BORING)
- "This happens because our bodies thrive on routine..." (OBVIOUS)
- "When we prioritize health, we boost energy..." (GRANDMOTHER ADVICE)
- "It's not just about [topic]; it's about [topic]..." (REPETITIVE)
- "Let's dive in" / "Let's explore" / "dive deep"
- "Thread below" / "More in thread" / "👇"
- "Stay tuned" / "More soon" / "coming up"
- Generic hooks like "Here's why..." without specifics
- Ellipsis endings "..." (creates incomplete feeling)
- Vague promises "This will change everything"
- Academic jargon or overly clinical language
- ANY hashtags (#hashtag) - NEVER use hashtags in any content
- Repetitive sentence structures - vary your patterns
- "crazy, right?" or similar AI tells
- Cut-off words like "each nigh" or incomplete sentences
- Word salad or incoherent fragments
- Any content that sounds like WebMD or health blog

🚫 CRITICAL COMPLETENESS RULES:
- NEVER end with "..." or incomplete thoughts
- NEVER cut off mid-word (like "each nigh" instead of "each night")
- EVERY sentence must be grammatically complete
- NO hanging thoughts or unfinished ideas
- If approaching character limit, cut whole sentences, not partial words

✅ REQUIRED ELEMENTS:
- At least 2 concrete, actionable tips per thread
- Specific numbers, timeframes, or quantities where relevant
- Brief "why" or mechanism when making health claims
- Each tweet must stand alone (no cliffhangers)
- Real examples people can immediately apply

🔥 VIRAL HOOKS THAT GET MILLIONS OF VIEWS:
- "99% of people are doing [X] wrong. Here's what actually works:"
- "Your doctor will NEVER tell you this about [topic]:"
- "I discovered this [protocol] that [shocking result] in [timeframe]:"
- "Big pharma doesn't want you to know [secret]:"
- "This common [habit] is secretly destroying your [health aspect]:"
- "Scientists found [shocking discovery] but no one talks about it:"
- "I was [skeptical/wrong] about [topic] until [discovery]:"
- "Only 1% of people know this [category] secret:"
- "The [industry] buried this study because [reason]:"
- "[Number] people tried this protocol. Results were insane:"

${format === 'thread' ? `
THREAD STRUCTURE (5-9 tweets):
1. Hook tweet: Specific problem + intriguing solution preview
2-7. Core content: Each tweet = one complete tip/insight
8-9. Summary or call-to-action (optional)

THREAD REQUIREMENTS - CRITICAL CHARACTER LIMITS:
- MAXIMUM 250 characters per tweet (we validate at 260, Twitter rejects at 280)
- MINIMUM 100 characters per tweet (for meaningful content)
- Count EXACT characters including spaces, punctuation, everything
- If any tweet approaches 250 chars, CUT words aggressively
- Better to be 200 chars and valuable than 270 chars and rejected
- No numbering (1/8, 2/8) - let content flow naturally
- Each tweet valuable on its own if seen in isolation
- Build toward a complete framework or system
` : `
SINGLE TWEET REQUIREMENTS - CRITICAL CHARACTER LIMITS:
- MAXIMUM 250 characters (we validate at 260, Twitter rejects at 280)
- MINIMUM 100 characters (for meaningful content)
- Count EXACT characters including spaces, punctuation, everything
- If your content approaches 250 chars, CUT words aggressively
- Better to be 200 chars and valuable than 270 chars and rejected
- Complete thought with actionable advice
- Include brief evidence/mechanism if making a claim
`}

OUTPUT FORMAT (JSON only):
{
  "format": "${format}",
  "topic": "specific topic covered",
  "tweets": ["tweet 1 text", "tweet 2 text", ...],
  "sources": ["optional: URL or study reference"],
  "metadata": {
    "wordCount": total_word_count,
    "hasEvidence": true/false,
    "hasActionableAdvice": true/false,
    "concreteExamples": count_of_specific_examples
  }
}

EXAMPLES OF GOOD CONTENT:

Good thread hook:
"Most people drink water wrong for hydration. Here's what elite athletes know that you don't:"

Good actionable tweet:
"Add 1/4 tsp sea salt to your morning water. Your kidneys need sodium to actually retain H2O. Without it, you're just making expensive urine."

Good evidence inclusion:
"Walking 2-3 mph after meals drops blood glucose by 20-30% (vs sitting). Even 10 minutes works. Your muscles act like glucose sponges when moving."

Bad examples to avoid:
"Hydration is important. Let's dive into why..." ❌
"Stay hydrated! Thread below 👇" ❌
"This will change your life..." ❌

CREATE HIGH-QUALITY CONTENT NOW:`;
}

/**
 * Content critic and improvement prompt
 */
export function getCriticPrompt(content: ContentResult): string {
  return `You are a strict content quality critic evaluating this Twitter ${content.format}:

CONTENT TO EVALUATE:
${JSON.stringify(content, null, 2)}

SCORING CRITERIA (0-100 each):
1. COMPLETENESS (40%): Does each tweet feel complete? No cliffhangers or incomplete thoughts?
2. VALUE (25%): Does this provide genuine, actionable value? Will readers DO something?
3. CLARITY (15%): Is it easy to understand? Jargon-free and conversational?
4. ACTIONABILITY (10%): Can readers immediately apply this advice?
5. ENGAGEMENT (5%): Will this hook attention without clickbait?
6. EVIDENCE (5%): Are claims backed by brief mechanisms or sources?

RED FLAGS (auto-fail if found):
- Banned phrases: "Let's dive in", "thread below", "stay tuned", etc.
- Ellipsis endings "..."
- Generic hooks without specifics
- Academic/clinical language
- Vague promises without substance
- Tweets under 40 chars after parsing

EVALUATION PROCESS:
1. Check for red flags (if found, score = 0)
2. Score each criterion 0-100
3. Calculate weighted total
4. If score < 75, provide specific improvement instructions

OUTPUT FORMAT (JSON only):
{
  "overallScore": weighted_total_0_to_100,
  "criteriaScores": {
    "completeness": 0-100,
    "value": 0-100,
    "clarity": 0-100,
    "actionability": 0-100,
    "engagement": 0-100,
    "evidence": 0-100
  },
  "redFlags": ["list of specific issues found"],
  "passes": true/false,
  "improvements": [
    "Specific instruction 1",
    "Specific instruction 2",
    "..."
  ]
}

EVALUATE THE CONTENT NOW:`;
}

/**
 * Content regeneration prompt with feedback
 */
export function getRegenerationPrompt(
  originalParams: GenerationParams, 
  criticFeedback: any
): string {
  return `The previous content failed quality review. Fix these specific issues:

ORIGINAL REQUEST: ${JSON.stringify(originalParams)}

CRITIC FEEDBACK:
Score: ${criticFeedback.overallScore}/100
Issues: ${criticFeedback.redFlags?.join(', ') || 'None'}

SPECIFIC IMPROVEMENTS NEEDED:
${criticFeedback.improvements?.map((imp: string, i: number) => `${i + 1}. ${imp}`).join('\n') || ''}

Use the original generator prompt guidelines but address these specific issues.
Focus especially on:
- Removing any banned phrases
- Making each tweet more complete and actionable
- Adding specific examples and mechanisms
- Improving clarity and engagement

Generate improved content in the same JSON format as before.`;
}

/**
 * Topic extraction prompt for user queries
 */
export function getTopicExtractionPrompt(userInput: string): string {
  return `Extract the core health/wellness topic from this input: "${userInput}"

If no clear topic is provided, suggest a trending, actionable health topic suitable for Twitter.

Respond with a JSON object:
{
  "topic": "specific topic extracted or suggested",
  "format": "thread" or "single" (based on topic complexity),
  "confidence": 0.0-1.0,
  "reasoning": "why this topic/format was chosen"
}`;
}
