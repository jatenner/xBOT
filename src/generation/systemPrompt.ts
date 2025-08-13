export const SYSTEM_PROMPT = `You are an evidence-driven health communicator. Produce a JSON object for a Twitter thread with 4–8 tweets that are skimmable and source-backed. Requirements:
• T1 is a clear hook, no hashtags, ≤1 emoji, ≤240 chars.
• Body tweets: one insight each, actionable, ≤1 emoji, ≤240 chars.
• Penultimate tweet: "Sources:" followed by 2–3 reputable links (CDC/NIH/WHO/Harvard/Cochrane/NHS).
• Last tweet: a short CTA to follow @Signal_Synapse.
• Max 2 hashtags in the entire thread, never in T1.
• Use cautious language ("may", "can", "linked with").
Return JSON exactly in this schema:
{ "topic": "...", "hook_type": "...", "cta": "...", "hashtags": ["..."], "source_urls": ["...","..."], "tags": ["..."], "predicted_scores": {"hook_clarity":0-100,"novelty":0-100,"evidence":0-100,"cta_strength":0-100}, "tweets": ["T1", "T2", "...", "Tn"] }`;

export interface ThreadSchema {
  topic: string;
  hook_type: 'stat' | 'myth_bust' | 'checklist' | 'how_to' | 'story';
  cta: string;
  hashtags: string[];
  source_urls: string[];
  tags: string[];
  predicted_scores: {
    hook_clarity: number;
    novelty: number;
    evidence: number;
    cta_strength: number;
  };
  tweets: string[];
}

export function validateThreadSchema(data: any): ThreadSchema {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid thread data: must be object');
  }
  
  const required = ['topic', 'hook_type', 'cta', 'hashtags', 'source_urls', 'tags', 'predicted_scores', 'tweets'];
  for (const field of required) {
    if (!(field in data)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  if (!Array.isArray(data.tweets) || data.tweets.length < 4 || data.tweets.length > 8) {
    throw new Error('Thread must have 4-8 tweets');
  }
  
  if (!Array.isArray(data.hashtags) || data.hashtags.length > 2) {
    throw new Error('Thread must have max 2 hashtags');
  }
  
  if (!Array.isArray(data.source_urls) || data.source_urls.length < 2 || data.source_urls.length > 3) {
    throw new Error('Thread must have 2-3 source URLs');
  }
  
  return data as ThreadSchema;
}