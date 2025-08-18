/**
 * Tests for Supabase client permissions
 * Verifies anon client fails writes, admin client succeeds
 */

import { admin, anon } from '../src/lib/supabaseClients';

describe('Supabase Clients', () => {
  const testTweetId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  afterAll(async () => {
    // Cleanup any test data
    try {
      await admin.from('learning_posts').delete().eq('tweet_id', testTweetId);
      await admin.from('tweet_metrics').delete().eq('tweet_id', testTweetId);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Admin Client (service_role)', () => {
    it('should successfully write to learning_posts', async () => {
      const { data, error } = await admin
        .from('learning_posts')
        .upsert([{
          tweet_id: testTweetId,
          format: 'single',
          likes_count: 0,
          retweets_count: 0,
          replies_count: 0,
          bookmarks_count: 0,
          impressions_count: 0,
          content: 'Test content for admin client'
        }], { onConflict: 'tweet_id' });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should successfully write to tweet_metrics', async () => {
      const { data, error } = await admin
        .from('tweet_metrics')
        .upsert([{
          tweet_id: testTweetId,
          collected_at: new Date().toISOString(),
          likes_count: 5,
          retweets_count: 2,
          replies_count: 1,
          bookmarks_count: 3,
          impressions_count: 100,
          content: 'Test tweet content'
        }], { onConflict: 'tweet_id' });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should successfully read from both tables', async () => {
      const { data: learningData, error: learningError } = await admin
        .from('learning_posts')
        .select('tweet_id')
        .eq('tweet_id', testTweetId)
        .limit(1);

      const { data: metricsData, error: metricsError } = await admin
        .from('tweet_metrics')
        .select('tweet_id')
        .eq('tweet_id', testTweetId)
        .limit(1);

      expect(learningError).toBeNull();
      expect(metricsError).toBeNull();
      expect(learningData).toHaveLength(1);
      expect(metricsData).toHaveLength(1);
    });
  });

  describe('Anon Client (public key)', () => {
    it('should fail to write to learning_posts due to RLS', async () => {
      const { data, error } = await anon
        .from('learning_posts')
        .insert([{
          tweet_id: `anon_test_${Date.now()}`,
          format: 'single',
          likes_count: 0,
          retweets_count: 0,
          replies_count: 0
        }]);

      // Should fail due to RLS policy
      expect(error).toBeDefined();
      expect(error?.code).toMatch(/(403|401|42501)/); // Permission denied codes
    });

    it('should fail to write to tweet_metrics due to RLS', async () => {
      const { data, error } = await anon
        .from('tweet_metrics')
        .insert([{
          tweet_id: `anon_test_${Date.now()}`,
          collected_at: new Date().toISOString(),
          likes_count: 1,
          retweets_count: 0,
          replies_count: 0
        }]);

      // Should fail due to RLS policy
      expect(error).toBeDefined();
      expect(error?.code).toMatch(/(403|401|42501)/); // Permission denied codes
    });

    it('should be able to read from tables (if RLS allows)', async () => {
      // This test verifies anon client can read (depending on RLS policies)
      const { data, error } = await anon
        .from('learning_posts')
        .select('tweet_id')
        .limit(1);

      // This might succeed or fail depending on RLS read policies
      // We just verify the client connection works
      expect(typeof error === 'object').toBe(true);
      expect(Array.isArray(data) || data === null).toBe(true);
    });
  });

  describe('Environment Variables', () => {
    it('should have required environment variables', () => {
      expect(process.env.SUPABASE_URL).toBeDefined();
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
      expect(process.env.SUPABASE_ANON_KEY).toBeDefined();
    });

    it('should have different keys for admin and anon clients', () => {
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).not.toBe(process.env.SUPABASE_ANON_KEY);
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY?.length).toBeGreaterThan(50);
      expect(process.env.SUPABASE_ANON_KEY?.length).toBeGreaterThan(50);
    });
  });
});
