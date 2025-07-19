#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE SYSTEM AUDIT
 * ============================
 * 
 * Audits all systems to ensure:
 * 1. NO MORE 17+ tweet bursts
 * 2. Sophisticated viral content strategy active
 * 3. Intelligent posting timing and engagement optimization
 * 4. Complex AI decision-making systems operational
 * 5. All learning and growth systems functioning
 * 
 * This audit validates our emergency fixes are working and the system
 * is operating with methodical intelligence, not basic automation.
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

async function comprehensiveSystemAudit() {
  console.log('🔍 === COMPREHENSIVE SYSTEM AUDIT ===');
  console.log('🎯 Mission: Validate sophisticated AI posting system');
  console.log('⚡ Ensuring NO burst posting + Complex viral intelligence');
  console.log('');

  const auditResults = {
    burstProtection: {},
    viralContent: {},
    intelligenceSystems: {},
    postingSchedule: {},
    learningAgents: {},
    overall: {}
  };

  try {
    // ===== AUDIT 1: BURST POSTING PROTECTION =====
    console.log('🛡️ AUDIT 1: BURST POSTING PROTECTION SYSTEMS');
    console.log('==============================================');

    // Check if catch-up posting is disabled
    const { data: catchupConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'disable_strategic_catch_up')
      .single();

    if (catchupConfig?.value?.catch_up_posting_disabled) {
      console.log('✅ Strategic catch-up posting: DISABLED (prevents bursts)');
      auditResults.burstProtection.catchupDisabled = true;
    } else {
      console.log('❌ Strategic catch-up posting: ENABLED (could cause bursts)');
      auditResults.burstProtection.catchupDisabled = false;
    }

    // Check unified daily target
    const { data: unifiedTarget } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'unified_daily_target')
      .single();

    if (unifiedTarget?.value) {
      const target = unifiedTarget.value;
      console.log(`✅ Unified daily target: ${target.max_posts_per_day} posts/day`);
      console.log(`   Max per hour: ${target.max_posts_per_hour}`);
      console.log(`   Min interval: ${target.min_interval_minutes} minutes`);
      auditResults.burstProtection.unifiedTarget = target;
      
      if (target.max_posts_per_day <= 6 && target.max_posts_per_hour <= 1) {
        auditResults.burstProtection.safeTargets = true;
      } else {
        auditResults.burstProtection.safeTargets = false;
      }
    } else {
      console.log('❌ Unified daily target: NOT SET (could default to unsafe values)');
      auditResults.burstProtection.unifiedTarget = null;
      auditResults.burstProtection.safeTargets = false;
    }

    // Check distributed schedule
    const { data: distributedSchedule } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'perfect_distributed_schedule')
      .single();

    if (distributedSchedule?.value?.enabled) {
      console.log('✅ Distributed schedule: ACTIVE');
      console.log(`   Daily schedule: ${distributedSchedule.value.daily_schedule.length} time slots`);
      console.log(`   Min interval: ${distributedSchedule.value.min_interval_minutes} minutes`);
      auditResults.burstProtection.distributedSchedule = true;
    } else {
      console.log('❌ Distributed schedule: INACTIVE (could allow bursts)');
      auditResults.burstProtection.distributedSchedule = false;
    }

    // ===== AUDIT 2: VIRAL CONTENT SYSTEMS =====
    console.log('\n🔥 AUDIT 2: VIRAL CONTENT & INTELLIGENCE SYSTEMS');
    console.log('================================================');

    // Check emergency mode overrides
    const emergencyOverrides = [
      'EMERGENCY_MODE_OVERRIDE',
      'emergency_mode_active',
      'force_viral_mode',
      'viral_transformation_active'
    ];

    let viralModeActive = true;
    for (const key of emergencyOverrides) {
      const { data: config } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', key)
        .single();

      if (config?.value) {
        const isActive = config.value === 'true' || config.value === true;
        if (key.includes('emergency') || key.includes('EMERGENCY')) {
          // Emergency modes should be false
          if (!isActive) {
            console.log(`✅ ${key}: DISABLED (good)`);
          } else {
            console.log(`❌ ${key}: ENABLED (blocks viral content)`);
            viralModeActive = false;
          }
        } else {
          // Viral modes should be true
          if (isActive) {
            console.log(`✅ ${key}: ENABLED (good)`);
          } else {
            console.log(`❌ ${key}: DISABLED (limits viral content)`);
            viralModeActive = false;
          }
        }
      } else {
        console.log(`⚠️ ${key}: NOT SET`);
      }
    }
    auditResults.viralContent.modeActive = viralModeActive;

    // Check viral content strategy
    const { data: viralStrategy } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'viral_content_strategy')
      .single();

    if (viralStrategy?.value) {
      const strategy = viralStrategy.value;
      console.log('✅ Viral content strategy: CONFIGURED');
      console.log(`   Viral percentage: ${strategy.viral_percentage}%`);
      console.log(`   Controversial: ${strategy.controversial_percentage}%`);
      console.log(`   Academic: ${strategy.academic_percentage}%`);
      console.log(`   Viral hooks: ${strategy.force_viral_hooks ? 'REQUIRED' : 'OPTIONAL'}`);
      
      auditResults.viralContent.strategy = strategy;
      auditResults.viralContent.viralFirst = strategy.viral_percentage >= 50;
    } else {
      console.log('❌ Viral content strategy: NOT CONFIGURED');
      auditResults.viralContent.strategy = null;
      auditResults.viralContent.viralFirst = false;
    }

    // Check viral content types
    const { data: viralTypes } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'viral_content_types')
      .single();

    if (viralTypes?.value) {
      console.log('✅ Viral content types: CONFIGURED');
      const types = Object.entries(viralTypes.value);
      types.forEach(([type, weight]) => {
        console.log(`   ${type}: ${weight}%`);
      });
      auditResults.viralContent.typesConfigured = true;
    } else {
      console.log('❌ Viral content types: NOT CONFIGURED');
      auditResults.viralContent.typesConfigured = false;
    }

    // ===== AUDIT 3: INTELLIGENCE & LEARNING SYSTEMS =====
    console.log('\n🧠 AUDIT 3: INTELLIGENCE & LEARNING SYSTEMS');
    console.log('===========================================');

    // Check if learning agents are enabled
    const learningAgents = [
      'engagement_learning_system',
      'growth_learning_engine',
      'adaptive_content_learner_config',
      'competitive_intelligence_config'
    ];

    let learningSystemsActive = 0;
    for (const agent of learningAgents) {
      const { data: config } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', agent)
        .single();

      if (config?.value?.enabled) {
        console.log(`✅ ${agent}: ACTIVE`);
        learningSystemsActive++;
      } else {
        console.log(`❌ ${agent}: INACTIVE`);
      }
    }

    auditResults.learningAgents.activeCount = learningSystemsActive;
    auditResults.learningAgents.totalCount = learningAgents.length;
    auditResults.learningAgents.percentageActive = (learningSystemsActive / learningAgents.length) * 100;

    // Check intelligent posting decision system
    const { data: intelligentPosting } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'intelligent_posting_config')
      .single();

    if (intelligentPosting?.value?.enabled) {
      console.log('✅ Intelligent posting decisions: ACTIVE');
      auditResults.intelligenceSystems.intelligentPosting = true;
    } else {
      console.log('❌ Intelligent posting decisions: INACTIVE');
      auditResults.intelligenceSystems.intelligentPosting = false;
    }

    // ===== AUDIT 4: CURRENT POSTING STATE =====
    console.log('\n📊 AUDIT 4: CURRENT POSTING STATE & RECENT ACTIVITY');
    console.log('===================================================');

    // Get today's posting state
    const today = new Date().toISOString().split('T')[0];
    const { data: dailyState } = await supabase
      .from('daily_posting_state')
      .select('*')
      .eq('date', today)
      .single();

    if (dailyState) {
      console.log('✅ Daily posting state: FOUND');
      console.log(`   Posts completed: ${dailyState.posts_completed}`);
      console.log(`   Posts target: ${dailyState.posts_target}`);
      console.log(`   Max daily tweets: ${dailyState.max_daily_tweets}`);
      console.log(`   Emergency mode: ${dailyState.emergency_mode ? 'YES' : 'NO'}`);
      console.log(`   Strategy: ${dailyState.strategy || 'default'}`);
      
      auditResults.postingSchedule.dailyState = dailyState;
      auditResults.postingSchedule.onTrack = dailyState.posts_completed <= dailyState.posts_target;
    } else {
      console.log('❌ Daily posting state: NOT FOUND');
      auditResults.postingSchedule.dailyState = null;
    }

    // Get recent tweets to check for burst patterns
    const { data: recentTweets } = await supabase
      .from('tweets')
      .select('created_at, content')
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentTweets && recentTweets.length > 0) {
      console.log(`📝 Recent tweets today: ${recentTweets.length}`);
      
      // Check for burst patterns (multiple tweets within short time)
      let burstDetected = false;
      if (recentTweets.length > 1) {
        for (let i = 0; i < recentTweets.length - 1; i++) {
          const tweet1Time = new Date(recentTweets[i].created_at);
          const tweet2Time = new Date(recentTweets[i + 1].created_at);
          const timeDiff = Math.abs(tweet1Time - tweet2Time) / (1000 * 60); // minutes
          
          if (timeDiff < 60) { // Less than 1 hour apart
            burstDetected = true;
            console.log(`⚠️ Potential burst: ${timeDiff.toFixed(1)} minutes between tweets`);
          }
        }
      }
      
      if (!burstDetected) {
        console.log('✅ No burst patterns detected in recent tweets');
      }
      
      auditResults.postingSchedule.recentTweets = recentTweets.length;
      auditResults.postingSchedule.burstDetected = burstDetected;

      // Check content for viral indicators
      let viralContent = 0;
      let academicContent = 0;
      const viralHooks = ['Hot take:', 'Unpopular opinion:', 'Plot twist:', 'Behind the scenes:', 'What they don\'t tell you'];
      const academicPhrases = ['BREAKTHROUGH:', 'Research shows', 'Studies indicate', 'Clinical trials'];

      recentTweets.forEach(tweet => {
        const content = tweet.content.toLowerCase();
        const hasViralHook = viralHooks.some(hook => content.includes(hook.toLowerCase()));
        const hasAcademicPhrase = academicPhrases.some(phrase => content.includes(phrase.toLowerCase()));
        
        if (hasViralHook) viralContent++;
        if (hasAcademicPhrase) academicContent++;
      });

      console.log(`📈 Content analysis (last ${recentTweets.length} tweets):`);
      console.log(`   Viral content: ${viralContent} tweets (${((viralContent/recentTweets.length)*100).toFixed(1)}%)`);
      console.log(`   Academic content: ${academicContent} tweets (${((academicContent/recentTweets.length)*100).toFixed(1)}%)`);
      
      auditResults.viralContent.recentViralPercentage = (viralContent/recentTweets.length)*100;
      auditResults.viralContent.recentAcademicPercentage = (academicContent/recentTweets.length)*100;
    } else {
      console.log('📝 No tweets found today');
      auditResults.postingSchedule.recentTweets = 0;
    }

    // ===== AUDIT 5: SYSTEM COMPLEXITY & SOPHISTICATION =====
    console.log('\n🎯 AUDIT 5: SYSTEM COMPLEXITY & SOPHISTICATION');
    console.log('==============================================');

    // Check for advanced agent configurations
    const sophisticatedAgents = [
      'ultra_viral_generator_config',
      'engagement_maximizer_config',
      'human_expert_personality_config',
      'diverse_perspective_engine_config',
      'trend_research_fusion_config'
    ];

    let sophisticatedSystemsActive = 0;
    for (const agent of sophisticatedAgents) {
      const { data: config } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', agent)
        .single();

      if (config?.value) {
        console.log(`✅ ${agent}: CONFIGURED`);
        sophisticatedSystemsActive++;
      } else {
        console.log(`⚠️ ${agent}: NOT CONFIGURED`);
      }
    }

    auditResults.intelligenceSystems.sophisticatedAgents = sophisticatedSystemsActive;
    auditResults.intelligenceSystems.sophisticationScore = (sophisticatedSystemsActive / sophisticatedAgents.length) * 100;

    // Check for complex decision-making systems
    const complexSystems = [
      'intelligent_rate_limit_manager_config',
      'strategic_opportunity_scheduler_config',
      'timing_optimization_config',
      'engagement_growth_tracker_config'
    ];

    let complexSystemsActive = 0;
    for (const system of complexSystems) {
      const { data: config } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', system)
        .single();

      if (config?.value?.enabled) {
        console.log(`✅ ${system}: ACTIVE`);
        complexSystemsActive++;
      } else {
        console.log(`⚠️ ${system}: INACTIVE`);
      }
    }

    auditResults.intelligenceSystems.complexSystems = complexSystemsActive;

    // ===== FINAL AUDIT RESULTS =====
    console.log('\n🏆 === COMPREHENSIVE AUDIT RESULTS ===');
    console.log('=====================================');

    // Calculate overall system health
    let healthScore = 0;
    let maxScore = 0;

    // Burst protection (30% of score)
    maxScore += 30;
    if (auditResults.burstProtection.catchupDisabled) healthScore += 10;
    if (auditResults.burstProtection.safeTargets) healthScore += 10;
    if (auditResults.burstProtection.distributedSchedule) healthScore += 10;

    // Viral content (25% of score)
    maxScore += 25;
    if (auditResults.viralContent.modeActive) healthScore += 10;
    if (auditResults.viralContent.viralFirst) healthScore += 10;
    if (auditResults.viralContent.typesConfigured) healthScore += 5;

    // Intelligence systems (25% of score)
    maxScore += 25;
    healthScore += (auditResults.learningAgents.percentageActive / 100) * 15;
    healthScore += (auditResults.intelligenceSystems.sophisticationScore / 100) * 10;

    // Posting behavior (20% of score)
    maxScore += 20;
    if (auditResults.postingSchedule.recentTweets <= 6) healthScore += 10;
    if (!auditResults.postingSchedule.burstDetected) healthScore += 10;

    const overallHealthPercentage = (healthScore / maxScore) * 100;
    auditResults.overall.healthScore = healthScore;
    auditResults.overall.maxScore = maxScore;
    auditResults.overall.healthPercentage = overallHealthPercentage;

    console.log(`🎯 OVERALL SYSTEM HEALTH: ${overallHealthPercentage.toFixed(1)}%`);
    console.log('');

    if (overallHealthPercentage >= 80) {
      console.log('✅ SYSTEM STATUS: EXCELLENT');
      console.log('   💎 Sophisticated AI posting with burst protection');
      console.log('   🔥 Viral content strategy operational');
      console.log('   🧠 Complex intelligence systems active');
    } else if (overallHealthPercentage >= 60) {
      console.log('⚠️ SYSTEM STATUS: GOOD (Some improvements needed)');
    } else {
      console.log('❌ SYSTEM STATUS: NEEDS ATTENTION');
    }

    // Specific recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('==================');

    if (!auditResults.burstProtection.catchupDisabled) {
      console.log('🔴 CRITICAL: Enable catch-up posting disable to prevent bursts');
    }
    if (!auditResults.viralContent.modeActive) {
      console.log('🔴 CRITICAL: Activate viral mode for engagement growth');
    }
    if (auditResults.learningAgents.percentageActive < 50) {
      console.log('🟡 MODERATE: Activate more learning agents for sophistication');
    }
    if (auditResults.intelligenceSystems.sophisticationScore < 60) {
      console.log('🟡 MODERATE: Configure more sophisticated agent systems');
    }
    if (auditResults.postingSchedule.burstDetected) {
      console.log('🔴 CRITICAL: Burst posting detected - check distribution');
    }

    if (overallHealthPercentage >= 80) {
      console.log('✅ System is operating at high sophistication level');
      console.log('   Continue monitoring for optimal performance');
    }

    console.log('\n📊 DETAILED SCORES:');
    console.log(`   🛡️ Burst Protection: ${auditResults.burstProtection.catchupDisabled + auditResults.burstProtection.safeTargets + auditResults.burstProtection.distributedSchedule}/3`);
    console.log(`   🔥 Viral Content: ${auditResults.viralContent.modeActive + auditResults.viralContent.viralFirst + auditResults.viralContent.typesConfigured}/3`);
    console.log(`   🧠 Learning Systems: ${auditResults.learningAgents.percentageActive.toFixed(1)}%`);
    console.log(`   🎯 Sophistication: ${auditResults.intelligenceSystems.sophisticationScore.toFixed(1)}%`);

    return auditResults;

  } catch (error) {
    console.error('❌ Audit failed:', error);
    throw error;
  }
}

// Run the comprehensive audit
comprehensiveSystemAudit()
  .then((results) => {
    console.log('\n✅ Comprehensive audit completed');
    console.log(`🎯 Final Health Score: ${results.overall.healthPercentage.toFixed(1)}%`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }); 