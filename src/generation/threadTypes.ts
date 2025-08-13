export interface GeneratedThread {
  topic: string;
  hook_type: 'stat' | 'myth_bust' | 'checklist' | 'how_to' | 'story';
  hashtags: string[];
  source_urls: string[];
  predicted_scores: { 
    hook_clarity: number; 
    novelty: number; 
    evidence: number; 
    cta_strength: number; 
  };
  tweets: string[]; // T1..Tn
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

  if (!data.hook_type || !['stat', 'myth_bust', 'checklist', 'how_to', 'story'].includes(data.hook_type)) {
    throw new Error('hook_type must be one of: stat, myth_bust, checklist, how_to, story');
  }

  if (!Array.isArray(data.hashtags)) {
    throw new Error('hashtags must be an array');
  }

  if (!Array.isArray(data.source_urls) || data.source_urls.length < 2) {
    throw new Error('source_urls must be an array with at least 2 URLs');
  }

  return data as GeneratedThread;
}