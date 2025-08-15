import { z } from 'zod';
import OpenAI from 'openai';
import { stripFormatting, validateTweetText } from '../utils/text/sanitize';

const TweetSchema = z.object({
  text: z.string().min(120).max(260)
});

export const ThreadSchema = z.object({
  topic: z.string(),
  hook: z.string().min(60).max(200),
  tweets: z.array(TweetSchema).min(5).max(9)
});

export type GeneratedThread = z.infer<typeof ThreadSchema>;

const systemPrompt = `
You produce COMPLETE Twitter threads for a general audience interested in health, performance, habits, cognition.

CRITICAL RULES:
- Output STRICT JSON only, no markdown, no explanations
- Each tweet is self-contained with concrete tips/examples/numbers
- NO teasers, NO ellipses, NO "let's dive in", NO "more details coming"
- Style: clear, direct, specific. No fluff. No hashtags. No emojis. No sales.
- Length per tweet: 120–260 chars. End naturally (no punctuation spam).
- Include specific numbers, studies, or actionable steps in most tweets
- Make each tweet valuable on its own

VIRAL PATTERNS TO USE:
- "90% of people don't know..."
- "Study of 50,000 people found..."
- "This simple change increased X by 40%..."
- "The #1 mistake people make..."
- "I've been tracking this for 2 years..."

OUTPUT FORMAT (exact JSON):
{
  "topic": "brief topic description",
  "hook": "engaging opening tweet 60-200 chars",
  "tweets": [
    {"text": "first main tweet with concrete detail"},
    {"text": "second tweet with specific example or number"},
    {"text": "third tweet with actionable step"},
    {"text": "fourth tweet with evidence or study"},
    {"text": "fifth tweet with clear takeaway or question"}
  ]
}
`;

export async function generateThread(topic: string, openai: OpenAI): Promise<GeneratedThread> {
  const userPrompt = `
Topic: "${topic}"

Generate a complete Twitter thread with 5-7 tweets. Each tweet must contain at least one concrete detail (number, step, heuristic, or mini-example).

Return JSON matching the exact format specified in system prompt.
Ensure: 5–9 tweets; each 120-260 chars; no markdown; no ellipses; complete thoughts only.
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
    parsed = JSON.parse(raw);
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
    hook: stripFormatting(schemaResult.data.hook),
    tweets: schemaResult.data.tweets.map(t => ({ text: stripFormatting(t.text) }))
  };

  // Validate each tweet individually
  const hookValidation = validateTweetText(cleaned.hook);
  if (!hookValidation.valid) {
    throw new Error(`Hook validation failed: ${hookValidation.reason}`);
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
  const parsed = JSON.parse(raw);
  const schemaResult = ThreadSchema.safeParse(parsed);
  
  if (!schemaResult.success) {
    throw new Error(`Regeneration JSON schema validation failed: ${schemaResult.error.message}`);
  }

  const cleaned: GeneratedThread = {
    ...schemaResult.data,
    hook: stripFormatting(schemaResult.data.hook),
    tweets: schemaResult.data.tweets.map(t => ({ text: stripFormatting(t.text) }))
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
