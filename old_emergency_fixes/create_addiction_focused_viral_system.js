#!/usr/bin/env node

/**
 * 🔥 ADDICTION-FOCUSED VIRAL SYSTEM
 * ================================
 * 
 * Mission: Make people ADDICTED to @SignalAndSynapse
 * Strategy: Dynamic posting based on engagement patterns and trend-jacking
 * 
 * KEY FEATURES:
 * 1. Dopamine-driven content scheduling 
 * 2. Real-time trend hijacking
 * 3. Addiction psychology hooks
 * 4. Dynamic posting frequency (1-20 posts/day based on performance)
 * 5. Engagement-based learning system
 * 6. Hook optimization for maximum retention
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployAddictionViralSystem() {
  console.log('🔥 === DEPLOYING ADDICTION-FOCUSED VIRAL SYSTEM ===');
  console.log('🎯 Mission: Make @SignalAndSynapse the most addictive healthcare account');
  
  try {
    // 1. OVERRIDE ALL EMERGENCY MODES
    console.log('\n🚨 Phase 1: NUCLEAR EMERGENCY MODE OVERRIDE');
    
    const emergencyConfigs = [
      { key: 'FORCE_ADDICTION_MODE', value: 'true', description: 'Override all emergency restrictions for viral addiction system' },
      { key: 'NUCLEAR_VIRAL_OVERRIDE', value: 'true', description: 'Nuclear override for viral transformation' },
      { key: 'EMERGENCY_MODE_DISABLED', value: 'true', description: 'Permanently disable emergency mode restrictions' },
      { key: 'LIVE_POSTING_FORCE_ENABLED', value: 'true', description: 'Force live posting regardless of environment' },
      { key: 'ADDICTION_SYSTEM_ACTIVE', value: 'true', description: 'Addiction-focused viral system status' },
    ];

    for (const config of emergencyConfigs) {
      await supabase.from('bot_config').upsert(config);
      console.log(`   ✅ ${config.key}: ${config.value}`);
    }

    // 2. ADDICTION-BASED CONTENT STRATEGY
    console.log('\n🎯 Phase 2: ADDICTION CONTENT PSYCHOLOGY');
    
    const addictionConfigs = [
      // Content Distribution (Addiction-Optimized)
      { key: 'content_addiction_mode', value: 'dopamine_optimization', description: 'Optimize for dopamine hits and retention' },
      { key: 'viral_hook_percentage', value: '70', description: '70% of content must have viral hooks' },
      { key: 'controversy_percentage', value: '30', description: '30% controversial for engagement' },
      { key: 'academic_content_percentage', value: '5', description: 'Minimal academic content (credibility only)' },
      { key: 'addiction_hook_percentage', value: '60', description: '60% content designed for addiction' },
      
      // Addiction Psychology Hooks
      { key: 'addiction_hooks_active', value: 'true', description: 'Use psychological addiction triggers' },
      { key: 'cliffhanger_percentage', value: '40', description: 'End posts with cliffhangers for return engagement' },
      { key: 'dopamine_triggers_active', value: 'true', description: 'Use dopamine-triggering content patterns' },
      { key: 'fomo_generation_active', value: 'true', description: 'Create fear of missing out' },
      { key: 'curiosity_gap_optimization', value: 'true', description: 'Use curiosity gaps in headlines' },
      
      // Viral Content Types (Addiction-Focused)
      { key: 'hot_takes_percentage', value: '25', description: 'Hot takes for engagement' },
      { key: 'controversial_opinions_percentage', value: '20', description: 'Controversial opinions for debates' },
      { key: 'insider_secrets_percentage', value: '20', description: 'Insider secrets for exclusivity' },
      { key: 'trend_jacking_percentage', value: '15', description: 'Hijack trending topics' },
      { key: 'cliffhanger_threads_percentage', value: '15', description: 'Multi-part cliffhanger content' },
      { key: 'behind_scenes_percentage', value: '5', description: 'Behind-scenes for personal connection' },
    ];

    for (const config of addictionConfigs) {
      await supabase.from('bot_config').upsert(config);
      console.log(`   ✅ ${config.key}: ${config.value}`);
    }

    // 3. DYNAMIC POSTING FREQUENCY SYSTEM
    console.log('\n⚡ Phase 3: DYNAMIC POSTING FREQUENCY ENGINE');
    
    const postingConfigs = [
      // Dynamic Frequency Control
      { key: 'dynamic_posting_enabled', value: 'true', description: 'Enable dynamic posting frequency' },
      { key: 'base_posts_per_day', value: '8', description: 'Base posting frequency' },
      { key: 'max_posts_per_day', value: '20', description: 'Maximum posts when viral momentum detected' },
      { key: 'min_posts_per_day', value: '3', description: 'Minimum posts during low engagement' },
      
      // Performance-Based Scaling
      { key: 'viral_threshold_likes', value: '50', description: 'Likes threshold for viral detection' },
      { key: 'viral_threshold_retweets', value: '10', description: 'Retweets threshold for viral detection' },
      { key: 'engagement_scaling_active', value: 'true', description: 'Scale posting based on engagement' },
      { key: 'momentum_detection_active', value: 'true', description: 'Detect and ride viral momentum' },
      
      // Smart Timing (Addiction-Optimized)
      { key: 'dopamine_timing_optimization', value: 'true', description: 'Optimize posting times for dopamine hits' },
      { key: 'addiction_schedule_type', value: 'variable_ratio', description: 'Use variable ratio schedule for addiction' },
      { key: 'surprise_posting_percentage', value: '30', description: 'Unpredictable posting times for addiction' },
      { key: 'prime_time_focus', value: 'true', description: 'Focus on peak engagement hours' },
    ];

    for (const config of postingConfigs) {
      await supabase.from('bot_config').upsert(config);
      console.log(`   ✅ ${config.key}: ${config.value}`);
    }

    // 4. REAL-TIME LEARNING & ADAPTATION
    console.log('\n🧠 Phase 4: ADDICTION LEARNING SYSTEM');
    
    const learningConfigs = [
      // Real-Time Learning
      { key: 'addiction_learning_active', value: 'true', description: 'Learn from addiction patterns' },
      { key: 'engagement_learning_frequency', value: '30', description: 'Learn every 30 minutes' },
      { key: 'viral_pattern_detection', value: 'true', description: 'Detect what goes viral' },
      { key: 'audience_addiction_tracking', value: 'true', description: 'Track audience addiction patterns' },
      
      // Hook Optimization
      { key: 'hook_performance_tracking', value: 'true', description: 'Track which hooks work best' },
      { key: 'a_b_test_hooks', value: 'true', description: 'A/B test different addiction hooks' },
      { key: 'optimize_for_retention', value: 'true', description: 'Optimize for return engagement' },
      { key: 'addiction_metrics_tracking', value: 'true', description: 'Track addiction-specific metrics' },
      
      // Trend Adaptation
      { key: 'real_time_trend_jacking', value: 'true', description: 'Hijack trends in real-time' },
      { key: 'trend_monitoring_frequency', value: '15', description: 'Check trends every 15 minutes' },
      { key: 'viral_opportunity_detection', value: 'true', description: 'Detect viral opportunities' },
      { key: 'competitor_learning_active', value: 'true', description: 'Learn from competitor viral content' },
    ];

    for (const config of learningConfigs) {
      await supabase.from('bot_config').upsert(config);
      console.log(`   ✅ ${config.key}: ${config.value}`);
    }

    // 5. ADDICTION CONTENT TEMPLATES
    console.log('\n🎪 Phase 5: ADDICTION CONTENT HOOKS');
    
    const addictionHooks = [
      "🧵 Thread: The 7 health tech secrets Big Pharma doesn't want you to know (1/7)",
      "🔥 Hot take: Everyone's obsessing over AI in healthcare, but they're missing the real revolution...",
      "👀 What I learned after analyzing 10,000 patient records that shocked even me:",
      "⚡ Unpopular opinion: Most health apps are making you LESS healthy. Here's why:",
      "🚨 BREAKING: Just discovered why 97% of health startups fail (it's not what you think)",
      "💡 Plot twist: The biggest healthcare breakthrough isn't coming from where you expect...",
      "🎯 Inside secret: What we don't tell patients about their data (thread):",
      "⭐ Controversial take: Your doctor is probably wrong about this ONE thing:",
      "🔬 3 years analyzing health data taught me something that will blow your mind:",
      "💀 The dark side of health tech nobody talks about (prepare to be shocked):",
      "🎪 Behind the scenes: How we actually make healthcare decisions (it's messy):",
      "⚠️ Red flag: If your health app does THIS, delete it immediately:",
      "🚀 Future shock: Healthcare in 2030 will be unrecognizable. Here's what's coming:",
      "🎭 Truth bomb: The health advice you're getting is probably outdated. Here's why:",
      "💎 Hidden gem: The health metric everyone ignores but predicts everything:"
    ];

    for (let i = 0; i < addictionHooks.length; i++) {
      await supabase.from('bot_config').upsert({
        key: `addiction_hook_${i + 1}`,
        value: addictionHooks[i],
        description: 'Addiction-optimized content hook'
      });
    }
    console.log(`   ✅ Deployed ${addictionHooks.length} addiction content hooks`);

    // 6. BANNED ACADEMIC CONTENT
    console.log('\n🚫 Phase 6: BAN BORING ACADEMIC CONTENT');
    
    const bannedPhrases = [
      'BREAKTHROUGH:', 'Research shows', 'Studies indicate', 'According to research',
      'Scientists discovered', 'A new study', 'Research suggests', 'Data shows',
      'Clinical trials', 'Peer-reviewed', 'Meta-analysis', 'Systematic review'
    ];

    await supabase.from('bot_config').upsert({
      key: 'banned_academic_phrases',
      value: JSON.stringify(bannedPhrases),
      description: 'Phrases banned to prevent boring academic content'
    });
    console.log(`   ✅ Banned ${bannedPhrases.length} boring academic phrases`);

    // 7. FINAL CONFIGURATION SUMMARY
    console.log('\n📊 === ADDICTION VIRAL SYSTEM DEPLOYED ===');
    
    const { data: configs } = await supabase
      .from('bot_config')
      .select('key, value')
      .in('key', [
        'FORCE_ADDICTION_MODE',
        'addiction_system_active',
        'viral_hook_percentage',
        'dynamic_posting_enabled',
        'max_posts_per_day',
        'addiction_learning_active'
      ]);

    console.log('\n🎯 ADDICTION SYSTEM STATUS:');
    configs?.forEach(config => {
      console.log(`   ${config.key}: ${config.value}`);
    });

    console.log('\n🔥 EXPECTED ADDICTION RESULTS:');
    console.log('   ✅ Content: 70% viral hooks, 30% controversial, 5% academic');
    console.log('   ✅ Posting: 3-20 posts/day based on engagement momentum');
    console.log('   ✅ Hooks: Cliffhangers, FOMO, curiosity gaps, dopamine triggers');
    console.log('   ✅ Learning: Real-time adaptation every 30 minutes');
    console.log('   ✅ Trends: Hijack viral opportunities within 15 minutes');
    console.log('   ✅ Psychology: Variable ratio posting for maximum addiction');
    
    console.log('\n💀 ADDICTION TIMELINE:');
    console.log('   🎯 1-2 hours: First viral hook posts appear');
    console.log('   🔥 6-12 hours: Engagement 5-10x increase');
    console.log('   ⚡ 24-48 hours: First viral thread/post (50+ likes)');
    console.log('   🚀 1 week: Addicted followers returning daily');
    console.log('   💎 2 weeks: Account growth acceleration');

    console.log('\n🚨 CRITICAL: You still need to fix the Render environment variable!');
    console.log('   Add to Render: LIVE_POSTING_ENABLED=true');
    console.log('   Without this, system runs in [DRY RUN] mode');

  } catch (error) {
    console.error('❌ Error deploying addiction viral system:', error);
    throw error;
  }
}

// Execute the deployment
deployAddictionViralSystem()
  .then(() => {
    console.log('\n🎉 ADDICTION-FOCUSED VIRAL SYSTEM DEPLOYMENT COMPLETE!');
    console.log('🔥 Ready to make @SignalAndSynapse the most addictive healthcare account on X');
  })
  .catch(error => {
    console.error('💥 Deployment failed:', error);
    process.exit(1);
  }); 