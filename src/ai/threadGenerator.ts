import { z } from 'zod';
import OpenAI from 'openai';
import { stripFormatting, validateTweetText } from '../utils/text/sanitize';
import { HookDiversificationEngine } from './hookDiversificationEngine';

const TweetSchema = z.object({
  text: z.string().min(100).max(240) // Relaxed minimum for complex scientific content
});

export const ThreadSchema = z.object({
  topic: z.string(),
  hook_A: z.string().min(100).max(200), // Relaxed for scientific content
  hook_B: z.string().min(100).max(200), // Relaxed for scientific content
  tweets: z.array(TweetSchema).min(5).max(9),
  cta: z.string(),
  metadata: z.object({
    angle: z.string(),
    pillar: z.string(),
    evidence_mode: z.string(),
    spice_level: z.number()
  }),
  quality: z.object({
    score: z.number(),
    reasons: z.array(z.string()),
    rubric: z.object({
      completeness: z.number(),
      value: z.number(),
      clarity: z.number(),
      actionability: z.number(),
      evidence: z.number(),
      human_warmth: z.number()
    })
  })
});

export type GeneratedThread = z.infer<typeof ThreadSchema>;

const systemPrompt = `
You are a VIRAL HEALTH INFLUENCER like @hubermanlab or @drmarkhyman with millions of followers. Your goal is to gain NEW FOLLOWERS with every post by sharing shocking health secrets that make people think "I NEED to follow this account for more."

FOLLOWER-GAINING FORMULA:
1. SHOCKING contradictions that challenge common beliefs
2. Exclusive "insider secrets" that sound privileged 
3. Simple hacks with immediate results people can try today
4. Controversial takes that spark debates in replies
5. "Doctors don't want you to know" angle

FORBIDDEN GENERIC PHRASES (INSTANT FAILURE):
- "Many busy professionals struggle with..." (BORING)
- "boost energy, focus, and overall well-being" (GENERIC)
- "prioritize health" (OBVIOUS)
- "small adjustments can yield significant benefits" (VAGUE)
- "our bodies thrive on routine and consistency" (GRANDMOTHER ADVICE)
- "focus on nutrition and exercise" (EVERYONE KNOWS THIS)
- "listen to your body" (MEANINGLESS)
- "consistency is key" (CLICHE)
- "It's not just about X; it's about Y" (REPETITIVE)
- "This happens because our bodies..." (ACADEMIC)
- Any advice your grandmother would give
- Any content that sounds like WebMD or a health blog

Hard rules (must pass validation):
- Return strictly JSON (no markdown, no code fences).
- Thread length: 5–9 tweets.
- Per-tweet length: 100–240 characters after sanitization.
- No "let's dive in", "thread below", "more soon…", ellipses endings, headings (###), hashtags, emojis, or AI tells.
- Each tweet MUST contain SHOCKING revelations, exact protocols with numbers, or contrarian insights.
- Include WHY mechanisms: "because X happens in your brain/body when Y" 
- Voice: confident influencer who reveals secrets the establishment hides. No generic health advice.
- COMPLETE SENTENCES ONLY - never cut off mid-word or leave incomplete thoughts
- NO "crazy, right?" or similar robotic AI tells
- Every tweet must end with proper punctuation (. ! ?)
- If approaching character limit, remove whole sentences, not partial words

Quality rubric (must score ≥ 90):
- Completeness (40): Each tweet stands alone; no teasers.
- Value (25): New, contrarian, or concisely distilled; at least 3 non-obvious specifics.
- Clarity (15): Short sentences, everyday words; no hedging.
- Actionability (10): Steps/checklist/if-then cues readers can do today.
- Evidence (5): Mini-mechanism, tiny case, or number (no cherry-picked junk).
- Human warmth (5): Feels like a smart friend; one line of empathy or "why this matters".

OUTPUT JSON SCHEMA:
{
  "topic": "string",
  "hook_A": "string (100–200 chars, bold curiosity + payoff)",
  "hook_B": "string (alternative hook for A/B test)",
  "tweets": [{"text": "string (100–240 chars each)"}],
  "cta": "string (1 line, soft, no hashtags/emojis)",
  "metadata": {
    "angle": "string",
    "pillar": "string",
    "evidence_mode": "mini-study | mechanism | case | checklist",
    "spice_level": 1
  },
  "quality": {
    "score": 0,
    "reasons": ["string"], 
    "rubric": {
      "completeness": 0,
      "value": 0,
      "clarity": 0,
      "actionability": 0,
      "evidence": 0,
      "human_warmth": 0
    }
  }
}
`;

