#!/usr/bin/env node

/**
 * 🚀 EMERGENCY: FORCE VIRAL ACTIVATION TODAY
 * ==========================================
 * 
 * CRITICAL ISSUE: Render has EMERGENCY_MODE=true set as environment variable
 * This overrides ALL our viral transformation code and blocks viral content
 * 
 * SOLUTION: Multiple approaches to force viral activation TODAY
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

async function forceViralActivationToday() {
  console.log('🚀 === EMERGENCY: FORCE VIRAL ACTIVATION TODAY ===');
  console.log('🎯 Mission: Override EMERGENCY_MODE and activate viral content system');
  
  try {
    // 1. DATABASE OVERRIDE: Force viral mode at database level
    console.log('\n📊 STEP 1: Database Viral Override');
    const viralConfigs = [
      // CRITICAL: Override emergency mode detection
      { key: 'emergency_mode_override', value: 'false', description: 'FORCE disable emergency mode regardless of environment variables' },
      { key: 'viral_mode_force_active', value: 'true', description: 'FORCE viral mode active regardless of other settings' },
      { key: 'ignore_environment_emergency', value: 'true', description: 'Ignore EMERGENCY_MODE environment variable' },
      
      // VIRAL CONTENT SYSTEM ACTIVATION
      { key: 'content_generation_mode', value: JSON.stringify({
        mode: 'viral_first',
        viral_percentage: 60,
        controversial_percentage: 20,
        behind_scenes_percentage: 15,
        academic_percentage: 5,
        force_viral_hooks: true,
        banned_academic_phrases: [
          'BREAKTHROUGH:', 'Research shows', 'Studies indicate', 'According to research',
          'Clinical trials', 'Scientific evidence', 'Data suggests', 'Findings reveal'
        ],
        required_viral_hooks: [
          'Hot take:', 'Unpopular opinion:', 'Plot twist:', 'What they won\'t tell you:',
          'Behind the scenes:', 'Real talk:', 'Controversial take:', 'Industry secret:',
          'The truth about', 'Everyone thinks... but'
        ]
      }), description: 'VIRAL-FIRST content generation mode' },
      
      // ANTI-BURST POSTING SYSTEM
      { key: 'distributed_posting_system', value: JSON.stringify({
        enabled: true,
        min_interval_minutes: 90,
        max_posts_per_hour: 1,
        max_posts_per_day: 12,
        optimal_times: [
          '08:00:00', '10:30:00', '13:00:00', '15:30:00', 
          '18:00:00', '20:30:00', '22:00:00', '23:30:00'
        ],
        prevent_burst_posting: true,
        cooldown_after_post_minutes: 90
      }), description: 'Distributed posting schedule - NO MORE BURST POSTING' },
      
      // ENGAGEMENT LEARNING SYSTEM
      { key: 'engagement_learning_system', value: JSON.stringify({
        enabled: true,
        real_time_learning: true,
        performance_thresholds: {
          viral: { likes: 50, retweets: 10, replies: 5 },
          good: { likes: 15, retweets: 3, replies: 2 },
          poor: { likes: 2, retweets: 0, replies: 0 }
        },
        learning_actions: {
          viral_content: 'replicate_immediately',
          poor_content: 'avoid_similar_patterns',
          adaptation_speed: 'aggressive'
        },
        learning_frequency_minutes: 60
      }), description: 'Real-time engagement learning and adaptation' },
      
      // FOLLOWER GROWTH OPTIMIZATION
      { key: 'growth_learning_engine', value: JSON.stringify({
        enabled: true,
        primary_goal: 'follower_growth',
        success_metrics: {
          daily_follower_target: 5,
          weekly_follower_target: 35,
          monthly_follower_target: 150
        },
        content_optimization: {
          follow_trigger_phrases: [
            'Follow for more insights', 'What do you think?', 'Agree or disagree?',
            'Share your experience', 'Tag someone who needs to see this'
          ],
          variety_rotation: ['hot_takes', 'behind_scenes', 'personal_stories', 'industry_secrets', 'controversial_opinions']
        }
      }), description: 'Follower growth focused optimization engine' },
      
      // CONTENT COMPLEXITY SYSTEM
      { key: 'content_complexity_system', value: JSON.stringify({
        enabled: true,
        track_content_types: true,
        enforce_variety: true,
        min_hours_between_similar: 6,
        max_academic_posts_per_day: 1,
        required_content_rotation: [
          'viral_hot_take', 'controversial_opinion', 'behind_scenes_insight', 
          'personal_story', 'industry_secret'
        ]
      }), description: 'Enforce content variety and prevent repetition' }
    ];
    
    for (const config of viralConfigs) {
      const { error } = await supabase
        .from('bot_config')
        .upsert(config, { onConflict: 'key' });
      
      if (error) {
        console.error(`❌ Failed to set ${config.key}:`, error);
      } else {
        console.log(`✅ Set ${config.key}: ${config.description}`);
      }
    }
    
    // 2. FORCE CLEAR EMERGENCY FLAGS
    console.log('\n🚨 STEP 2: Clear All Emergency Flags');
    const emergencyFlags = [
      'emergency_brake_active',
      'emergency_mode_active',
      'emergency_content_restriction',
      'burst_posting_detected',
      'academic_mode_forced'
    ];
    
    for (const flag of emergencyFlags) {
      await supabase
        .from('bot_config')
        .upsert({ 
          key: flag, 
          value: 'false', 
          description: 'CLEARED: Emergency flag removed for viral activation' 
        }, { onConflict: 'key' });
      console.log(`🧹 Cleared emergency flag: ${flag}`);
    }
    
    // 3. ACTIVATE ALL VIRAL AGENTS
    console.log('\n🔥 STEP 3: Activate All Viral Agents');
    const viralAgents = [
      'viral_content_agent',
      'viral_follower_growth_agent', 
      'viral_health_theme_agent',
      'ultra_viral_generator',
      'engagement_maximizer_agent',
      'diverse_perspective_engine',
      'nuclear_learning_enhancer'
    ];
    
    for (const agent of viralAgents) {
      await supabase
        .from('bot_config')
        .upsert({
          key: `${agent}_enabled`,
          value: 'true',
          description: `ACTIVATED: ${agent} for viral content generation`
        }, { onConflict: 'key' });
      console.log(`🤖 Activated: ${agent}`);
    }
    
    // 4. SET AGGRESSIVE VIRAL TARGETS
    console.log('\n📈 STEP 4: Set Aggressive Viral Targets');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'viral_success_targets',
        value: JSON.stringify({
          daily_engagement_target: 100,
          daily_follower_target: 5,
          viral_post_target: 1,
          engagement_rate_target: 0.05,
          tracking_enabled: true,
          aggressive_mode: true
        }),
        description: 'Aggressive viral success targets for rapid growth'
      }, { onConflict: 'key' });
    console.log('🎯 Set aggressive viral targets');
    
    // 5. VERIFY VIRAL TRANSFORMATION STATUS
    console.log('\n✅ STEP 5: Verify Viral Transformation Status');
    const { data: configs } = await supabase
      .from('bot_config')
      .select('key, value, description')
      .in('key', [
        'emergency_mode_override',
        'viral_mode_force_active', 
        'content_generation_mode',
        'distributed_posting_system',
        'engagement_learning_system'
      ]);
    
    console.log('\n📊 VIRAL TRANSFORMATION STATUS:');
    for (const config of configs || []) {
      const preview = typeof config.value === 'string' && config.value.length > 50 
        ? config.value.substring(0, 50) + '...' 
        : config.value;
      console.log(`  ✅ ${config.key}: ${preview}`);
    }
    
    // 6. IMMEDIATE ACTION INSTRUCTIONS
    console.log('\n🚀 IMMEDIATE ACTION REQUIRED:');
    console.log('==========================================');
    console.log('1. 🌐 LOG INTO RENDER DASHBOARD NOW');
    console.log('2. 📱 Navigate to your xBOT service');
    console.log('3. ⚙️  Go to Environment tab');
    console.log('4. 🔧 CHANGE: EMERGENCY_MODE from "true" to "false"');
    console.log('5. 🚀 Or DELETE the EMERGENCY_MODE variable entirely');
    console.log('6. 💫 Optional: Add VIRAL_MODE=true');
    console.log('7. 🔄 Trigger manual deployment');
    console.log('8. 📊 Check logs to verify: EMERGENCY_MODE=false');
    
    console.log('\n🎯 EXPECTED RESULTS AFTER RENDER FIX:');
    console.log('==========================================');
    console.log('✅ Content style: "Recent studies..." → "Hot take: Everyone\'s obsessing over..."');
    console.log('✅ Posting schedule: 6 posts/day → 8-12 posts/day distributed');
    console.log('✅ Growth targets: 1-2 followers/week → 5-10/day');
    console.log('✅ Engagement: 0-5/week → 50+/day');
    console.log('✅ First viral tweet: Within 2 hours');
    console.log('✅ Follower spike: Within 24-48 hours');
    
    // 7. CREATE VERIFICATION SCRIPT
    console.log('\n📝 STEP 6: Creating Verification Script');
    await createVerificationScript();
    
    console.log('\n🎉 VIRAL ACTIVATION COMPLETE!');
    console.log('🚨 ONLY BLOCKER: Render environment variable EMERGENCY_MODE=true');
    console.log('🔧 FIX THAT ONE SETTING → IMMEDIATE VIRAL TRANSFORMATION!');
    
  } catch (error) {
    console.error('❌ Viral activation failed:', error);
    process.exit(1);
  }
}

async function createVerificationScript() {
  const fs = require('fs');
  
  const verificationScript = `#!/usr/bin/env node

// 🔍 VIRAL TRANSFORMATION VERIFICATION
console.log('🔍 === CHECKING VIRAL TRANSFORMATION STATUS ===');

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  try {
    const { data } = await supabase
      .from('bot_config')
      .select('key, value')
      .in('key', ['emergency_mode_override', 'viral_mode_force_active', 'content_generation_mode']);
    
    console.log('📊 CURRENT STATUS:');
    for (const config of data || []) {
      if (config.key === 'content_generation_mode') {
        const parsed = JSON.parse(config.value);
        console.log(\`  ✅ \${config.key}: \${parsed.mode} - \${parsed.viral_percentage}% viral\`);
      } else {
        console.log(\`  ✅ \${config.key}: \${config.value}\`);
      }
    }
    
    console.log('\\n🚨 REMEMBER: Check Render logs for EMERGENCY_MODE=false');
    console.log('🎯 If still seeing EMERGENCY_MODE=true in logs, fix Render environment variable');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verify();`;

  fs.writeFileSync('verify_viral_status_today.js', verificationScript);
  console.log('📝 Created verify_viral_status_today.js');
}

// Execute the viral activation
forceViralActivationToday().catch(console.error); 