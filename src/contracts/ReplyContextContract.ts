/**
 * Reply Context Contract - Ensures we have valid context before generating replies
 * Fail-closed: Invalid context = SKIP reply, never hallucinate
 */

export interface ReplyContext {
  ok: boolean;
  parent_text: string;
  parent_author: string;
  parent_id: string;
  parent_url: string;
  topic_label: string;
  confidence: number;
  reason?: string; // Set on failure
}

const POLITICAL_KEYWORDS = [
  'trump', 'biden', 'election', 'vote', 'democrat', 'republican', 'congress',
  'senate', 'legislation', 'policy', 'government', 'president', 'political',
  'immigration', 'border', 'tax', 'abortion', 'gun', 'climate change debate'
];

const BLOCKED_HANDLES = ['elonmusk', 'realdonaldtrump', 'potus', 'whitehouse'];

const ALLOWED_TOPICS = [
  'nutrition', 'fitness', 'sleep', 'recovery', 'longevity', 
  'mental health', 'exercise', 'diet', 'wellness', 'health',
  'meditation', 'stress', 'anxiety', 'supplements', 'vitamins'
];

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
]);

/**
 * Validate reply context - fail closed
 */
export function validateReplyContext(context: Partial<ReplyContext>): ReplyContext {
  // Check basic structure
  if (!context.parent_text || !context.parent_author || !context.parent_id) {
    return {
      ok: false,
      parent_text: '',
      parent_author: '',
      parent_id: '',
      parent_url: '',
      topic_label: '',
      confidence: 0,
      reason: 'Missing required fields'
    };
  }

  const text = context.parent_text.trim();
  const author = context.parent_author.toLowerCase();

  // Length validation
  if (text.length < 20 || text.length > 400) {
    return {
      ok: false,
      parent_text: text,
      parent_author: context.parent_author,
      parent_id: context.parent_id,
      parent_url: context.parent_url || '',
      topic_label: '',
      confidence: 0,
      reason: `Text length ${text.length} out of range (20-400)`
    };
  }

  // Check for JSON/HTML/code artifacts
  if (text.includes('{') || text.includes('}') || text.includes('[') || text.includes(']')) {
    return {
      ok: false,
      parent_text: text,
      parent_author: context.parent_author,
      parent_id: context.parent_id,
      parent_url: context.parent_url || '',
      topic_label: '',
      confidence: 0,
      reason: 'Text contains JSON/code artifacts'
    };
  }

  // Check for HTML tags
  if (/<[^>]+>/.test(text)) {
    return {
      ok: false,
      parent_text: text,
      parent_author: context.parent_author,
      parent_id: context.parent_id,
      parent_url: context.parent_url || '',
      topic_label: '',
      confidence: 0,
      reason: 'Text contains HTML tags'
    };
  }

  // Extract meaningful keywords (non-stopwords)
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const meaningfulWords = words.filter(w => !STOPWORDS.has(w) && w.length > 3);
  
  if (meaningfulWords.length === 0) {
    return {
      ok: false,
      parent_text: text,
      parent_author: context.parent_author,
      parent_id: context.parent_id,
      parent_url: context.parent_url || '',
      topic_label: '',
      confidence: 0,
      reason: 'No meaningful keywords found'
    };
  }

  // Block political content
  const lowerText = text.toLowerCase();
  for (const keyword of POLITICAL_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return {
        ok: false,
        parent_text: text,
        parent_author: context.parent_author,
        parent_id: context.parent_id,
        parent_url: context.parent_url || '',
        topic_label: 'political',
        confidence: 0,
        reason: `Political keyword detected: ${keyword}`
      };
    }
  }

  // Block certain handles
  for (const handle of BLOCKED_HANDLES) {
    if (author.includes(handle)) {
      return {
        ok: false,
        parent_text: text,
        parent_author: context.parent_author,
        parent_id: context.parent_id,
        parent_url: context.parent_url || '',
        topic_label: '',
        confidence: 0,
        reason: `Blocked handle: ${handle}`
      };
    }
  }

  // Detect topic (basic keyword matching)
  let topicLabel = 'general';
  let topicConfidence = 0.3;

  for (const topic of ALLOWED_TOPICS) {
    const topicWords = topic.split(' ');
    const matches = topicWords.filter(tw => lowerText.includes(tw));
    if (matches.length > 0) {
      topicLabel = topic;
      topicConfidence = 0.5 + (matches.length * 0.2);
      break;
    }
  }

  // If no allowed topic detected, be cautious
  if (topicLabel === 'general') {
    // Check if it's health-adjacent at all
    const healthKeywords = ['health', 'body', 'mind', 'feel', 'better', 'improve', 'tips', 'advice'];
    const hasHealthContext = healthKeywords.some(kw => lowerText.includes(kw));
    
    if (!hasHealthContext) {
      return {
        ok: false,
        parent_text: text,
        parent_author: context.parent_author,
        parent_id: context.parent_id,
        parent_url: context.parent_url || '',
        topic_label: 'off-topic',
        confidence: 0,
        reason: 'Content not in allowed health/wellness domains'
      };
    }
  }

  // All checks passed
  return {
    ok: true,
    parent_text: text,
    parent_author: context.parent_author,
    parent_id: context.parent_id,
    parent_url: context.parent_url || `https://x.com/${context.parent_author}/status/${context.parent_id}`,
    topic_label: topicLabel,
    confidence: Math.min(topicConfidence, 1.0),
    reason: undefined
  };
}

/**
 * Check if we should skip self-replies
 */
export function shouldAllowSelfReply(parentAuthor: string): boolean {
  const allowSelfReplies = process.env.ALLOW_SELF_REPLIES === 'true';
  const ourHandle = (process.env.TWITTER_USERNAME || 'SignalAndSynapse').toLowerCase();
  
  if (parentAuthor.toLowerCase().includes(ourHandle)) {
    if (!allowSelfReplies) {
      console.log(`[REPLY_GATE] Skipping self-reply (author: ${parentAuthor})`);
      return false;
    }
  }
  
  return true;
}

