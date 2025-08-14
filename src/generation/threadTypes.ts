export interface GeneratedThread {
  topic: string;
  hook_type: 'how_to' | 'myth_bust' | 'checklist' | 'story' | 'stat_drop';
  hashtags: string[];           // <= 2 total across thread
  source_urls: string[];        // 1–3 reputable sources
  predicted_scores: { 
    hook_clarity: number; 
    novelty: number; 
    evidence: number; 
    cta_strength: number; 
  };
  tweets: string[];             // T1..Tn (each <= 240 chars)
}

export function validateGeneratedThread(data: any): GeneratedThread {
  if (!data || typeof data !== 'object') {
    throw new Error('Thread data must be an object');
  }

  const required = ['topic', 'hook_type', 'hashtags', 'source_urls', 'predicted_scores', 'tweets'];
  for (const field of required) {
    if (!(field in data)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!Array.isArray(data.tweets) || data.tweets.length === 0) {
    throw new Error('tweets must be a non-empty array');
  }

  if (!data.hook_type || !['how_to', 'myth_bust', 'checklist', 'story', 'stat_drop'].includes(data.hook_type)) {
    throw new Error('hook_type must be one of: how_to, myth_bust, checklist, story, stat_drop');
  }

  if (!Array.isArray(data.hashtags)) {
    throw new Error('hashtags must be an array');
  }

  if (!Array.isArray(data.source_urls) || data.source_urls.length < 1 || data.source_urls.length > 3) {
    throw new Error('source_urls must be an array with 1-3 URLs');
  }

  // Validate hashtag count
  if (data.hashtags.length > 2) {
    throw new Error('hashtags must have ≤2 items total across thread');
  }

  // Validate tweet content and length
  for (let i = 0; i < data.tweets.length; i++) {
    const tweet = data.tweets[i];
    if (typeof tweet !== 'string') {
      throw new Error(`Tweet ${i + 1} must be a string`);
    }
    if (tweet.length > 240) {
      throw new Error(`Tweet ${i + 1} exceeds 240 characters (${tweet.length})`);
    }
  }

  return data as GeneratedThread;
}