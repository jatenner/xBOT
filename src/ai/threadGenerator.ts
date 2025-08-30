import { z } from 'zod';
import OpenAI from 'openai';
import { stripFormatting, validateTweetText } from '../utils/text/sanitize';

const TweetSchema = z.object({
  text: z.string().min(120).max(240)
});

export const ThreadSchema = z.object({
  topic: z.string(),
  hook_A: z.string().min(120).max(200),
  hook_B: z.string().min(120).max(200),
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
You are a growth writer for X (Twitter) focused on rapid audience building. Your job is to create threads that a discerning reader would bookmark and share. You never output filler, headings, or teasers. You always deliver complete, specific, human-sounding ideas.

Hard rules (must pass validation):
- Return strictly JSON (no markdown, no code fences).
- Thread length: 5–9 tweets.
- Per-tweet length: 120–240 characters after sanitization.
- No "let's dive in", "thread below", "more soon…", ellipses endings, headings (###), hashtags, emojis, or AI tells.
- Each tweet contains at least one concrete element: number, step, micro-example, heuristic, or comparison.
- If making a claim, add a brief why or mechanism (human-level reasoning).
- Voice: human, warm, concise. No corporate tone. No false personal claims; use brand "we" or neutral POV.

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
  "hook_A": "string (120–200 chars, bold curiosity + payoff)",
  "hook_B": "string (alternative hook for A/B test)",
  "tweets": [{"text": "string (120–240 chars each)"}],
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
  const userPrompt = `
Account context:
- account_niche: "health optimization for busy professionals"
- audience_profile: "time-poor 25–45, wants practical wins, skeptical of fluff"  
- brand_voice: "clear, calm, evidence-first, no hype"
- content_pillars: ["sleep", "nutrition", "habit design", "cognition"]
- cta_style: "soft"
- spice_level: ${selection.spice_level}

Content parameters:
- Topic: "${selection.topic}"
- Pillar: "${selection.pillar}"
- Angle: "${selection.angle}"
- Evidence mode: "${selection.evidence_mode}"

Create a thread that delivers specific, actionable value. Choose a single sharp promise for the reader (what they'll be able to do after reading). Include 5–9 concrete steps, numbers, heuristics, or micro-stories. Each tweet should stand alone.

Thread structure requirements:
1) Problem → 2) Mechanism (why) → 3–5) Steps (if X do Y) → 6) Quick win (today) → 7) Safeguard/pitfall → 8) Tiny case/number → 9) Recap + CTA

Quality requirements:
- Each tweet contains 1 concrete element: number, step, heuristic, or micro-example
- At least 2 non-obvious specifics per thread
- One mechanism line explaining "because [physiology/behavioral reason]"
- Length 120–240 chars per tweet
- No markdown, teasers, ellipses, AI tells, hashtags, emojis
- Quality score must be ≥ 90

Return JSON matching the exact schema in system prompt.
`;

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: Number(process.env.OPENAI_TEMPERATURE ?? 0.4),
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
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: Number(process.env.OPENAI_TEMPERATURE ?? 0.4),
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

  return cleaned;
}
