import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import { normalizeForComparison } from './text/sanitize';

function createSignature(text: string): string {
  return createHash('sha1').update(normalizeForComparison(text)).digest('hex');
}

export async function isDuplicateThread(tweets: { text: string }[]): Promise<boolean> {
  try {
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
    const signatures = tweets.map(t => createSignature(t.text));
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('posted_tweets')
      .select('text_sig')
      .gte('posted_at', since);
    
    if (error) {
      console.warn('Dedupe check failed, continuing:', error);
      return false; // Fail open
    }

    const recentSignatures = new Set(data?.map(r => r.text_sig) ?? []);
    const hasDuplicate = signatures.some(sig => recentSignatures.has(sig));
    
    return hasDuplicate;
  } catch (error) {
    console.warn('Dedupe check error, continuing:', error);
    return false; // Fail open - better to post than fail on dedupe
  }
}

export async function storeTweetSignatures(
  tweetIds: string[], 
  tweets: { text: string }[]
): Promise<void> {
  try {
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
    
    const records = tweetIds.map((tweetId, index) => ({
      tweet_id: tweetId,
      text_sig: createSignature(tweets[index].text),
      posted_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('posted_tweets')
      .insert(records);
    
    if (error) {
      console.error('Failed to store tweet signatures:', error);
      throw error;
    }

    console.log(`✅ Stored ${records.length} tweet signatures for dedupe tracking`);
  } catch (error) {
    console.error('Error storing tweet signatures:', error);
    // Don't throw - this is not critical for posting success
  }
}

export async function storeThreadRecord(
  rootTweetId: string,
  replyTweetIds: string[],
  topic: string,
  hook: string,
  qualityScore: number
): Promise<void> {
  try {
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
    
    const { error } = await supabase
      .from('posted_threads')
      .insert({
        root_tweet_id: rootTweetId,
        reply_tweet_ids: replyTweetIds,
        topic,
        hook,
        quality_score: qualityScore,
        posted_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Failed to store thread record:', error);
      throw error;
    }

    console.log(`✅ Stored thread record: root=${rootTweetId}, replies=${replyTweetIds.length}`);
  } catch (error) {
    console.error('Error storing thread record:', error);
    // Don't throw - this is not critical for posting success
  }
}