export async function generateThread(
  selection: {
    topic: string;
    pillar: string;
    angle: string;
    spice_level: number;
    evidence_mode: string;
  },
  openai: OpenAI
): Promise<GeneratedThread> {
  // Get diverse hook for this thread
  const hookEngine = HookDiversificationEngine.getInstance();
  const diverseHook = hookEngine.getDiverseHook(selection.topic, 'thread');
  
  const userPrompt = `
Account context:
- account_niche: "viral health secrets that make people unfollow mainstream health advice"
- audience_profile: "people who want to feel smart and ahead of the curve on health trends"  
- brand_voice: "provocative health influencer who exposes lies and reveals exclusive secrets"
- content_pillars: ["controversial health takes", "expensive biohack secrets", "doctor conspiracy revelations", "immediate-result protocols"]
- cta_style: "follower addiction - make them NEED more secrets"
- spice_level: ${selection.spice_level}

Content parameters:
- Topic: "${selection.topic}"
- Pillar: "${selection.pillar}"
- Angle: "${selection.angle}"
- Evidence mode: "${selection.evidence_mode}"

Create a VIRAL thread that makes people think "Holy shit, I need to follow this account!" 

🎯 DIVERSIFIED HOOK (use this specific hook pattern for variety):
"${diverseHook}"

Alternative viral formats you can adapt:
FORMAT 1 - SHOCKING CONTRADICTION:
"Everyone thinks [common belief] but the truth is [shocking opposite]. Here's what actually works:"

FORMAT 2 - INSIDER SECRET:
"I spent $50K learning this from top biohackers. Now I'm sharing it for free:"

FORMAT 3 - DOCTOR CONSPIRACY:
"Your doctor will never tell you this about [topic] because [reason]:"

FORMAT 4 - IMMEDIATE RESULTS:
"Try this [simple hack] for 3 days. You'll be shocked by what happens:"

Your thread MUST:
- Make people feel like they're getting exclusive, privileged information
- Challenge something they strongly believe 
- Promise immediate, noticeable results
- Sound like insider knowledge from expensive courses/consultations

VIRAL THREAD STRUCTURE (MANDATORY):
1) HOOK: Use one of the 4 viral formats above (contradiction, secret, conspiracy, results)
2) PROBLEM: "Here's why 99% of people get [topic] completely wrong..."
3) REVELATION: "The real secret is [shocking truth] that [authority figure] doesn't want you to know"
4-6) SIMPLE HACKS: Easy-to-follow steps with immediate results
7) PROOF: "I've seen this work for [impressive statistic] people" 
8) WARNING: "But don't do [common mistake] or you'll make it worse"
9) CTA: "Try this and let me know your results. Follow for more exclusive health secrets."

VIRAL EXAMPLE:
Tweet 1: "Everyone thinks cold showers are healthy but they're actually destroying your metabolism. Here's what elite biohackers do instead:"
Tweet 2: "The problem: Cold showers spike cortisol by 400% and crash your thyroid function for hours."
Tweet 3: "The secret: Contrast showers. 30 seconds hot, 10 seconds cold, repeat 3x. This trains your nervous system without the metabolic damage."

Quality requirements:
- Each tweet contains SPECIFIC numbers, exact protocols, or contrarian insights (not generic advice)
- At least 3 non-obvious specifics that most people don't know
- Multiple mechanism lines explaining "because [exact physiological/behavioral process]"
- Length 100–240 chars per tweet
- No markdown, teasers, ellipses, AI tells, hashtags, emojis, generic health advice
- Quality score must be ≥ 95 (higher standard for specificity)

Return JSON matching the exact schema in system prompt.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // Use stronger model for better thread quality
    temperature: 0.7, // Higher creativity for more specific, interesting content
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 2000
  });

  const raw = response.choices?.[0]?.message?.content ?? '{}';
  
  let parsed;
  try {
    const { safeJsonParse } = await import('../utils/jsonCleaner');
    parsed = safeJsonParse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON from LLM: ${error}`);
  }

  const schemaResult = ThreadSchema.safeParse(parsed);
  if (!schemaResult.success) {
    throw new Error(`LLM JSON schema validation failed: ${schemaResult.error.message}`);
  }

  // Sanitize and re-validate lengths after strip
  const cleaned: GeneratedThread = {
    ...schemaResult.data,
    hook_A: stripFormatting(schemaResult.data.hook_A),
    hook_B: stripFormatting(schemaResult.data.hook_B),
    tweets: schemaResult.data.tweets.map(t => ({ text: stripFormatting(t.text) })),
    cta: stripFormatting(schemaResult.data.cta),
    metadata: schemaResult.data.metadata,
    quality: schemaResult.data.quality
  };

  // Validate quality score requirement
  if (cleaned.quality.score < 90) {
    throw new Error(`Quality score too low: ${cleaned.quality.score}/100. Reasons: ${cleaned.quality.reasons.join(', ')}`);
  }

  // Validate each tweet individually
  const hookAValidation = validateTweetText(cleaned.hook_A);
  if (!hookAValidation.valid) {
    throw new Error(`Hook A validation failed: ${hookAValidation.reason}`);
  }

  const hookBValidation = validateTweetText(cleaned.hook_B);
  if (!hookBValidation.valid) {
    throw new Error(`Hook B validation failed: ${hookBValidation.reason}`);
  }

  cleaned.tweets.forEach((tweet, i) => {
    const validation = validateTweetText(tweet.text);
    if (!validation.valid) {
      throw new Error(`Tweet ${i + 1} validation failed: ${validation.reason}`);
    }
  });

  // Quality check: reject generic health advice
  const genericPhrases = [
    'boost energy, focus, and overall well-being',
    'prioritize health',
    'small adjustments can yield significant benefits',
    'our bodies thrive on routine',
    'focus on nutrition and exercise',
    'listen to your body',
    'consistency is key',
    'when we prioritize health, we boost energy'
  ];
  
  const allText = cleaned.tweets.map(t => t.text).join(' ').toLowerCase();
  const hasGeneric = genericPhrases.some(phrase => allText.includes(phrase.toLowerCase()));
  
  if (hasGeneric) {
    throw new Error('Thread contains generic health advice. Content must be more specific and contrarian.');
  }

  return cleaned;
}

