import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Check if we can post based on rate limits
 * MAX: 2 posts/hour (singles + threads), 4 replies/hour
 */
export async function checkRateLimits(): Promise<{
  canPostContent: boolean;
  canPostReply: boolean;
  postsThisHour: number;
  repliesThisHour: number;
  reason?: string;
}> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // Count posts from receipts (source of truth)
  const { data: receipts } = await supabase
    .from('post_receipts')
    .select('post_type, posted_at')
    .gte('posted_at', oneHourAgo);
  
  const postsThisHour = receipts?.filter(r => r.post_type === 'single' || r.post_type === 'thread').length || 0;
  const repliesThisHour = receipts?.filter(r => r.post_type === 'reply').length || 0;
  
  const MAX_POSTS_PER_HOUR = parseInt(process.env.MAX_POSTS_PER_HOUR || '2');
  const MAX_REPLIES_PER_HOUR = parseInt(process.env.MAX_REPLIES_PER_HOUR || '4');
  
  const canPostContent = postsThisHour < MAX_POSTS_PER_HOUR;
  const canPostReply = repliesThisHour < MAX_REPLIES_PER_HOUR;
  
  let reason;
  if (!canPostContent) {
    reason = `Rate limit: ${postsThisHour}/${MAX_POSTS_PER_HOUR} posts this hour`;
  }
  if (!canPostReply) {
    reason = `Rate limit: ${repliesThisHour}/${MAX_REPLIES_PER_HOUR} replies this hour`;
  }
  
  return {
    canPostContent,
    canPostReply,
    postsThisHour,
    repliesThisHour,
    reason
  };
}

