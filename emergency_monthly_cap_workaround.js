#!/usr/bin/env node

/**
 * 🚨 EMERGENCY: Monthly API Usage Cap Workaround
 * Focus on posting-only mode until monthly limits reset
 */

const { supabaseClient } = require('./dist/utils/supabaseClient');

async function deployMonthlyCapWorkaround() {
  console.log('🚨 EMERGENCY: Monthly API Usage Cap Exceeded');
  console.log('⚡ Deploying posting-only mode workaround...');
  
  try {
    // 1. 🎯 Enable posting-only mode (no search/engagement)
    await supabaseClient.supabase
      .from('bot_config')
      .upsert({
        key: 'monthly_cap_workaround',
        value: {
          enabled: true,
          posting_only_mode: true,
          disable_search_operations: true,
          disable_engagement_search: true,
          focus_on_original_content: true,
          reason: 'Monthly API usage cap exceeded - posting only until reset',
          implemented_at: new Date().toISOString()
        }
      });

    // 2. 📝 Override strategist to focus on original content only
    await supabaseClient.supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_posting_strategy',
        value: {
          mode: 'original_content_only',
          no_reply_search: true,
          no_engagement_search: true,
          post_frequency: 'aggressive', // Use those 17 posts!
          content_types: ['post', 'thread', 'poll'],
          avoid_search_dependent_actions: true
        }
      });

    // 3. 🔥 Temporary disable search-dependent agents
    await supabaseClient.supabase
      .from('bot_config')
      .upsert({
        key: 'disabled_agents_monthly_cap',
        value: {
          disabled_until_reset: true,
          disabled_agents: [
            'realEngagementAgent',
            'replyAgent', 
            'followGrowthAgent',
            'competitiveIntelligenceLearner'
          ],
          reason: 'These agents require search APIs that are monthly capped'
        }
      });

    // 4. 💪 Boost original content generation
    await supabaseClient.supabase
      .from('bot_config')
      .upsert({
        key: 'content_boost_mode',
        value: {
          enabled: true,
          focus_on_viral_content: true,
          use_trending_topics: true, // These don't require search
          increase_thread_generation: true,
          poll_creation_boost: true,
          original_insights_mode: true
        }
      });

    // 5. 🎯 Override afternoon boost to posting-only
    await supabaseClient.supabase
      .from('bot_config')
      .upsert({
        key: 'afternoon_boost_mode',
        value: {
          enabled: true,
          peak_hours: [13, 14, 15, 16, 17], // 1-5 PM
          min_interval_minutes: 30, // More frequent posting
          engagement_weight: 0.0, // 100% posting focus
          force_activity: true,
          posting_only_mode: true, // NEW: No search operations
          boost_expires: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        }
      });

    // 6. 📊 Update daily limits to use all available posts
    await supabaseClient.supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_daily_targets',
        value: {
          target_posts_today: 17, // Use all available posts
          post_every_minutes: 30, // Every 30 minutes
          content_mix: {
            original_posts: 60,
            threads: 25, 
            polls: 15
          },
          no_replies_until_monthly_reset: true
        }
      });

    console.log('✅ MONTHLY CAP WORKAROUND DEPLOYED!');
    console.log('');
    console.log('🎯 EMERGENCY MODE ACTIVATED:');
    console.log('   📝 POSTING-ONLY MODE: 17 posts available today');
    console.log('   🚫 Search operations: DISABLED (monthly cap)');
    console.log('   💪 Original content: BOOSTED');
    console.log('   🧵 Thread generation: INCREASED');
    console.log('   📊 Polls: ENABLED');
    console.log('   ⏰ Posting frequency: Every 30 minutes');
    console.log('');
    console.log('💡 STRATEGY:');
    console.log('   ✅ Focus on original viral content');
    console.log('   ✅ Use trending topics (no search needed)');
    console.log('   ✅ Create engaging threads and polls');
    console.log('   ✅ Build thought leadership through insights');
    console.log('   ⏳ Wait for monthly API reset for engagement features');
    console.log('');
    console.log('📈 EXPECTED RESULTS:');
    console.log('   🔥 17 high-quality posts today');
    console.log('   📊 Consistent presence every 30 minutes');
    console.log('   🎯 Focus on content that drives organic engagement');
    console.log('   💰 Zero API waste on blocked operations');

  } catch (error) {
    console.error('❌ Workaround deployment failed:', error);
  }
}

// Run immediately
deployMonthlyCapWorkaround(); 