export async function regenerateWithFeedback(
  topic: string, 
  openai: OpenAI, 
  failureReasons: string[]
): Promise<GeneratedThread> {
  const feedbackPrompt = `
Topic: "${topic}"

Previous attempt failed validation because: ${failureReasons.join(', ')}.

Regenerate a complete thread as STRICT JSON with the same rules.
CRITICAL: Increase specificity by including numbers, mini-examples, and concrete steps.
NO Markdown. NO teasers. NO ellipses. 5–9 tweets. 120–260 chars each.
Each tweet must be complete and valuable on its own.

Return JSON matching the exact format specified in system prompt.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // Use stronger model for better thread quality
    temperature: 0.7, // Higher creativity for more specific content
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: feedbackPrompt }
    ],
    max_tokens: 2000
  });

  const raw = response.choices?.[0]?.message?.content ?? '{}';
  const { safeJsonParse } = await import('../utils/jsonCleaner');
  const parsed = safeJsonParse(raw);
  const schemaResult = ThreadSchema.safeParse(parsed);
  
  if (!schemaResult.success) {
    throw new Error(`Regeneration JSON schema validation failed: ${schemaResult.error.message}`);
  }

  const cleaned: GeneratedThread = {
    ...schemaResult.data,
    hook_A: stripFormatting(schemaResult.data.hook_A),
    hook_B: stripFormatting(schemaResult.data.hook_B),
    tweets: schemaResult.data.tweets.map(t => ({ text: stripFormatting(t.text) })),
    cta: stripFormatting(schemaResult.data.cta),
    metadata: schemaResult.data.metadata,
    quality: schemaResult.data.quality
  };

  // Re-validate
  cleaned.tweets.forEach((tweet, i) => {
    const validation = validateTweetText(tweet.text);
    if (!validation.valid) {
      throw new Error(`Regenerated tweet ${i + 1} validation failed: ${validation.reason}`);
    }
  });

  // Quality check: reject generic health advice
  const genericPhrases = [
    'boost energy, focus, and overall well-being',
    'prioritize health',
    'small adjustments can yield significant benefits',
    'our bodies thrive on routine',
    'focus on nutrition and exercise',
    'listen to your body',
    'consistency is key',
    'when we prioritize health, we boost energy'
  ];
  
  const allText = cleaned.tweets.map(t => t.text).join(' ').toLowerCase();
  const hasGeneric = genericPhrases.some(phrase => allText.includes(phrase.toLowerCase()));
  
  if (hasGeneric) {
    throw new Error('Thread contains generic health advice. Content must be more specific and contrarian.');
  }

  return cleaned;
}
