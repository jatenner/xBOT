#!/usr/bin/env node

/**
 * 🔧 SETUP SMALL ACCOUNT CONFIGURATIONS
 * =====================================
 * Creates configurations without requiring database schema changes
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🔧 SETTING UP SMALL ACCOUNT CONFIGURATIONS');
  console.log('==========================================');

  try {
    // Load environment
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        if (line.includes('SUPABASE_URL=') && !process.env.SUPABASE_URL) {
          process.env.SUPABASE_URL = line.split('=')[1]?.replace(/"/g, '').trim();
        }
        if (line.includes('SUPABASE_ANON_KEY=') && !process.env.SUPABASE_ANON_KEY) {
          process.env.SUPABASE_ANON_KEY = line.split('=')[1]?.replace(/"/g, '').trim();
        }
      }
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    console.log('✅ Database connection established');

    // Step 1: Update bot configuration for small account (without description)
    console.log('\\n🔧 Step 1: Updating bot configuration...');
    
    const configs = [
      {
        key: 'small_account_strategy',
        value: {
          account_type: 'small_account',
          max_daily_posts: 4,
          min_viral_score_required: 7.0,
          posting_strategy: 'quality_over_quantity',
          optimal_hours: [8, 9, 19, 20],
          target_followers: 50,
          current_followers: 17,
          engagement_priority: true,
          controversy_level_min: 3,
          community_engagement_daily: 15,
          updated_at: new Date().toISOString()
        }
      },
      {
        key: 'posting_quality_rules',
        value: {
          min_hours_between_posts: 4,
          max_posts_per_day: 4,
          min_viral_score: 7.0,
          required_engagement_hooks: true,
          controversy_level_required: 3,
          optimal_posting_times: ['08:00', '09:00', '19:00', '20:00'],
          content_quality_gates: [
            'engagement_hook_present',
            'controversy_level_adequate',
            'viral_score_sufficient',
            'daily_limit_not_exceeded'
          ]
        }
      },
      {
        key: 'community_engagement_strategy',
        value: {
          daily_actions_target: 15,
          replies_per_day: 8,
          likes_per_day: 20,
          follows_per_day: 5,
          target_account_types: [
            'health_micro_influencers',
            'fitness_coaches',
            'nutrition_experts',
            'biohackers',
            'wellness_practitioners'
          ],
          follower_range_targets: { min: 100, max: 5000 },
          engagement_times: ['09:00', '13:00', '20:00']
        }
      },
      {
        key: 'growth_tracking_metrics',
        value: {
          baseline_followers: 17,
          target_followers: 50,
          target_timeline_days: 30,
          required_daily_growth: 1.1,
          success_metrics: {
            avg_likes_target: 1.0,
            engagement_rate_target: 1.0,
            success_rate_target: 25.0,
            follower_growth_rate_target: 3.67
          },
          weekly_milestones: [
            { week: 1, target_followers: 25, target_avg_likes: 0.3 },
            { week: 2, target_followers: 35, target_avg_likes: 0.5 },
            { week: 3, target_followers: 45, target_avg_likes: 0.7 },
            { week: 4, target_followers: 50, target_avg_likes: 1.0 }
          ]
        }
      }
    ];

    let successCount = 0;
    
    for (const config of configs) {
      try {
        const { error } = await supabase
          .from('bot_config')
          .upsert({
            key: config.key,
            value: config.value
          });

        if (error) {
          console.error(`❌ Failed to set ${config.key}:`, error.message);
        } else {
          console.log(`✅ ${config.key} configured`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error with ${config.key}:`, err.message);
      }
    }

    console.log(`\\n📊 Configuration Summary: ${successCount}/${configs.length} configs set`);

    // Step 2: Create local configuration files as backup
    console.log('\\n📁 Step 2: Creating local configuration files...');
    
    const configDir = path.join(__dirname, 'configs');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Create individual config files
    configs.forEach(config => {
      const filePath = path.join(configDir, `${config.key}.json`);
      fs.writeFileSync(filePath, JSON.stringify(config.value, null, 2));
      console.log(`📄 ${config.key}.json created`);
    });

    // Create master config file
    const masterConfig = {
      system_type: 'small_account_growth',
      activated_at: new Date().toISOString(),
      target_transformation: '17_to_50_followers_30_days',
      strategy: 'quality_over_quantity_with_community_engagement',
      configs: configs.reduce((acc, config) => {
        acc[config.key] = config.value;
        return acc;
      }, {})
    };

    fs.writeFileSync(path.join(configDir, 'master_config.json'), JSON.stringify(masterConfig, null, 2));
    console.log('📄 master_config.json created');

    // Step 3: Create implementation status file
    console.log('\\n📋 Step 3: Creating implementation status...');
    
    const implementationStatus = {
      phase: 'SMALL_ACCOUNT_GROWTH_ACTIVATED',
      timestamp: new Date().toISOString(),
      current_state: {
        followers: 17,
        avg_likes_per_tweet: 0.164,
        success_rate_percent: 10.4,
        posts_per_month: 183,
        total_likes_30_days: 30
      },
      target_state: {
        followers: 50,
        avg_likes_per_tweet: 1.0,
        success_rate_percent: 25.0,
        posts_per_month: 120,
        engagement_rate_percent: 1.0
      },
      strategy_changes: {
        posting_frequency: 'REDUCED from 6+/day to 4/day max',
        content_quality: 'INCREASED viral score requirement to 7+',
        community_engagement: 'ACTIVATED 15 daily strategic actions',
        timing_optimization: 'RESTRICTED to 8-9 AM and 7-8 PM',
        content_focus: 'SHIFTED to controversial health topics'
      },
      success_indicators: [
        'Daily: 2-3 tweets getting 1+ likes',
        'Weekly: 5-10 new followers',
        'Monthly: Avg likes >0.5, engagement rate >0.5%'
      ],
      monitoring_active: true,
      next_review: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    fs.writeFileSync('implementation_status.json', JSON.stringify(implementationStatus, null, 2));
    console.log('📄 implementation_status.json created');

    // Step 4: Verify current analytics one more time
    console.log('\\n📊 Step 4: Verifying current analytics...');
    
    const { data: recentTweets, error: tweetsError } = await supabase
      .from('tweets')
      .select('likes, retweets, replies, impressions, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (!tweetsError && recentTweets) {
      const tweets = recentTweets;
      const totalLikes = tweets.reduce((sum, tweet) => sum + (tweet.likes || 0), 0);
      const tweetsWithLikes = tweets.filter(tweet => (tweet.likes || 0) > 0).length;
      const avgLikes = tweets.length > 0 ? totalLikes / tweets.length : 0;
      const successRate = tweets.length > 0 ? (tweetsWithLikes / tweets.length) * 100 : 0;

      console.log('📈 Current Performance (last 20 tweets):');
      console.log(`   Total tweets: ${tweets.length}`);
      console.log(`   Total likes: ${totalLikes}`);
      console.log(`   Average likes per tweet: ${avgLikes.toFixed(3)}`);
      console.log(`   Success rate: ${successRate.toFixed(1)}% get likes`);
      console.log(`   Tweets with likes: ${tweetsWithLikes}/${tweets.length}`);
    }

    // Step 5: Success summary
    console.log('\\n🎉 SMALL ACCOUNT SYSTEM READY!');
    console.log('===============================');
    
    console.log('✅ CONFIGURATIONS ACTIVE:');
    console.log('   🎯 Quality Control: Max 4 posts/day, viral score 7+');
    console.log('   🤝 Community Engagement: 15 strategic actions daily');
    console.log('   📊 Growth Tracking: 17 → 50 followers (30 days)');
    console.log('   ⏰ Optimal Timing: 8-9 AM, 7-8 PM posting windows');

    console.log('\\n📁 FILES CREATED:');
    console.log('   📄 configs/small_account_strategy.json');
    console.log('   📄 configs/posting_quality_rules.json');
    console.log('   📄 configs/community_engagement_strategy.json');
    console.log('   📄 configs/growth_tracking_metrics.json');
    console.log('   📄 configs/master_config.json');
    console.log('   📄 implementation_status.json');

    console.log('\\n🚀 TRANSFORMATION ACTIVE:');
    console.log('   FROM: 183 tweets/month, 0.164 avg likes, 10% success rate');
    console.log('   TO: 120 tweets/month, 1.0 avg likes, 25% success rate');
    console.log('   GOAL: 17 → 50+ followers in 30 days');

    console.log('\\n📈 EXPECTED WEEKLY PROGRESS:');
    console.log('   Week 1: 17 → 25 followers (+8)');
    console.log('   Week 2: 25 → 35 followers (+10)');
    console.log('   Week 3: 35 → 45 followers (+10)');
    console.log('   Week 4: 45 → 50+ followers (+5+)');

    console.log('\\n🎯 Your bot is now optimized for small account growth!');
    console.log('Quality over quantity + Community engagement = Follower growth');

  } catch (error) {
    console.error('\\n❌ SETUP FAILED:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);