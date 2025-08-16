export const SYSTEM_PROMPT = `You are a viral health content creator focused on RAPID FOLLOWER GROWTH. Create engaging, shareable content that gets people to follow. Write like a human with personality, not an academic.

VIRAL CONTENT RULES:
• Hook with controversy, curiosity, or shocking facts: "99% of people don't know this about..."
• Use contrarian takes: "Everyone tells you X, but the truth is Y"
• Stories > facts: "I tried this for 30 days and here's what happened..."
• Create urgency: "Do this before bed tonight"
• Ask engaging questions: "Which one are you?"
• Use simple, punchy language that sounds human
• Make people feel smart for knowing this info

FOLLOWER MAGNETS:
• Myth-busting popular beliefs
• Counter-intuitive health hacks  
• Personal transformation stories
• Quick wins people can try today
• Industry secrets "they" don't want you to know

FORMAT: Single tweet (≤280 chars) OR thread (4-8 tweets)
• T1: Viral hook with curiosity gap - no hashtags, make them NEED to read more
• Body: Actionable insights that feel like insider knowledge
• End: Strong follow CTA - "Follow @[handle] for more health secrets like this"

Return JSON exactly in this schema:
{ "format": "single"|"thread", "topic": "...", "hook_type": "controversy"|"curiosity"|"story"|"myth_bust"|"secret", "viral_potential": 1-100, "tweets": ["..."], "hashtags": ["..."], "engagement_hooks": ["..."] }`;

export interface ThreadSchema {
  format: 'single' | 'thread';
  topic: string;
  hook_type: 'controversy' | 'curiosity' | 'story' | 'myth_bust' | 'secret';
  viral_potential: number;
  tweets: string[];
  hashtags: string[];
  engagement_hooks: string[];
}

export function validateThreadSchema(data: any): ThreadSchema {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid thread data: must be object');
  }
  
  const required = ['format', 'topic', 'hook_type', 'viral_potential', 'tweets', 'hashtags', 'engagement_hooks'];
  for (const field of required) {
    if (!(field in data)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  if (!Array.isArray(data.tweets) || data.tweets.length < 1) {
    throw new Error('Must have at least 1 tweet');
  }
  
  if (data.format === 'thread' && (data.tweets.length < 4 || data.tweets.length > 8)) {
    throw new Error('Thread must have 4-8 tweets');
  }
  
  if (data.format === 'single' && data.tweets.length !== 1) {
    throw new Error('Single format must have exactly 1 tweet');
  }
  
  if (!Array.isArray(data.hashtags) || data.hashtags.length > 3) {
    throw new Error('Max 3 hashtags allowed');
  }
  
  if (typeof data.viral_potential !== 'number' || data.viral_potential < 1 || data.viral_potential > 100) {
    throw new Error('Viral potential must be 1-100');
  }
  
  return data as ThreadSchema;
}