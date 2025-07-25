import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface SecureSupabaseConfig {
  supabase: SupabaseClient | null;
  isConnected: boolean;
  connectionError: string | null;
}

class SecureSupabaseClientManager {
  private client: SupabaseClient | null = null;
  private config: SecureSupabaseConfig = {
    supabase: null,
    isConnected: false,
    connectionError: null
  };

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('❌ Missing environment variables:');
        console.error('SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
        console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
        throw new Error('Missing Supabase credentials: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      }

      // Validate service role key format
      if (!supabaseServiceKey.startsWith('eyJ') && !supabaseServiceKey.startsWith('sbp_')) {
        throw new Error('Invalid service role key format. Should start with "eyJ" or "sbp_"');
      }

      // Create client with service role key for full access
      this.client = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      });

      this.config = {
        supabase: this.client,
        isConnected: true,
        connectionError: null
      };

      console.log('✅ Secure Supabase client initialized with service role');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Secure Supabase initialization failed:', errorMessage);
      
      this.config = {
        supabase: null,
        isConnected: false,
        connectionError: errorMessage
      };
    }
  }

  // Test database connection and permissions
  async testConnection(): Promise<{
    success: boolean;
    tests: Array<{
      name: string;
      status: 'SUCCESS' | 'FAILED';
      details: string;
    }>;
  }> {
    if (!this.client) {
      return {
        success: false,
        tests: [{
          name: 'Client Initialization',
          status: 'FAILED',
          details: 'Supabase client not initialized'
        }]
      };
    }

    try {
      // Use the verification function we created
      const { data, error } = await this.client
        .rpc('verify_bot_permissions');

      if (error) {
        return {
          success: false,
          tests: [{
            name: 'Permission Verification',
            status: 'FAILED',
            details: error.message
          }]
        };
      }

      const allSuccessful = data?.every((test: any) => test.status === 'SUCCESS') ?? false;

      return {
        success: allSuccessful,
        tests: data || []
      };

    } catch (error) {
      return {
        success: false,
        tests: [{
          name: 'Connection Test',
          status: 'FAILED',
          details: error instanceof Error ? error.message : 'Unknown error'
        }]
      };
    }
  }

  // Get recent content for uniqueness checking (using secure function)
  async getRecentContentForUniqueness(daysBack: number = 7): Promise<Array<{
    content: string;
    created_at: string;
    content_hash: string;
    tweet_id: string;
  }>> {
    if (!this.client) {
      console.warn('⚠️ Supabase client not available for uniqueness check');
      return [];
    }

    try {
      const { data, error } = await this.client
        .rpc('get_recent_content_for_uniqueness', { days_back: daysBack });

      if (error) {
        console.warn('⚠️ Could not fetch recent content:', error);
        return [];
      }

      console.log(`🔍 Retrieved ${data?.length || 0} recent content items for uniqueness check`);
      return data || [];

    } catch (error) {
      console.warn('⚠️ Error fetching recent content:', error);
      return [];
    }
  }

  // Get daily post stats (using secure function)
  async getDailyPostStats(targetDate?: Date): Promise<{
    postCount: number;
    firstPostTime: string | null;
    lastPostTime: string | null;
    uniqueContentCount: number;
  }> {
    if (!this.client) {
      console.warn('⚠️ Supabase client not available for daily stats');
      return { postCount: 0, firstPostTime: null, lastPostTime: null, uniqueContentCount: 0 };
    }

    try {
      const dateStr = targetDate ? targetDate.toISOString().split('T')[0] : undefined;
      const { data, error } = await this.client
        .rpc('get_daily_post_stats', dateStr ? { target_date: dateStr } : {});

      if (error) {
        console.warn('⚠️ Could not fetch daily stats:', error);
        return { postCount: 0, firstPostTime: null, lastPostTime: null, uniqueContentCount: 0 };
      }

      const stats = data?.[0] || {};
      return {
        postCount: Number(stats.post_count || 0),
        firstPostTime: stats.first_post_time || null,
        lastPostTime: stats.last_post_time || null,
        uniqueContentCount: Number(stats.unique_content_count || 0)
      };

    } catch (error) {
      console.warn('⚠️ Error fetching daily stats:', error);
      return { postCount: 0, firstPostTime: null, lastPostTime: null, uniqueContentCount: 0 };
    }
  }

  // Secure tweet storage
  async storeTweet(tweetData: {
    tweet_id: string;
    content: string;
    content_type?: string;
    viral_score?: number;
    ai_growth_prediction?: number;
    ai_optimized?: boolean;
    generation_method?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Supabase client not available' };
    }

    try {
      const { error } = await this.client
        .from('tweets')
        .insert({
          tweet_id: tweetData.tweet_id,
          content: tweetData.content,
          tweet_type: tweetData.content_type || 'standard',
          content_type: tweetData.content_type || 'standard',
          viral_score: tweetData.viral_score || 5,
          ai_growth_prediction: tweetData.ai_growth_prediction || 5,
          ai_optimized: tweetData.ai_optimized || false,
          generation_method: tweetData.generation_method || 'standard'
          // Don't include created_at - let database handle it
        });

      if (error) {
        console.error('❌ Tweet storage failed:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Tweet stored successfully');
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Tweet storage error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  // Secure content uniqueness storage
  async storeContentUniqueness(uniquenessData: {
    content_hash: string;
    original_content: string;
    content_topic?: string;
    content_keywords?: string[];
    tweet_ids?: number[];
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Supabase client not available' };
    }

    try {
      const { error } = await this.client
        .from('content_uniqueness')
        .upsert({
          content_hash: uniquenessData.content_hash,
          original_content: uniquenessData.original_content,
          normalized_content: uniquenessData.original_content.toLowerCase().trim(),
          content_topic: uniquenessData.content_topic || '',
          content_keywords: uniquenessData.content_keywords || [],
          tweet_ids: uniquenessData.tweet_ids || [],
          usage_count: 1,
          first_used_at: new Date().toISOString()
        }, {
          onConflict: 'content_hash',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('❌ Content uniqueness storage failed:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Content uniqueness stored successfully');
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Content uniqueness storage error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  get supabase(): SupabaseClient | null {
    return this.config.supabase;
  }

  get isConnected(): boolean {
    return this.config.isConnected;
  }

  get connectionError(): string | null {
    return this.config.connectionError;
  }
}

// Export singleton instance
export const secureSupabaseClient = new SecureSupabaseClientManager();

// Backward compatibility export
export const supabaseClient = {
  supabase: secureSupabaseClient.supabase
}; 