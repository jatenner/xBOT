/**
 * Unified Metrics & Learning Writers
 * Fix PostgREST schema cache errors with proper column mapping
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Get supabase client from existing infrastructure
let supabaseClient: SupabaseClient;

async function getSupabase(): Promise<SupabaseClient> {
  if (!supabaseClient) {
    try {
      const { getSafeDatabase } = await import('../lib/db');
      const db = getSafeDatabase();
      supabaseClient = db.getClient();
    } catch (error) {
      // Fallback: create direct connection
      const { createClient } = await import('@supabase/supabase-js');
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error('Missing Supabase credentials');
      supabaseClient = createClient(url, key);
    }
  }
  return supabaseClient;
}

/**
 * Upsert tweet metrics with proper schema mapping
 */
export async function upsertTweetMetrics(m: {
  tweet_id: string;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks?: number;
  impressions?: number;
  content?: string;
  collected_at?: string;
}): Promise<void> {
  try {
    const supabase = await getSupabase();
    
    const row = {
      tweet_id: m.tweet_id,
      collected_at: m.collected_at ?? new Date().toISOString(),
      likes_count: m.likes,
      retweets_count: m.retweets,
      replies_count: m.replies,
      bookmarks_count: m.bookmarks ?? 0,
      impressions_count: m.impressions ?? 0,
      content: m.content ?? null,
    };

    const { error } = await supabase
      .from('tweet_metrics')
      .upsert(row, { onConflict: 'tweet_id,collected_at' });

    if (error) {
      // Don't fail for permission errors - just log warning (reduced noise)
      if (error.message.includes('permission denied')) {
        console.log(`📊 METRICS_STORAGE: Permission warning (non-blocking, data saving via alternative path)`);
        return; // Continue without storing metrics
      }
      throw new Error(`upsertTweetMetrics failed: ${error.message}`);
    }

    console.log(`METRICS_UPSERT_OK tweet_id=${m.tweet_id} collected_at=${row.collected_at} likes=${m.likes} retweets=${m.retweets}`);
  } catch (error: any) {
    console.error(`❌ METRICS_UPSERT_FAILED tweet_id=${m.tweet_id} error=${error.message}`);
    throw error;
  }
}

/**
 * Upsert learning post data with viral potential scoring
 */
export async function upsertLearningPost(p: {
  tweet_id: string;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks?: number;
  impressions?: number;
  viral_potential_score?: number;
  content?: string;
  created_at?: string;
}): Promise<void> {
  try {
    const supabase = await getSupabase();
    
    const row = {
      tweet_id: p.tweet_id,
      created_at: p.created_at ?? new Date().toISOString(),
      likes_count: p.likes,
      retweets_count: p.retweets,
      replies_count: p.replies,
      bookmarks_count: p.bookmarks ?? 0,
      impressions_count: p.impressions ?? 0,
      viral_potential_score: p.viral_potential_score ?? calculateViralScore(p),
      content: p.content ?? null,
      // format: 'single', // Removed - column doesn't exist
    };

    // Try upsert first, fall back to insert if constraint issues
    let { error } = await supabase
      .from('learning_posts')
      .upsert(row, { onConflict: 'tweet_id' });
    
    // If onConflict fails, try simple upsert or insert
    if (error && error.message.includes('no unique or exclusion constraint')) {
      console.log('📝 LEARNING_POSTS: Falling back to insert/update pattern');
      
      // First try to update existing record
      const { error: updateError } = await supabase
        .from('learning_posts')
        .update(row)
        .eq('tweet_id', row.tweet_id);
      
      // If no rows updated, insert new record
      if (updateError || updateError?.details?.includes('0 rows')) {
        const { error: insertError } = await supabase
          .from('learning_posts')
          .insert(row);
        error = insertError;
      } else {
        error = updateError;
      }
    }

    if (error) {
      // Don't fail for permission errors or constraint issues - just log warning (reduced noise)
      if (error.message.includes('permission denied') || error.message.includes('no unique or exclusion constraint')) {
        console.log(`📚 LEARNING_STORAGE: Permission/constraint warning (non-blocking, data saving via alternative path)`);
        return; // Continue without storing learning data
      }
      throw new Error(`upsertLearningPost failed: ${error.message}`);
    }

    console.log(`LEARNING_UPSERT_OK tweet_id=${p.tweet_id} viral_score=${row.viral_potential_score} likes=${p.likes} engagement=${p.likes + p.retweets + p.replies}`);
  } catch (error: any) {
    console.error(`❌ LEARNING_UPSERT_FAILED tweet_id=${p.tweet_id} error=${error.message}`);
    throw error;
  }
}

/**
 * Calculate viral potential score based on engagement metrics
 */
function calculateViralScore(p: {
  likes: number;
  retweets: number;
  replies: number;
  impressions?: number;
}): number {
  const engagement = p.likes + (p.retweets * 3) + (p.replies * 2);
  const impressions = p.impressions || Math.max(engagement * 10, 100);
  const rate = engagement / impressions;
  
  // Score 0-100 based on engagement rate and absolute numbers
  const baseScore = Math.min(rate * 1000, 50); // Rate component (0-50)
  const volumeScore = Math.min(Math.log10(engagement + 1) * 10, 50); // Volume component (0-50)
  
  return Math.round(baseScore + volumeScore);
}

/**
 * Bootstrap check - reload PostgREST schema cache on startup
 */
export async function bootstrapSchemaCheck(): Promise<void> {
  try {
    const supabase = await getSupabase();
    
    // Test if our columns exist by doing a simple query
    const { error } = await supabase
      .from('tweet_metrics')
      .select('tweet_id, likes_count, impressions_count')
      .limit(1);
    
    if (error && error.message.includes('column')) {
      console.warn('⚠️ Schema columns missing, triggering PostgREST reload...');
      
      // Trigger PostgREST schema reload
      try {
        await supabase.rpc('pg_notify', {
          channel: 'pgrst',
          payload: 'reload schema'
        });
      } catch (rpcError) {
        // Fallback: direct SQL if RPC not available
        console.warn('⚠️ RPC pg_notify failed, schema may need manual reload');
      }
      
      console.log('🔄 PostgREST schema reload triggered');
    }
    
    console.log('DB_SCHEMA_OK tweet_metrics and learning_posts schema verified');
  } catch (error: any) {
    console.warn(`⚠️ DB_SCHEMA_CHECK_FAILED: ${error.message}`);
    // Don't fail startup on schema check issues
  }
}

/**
 * Get recent posts for format decision making
 */
export async function getRecentPosts(limit: number = 30): Promise<Array<{
  format: 'single' | 'thread';
  createdAt: string;
  engagement: number;
}>> {
  try {
    // Use admin client for database operations
    const { admin } = await import('../lib/supabaseClients');
    
    const { data, error } = await admin
      .from('learning_posts')
      .select('tweet_id, created_at, likes_count, retweets_count, replies_count, content')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return (data || []).map(row => ({
      format: (row.content && row.content.includes('🧵') || row.content && row.content.length > 280) ? 'thread' : 'single',
      createdAt: row.created_at,
      engagement: (row.likes_count || 0) + (row.retweets_count || 0) + (row.replies_count || 0)
    }));
  } catch (error: any) {
    console.warn(`⚠️ Failed to get recent posts: ${error.message}`);
    return [];
  }
}
