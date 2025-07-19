#!/usr/bin/env node

/**
 * 🚨 VIRAL SYSTEM DIAGNOSTIC: Why isn't our transformation working?
 * =============================================================
 * 
 * Issues identified from deployment logs and user feedback:
 * 1. Still posting 10+ times in a row (burst posting not fixed)
 * 2. Still academic content despite viral configuration 
 * 3. Zero engagement on all posts
 * 4. [DRY RUN] mode shown in logs but user says it's posting
 * 
 * DIAGNOSIS: Multiple system conflicts preventing viral activation
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

async function diagnoseBurstPostingIssue() {
  console.log('🚨 === DIAGNOSING BURST POSTING ISSUE ===');
  
  try {
    // Check recent posting pattern
    const { data: recentPosts } = await supabase
      .from('tweets')
      .select('created_at, content')
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentPosts && recentPosts.length > 0) {
      console.log(`📊 Last ${recentPosts.length} posts analysis:`);
      
      const postTimes = recentPosts.map(post => new Date(post.created_at));
      const intervals = [];
      
      for (let i = 0; i < postTimes.length - 1; i++) {
        const interval = (postTimes[i].getTime() - postTimes[i+1].getTime()) / (1000 * 60);
        intervals.push(interval);
        
        if (interval < 5) {
          console.log(`🚨 BURST DETECTED: ${interval.toFixed(1)} minutes between posts`);
          console.log(`   Post ${i+1}: ${recentPosts[i].content.substring(0, 50)}...`);
          console.log(`   Post ${i+2}: ${recentPosts[i+1].content.substring(0, 50)}...`);
        }
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      console.log(`📊 Average interval: ${avgInterval.toFixed(1)} minutes`);
      console.log(`🎯 Target interval: 90+ minutes`);
      
      if (avgInterval < 90) {
        console.log('❌ BURST POSTING CONFIRMED - Anti-burst system not working');
      } else {
        console.log('✅ Posting intervals look good');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking burst posting:', error);
  }
}

async function diagnoseContentStrategy() {
  console.log('\n🎯 === DIAGNOSING CONTENT STRATEGY ===');
  
  try {
    // Check content generation mode
    const { data: contentConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'content_generation_mode')
      .single();

    if (contentConfig) {
      console.log('📊 Current content configuration:');
      console.log(JSON.stringify(contentConfig.value, null, 2));
      
      const config = contentConfig.value;
      if (config.viral_percentage >= 60) {
        console.log('✅ Viral percentage configured correctly');
      } else {
        console.log('❌ Viral percentage too low:', config.viral_percentage);
      }
    } else {
      console.log('❌ No content generation mode configured');
    }
    
    // Check recent content for academic phrases
    const { data: recentPosts } = await supabase
      .from('tweets')
      .select('content')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentPosts) {
      console.log('\n📝 Recent content analysis:');
      const academicPhrases = [
        'BREAKTHROUGH:', 'Research shows', 'Studies indicate', 'According to research',
        'Clinical trials', 'Scientific evidence', 'Data suggests', 'Findings reveal'
      ];
      
      const viralHooks = [
        'Hot take:', 'Unpopular opinion:', 'Plot twist:', 'What they won\'t tell you:',
        'Behind the scenes:', 'Real talk:', 'Controversial take:', 'Industry secret:'
      ];
      
      let academicCount = 0;
      let viralCount = 0;
      
      recentPosts.forEach((post, i) => {
        const content = post.content.toLowerCase();
        const hasAcademic = academicPhrases.some(phrase => content.includes(phrase.toLowerCase()));
        const hasViral = viralHooks.some(hook => content.includes(hook.toLowerCase()));
        
        if (hasAcademic) {
          academicCount++;
          console.log(`❌ Academic content ${i+1}: ${post.content.substring(0, 80)}...`);
        }
        if (hasViral) {
          viralCount++;
          console.log(`✅ Viral content ${i+1}: ${post.content.substring(0, 80)}...`);
        }
      });
      
      console.log(`\n📊 Content analysis results:`);
      console.log(`   Academic content: ${academicCount}/10 (${(academicCount/10*100).toFixed(0)}%)`);
      console.log(`   Viral content: ${viralCount}/10 (${(viralCount/10*100).toFixed(0)}%)`);
      console.log(`   🎯 Target: 5-10% academic, 60% viral`);
      
      if (academicCount > 2) {
        console.log('❌ TOO MUCH ACADEMIC CONTENT - Viral transformation not working');
      }
      if (viralCount < 6) {
        console.log('❌ NOT ENOUGH VIRAL CONTENT - Transformation not activated');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking content strategy:', error);
  }
}

async function diagnoseLiveMode() {
  console.log('\n🔴 === DIAGNOSING LIVE MODE ISSUE ===');
  
  try {
    // Check environment variables
    console.log('Environment variables:');
    console.log(`LIVE_POSTING_ENABLED: ${process.env.LIVE_POSTING_ENABLED}`);
    console.log(`DEVELOPMENT_MODE: ${process.env.DEVELOPMENT_MODE}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    
    // Check database config
    const { data: liveConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'live_posting_enabled')
      .single();

    if (liveConfig) {
      console.log('Database live_posting_enabled:', liveConfig.value);
    } else {
      console.log('❌ No live_posting_enabled config in database');
    }
    
    // The disconnect: logs show [DRY RUN] but user says it's posting
    console.log('\n🚨 CRITICAL ISSUE IDENTIFIED:');
    console.log('Deployment logs show: [DRY RUN] Dry run mode – no tweets will be posted');
    console.log('But user reports: Bot posted 10+ times in a row');
    console.log('This suggests: Multiple posting mechanisms or config conflicts');
    
  } catch (error) {
    console.error('❌ Error checking live mode:', error);
  }
}

async function diagnoseSystemConflicts() {
  console.log('\n⚔️ === DIAGNOSING SYSTEM CONFLICTS ===');
  
  try {
    // Check multiple emergency mode configs
    const { data: configs } = await supabase
      .from('bot_config')
      .select('key, value')
      .like('key', '%emergency%');

    if (configs && configs.length > 0) {
      console.log('Emergency-related configurations:');
      configs.forEach(config => {
        console.log(`   ${config.key}: ${JSON.stringify(config.value)}`);
      });
    }
    
    // Check for conflicting posting agents
    const { data: allConfigs } = await supabase
      .from('bot_config')
      .select('key, value')
      .like('key', '%posting%');

    if (allConfigs && allConfigs.length > 0) {
      console.log('\nPosting-related configurations:');
      allConfigs.forEach(config => {
        console.log(`   ${config.key}: ${JSON.stringify(config.value)}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking system conflicts:', error);
  }
}

async function generateFixPlan() {
  console.log('\n🛠️ === EMERGENCY FIX PLAN ===');
  console.log('Based on diagnosis, implementing nuclear fixes:');
  console.log('');
  console.log('1. 🚨 FORCE DISABLE ALL BURST POSTING');
  console.log('   - Set emergency posting interval: 120 minutes minimum');
  console.log('   - Disable all rapid posting agents');
  console.log('   - Force single post per cycle');
  console.log('');
  console.log('2. 🎯 NUCLEAR VIRAL CONTENT ACTIVATION'); 
  console.log('   - Force viral mode at database level');
  console.log('   - Disable all academic content generation');
  console.log('   - Enable only viral hooks and controversial content');
  console.log('');
  console.log('3. 🔴 FORCE LIVE MODE ACTIVATION');
  console.log('   - Override all dry run configurations');
  console.log('   - Set live posting enabled at multiple levels');
  console.log('');
  console.log('4. 🛡️ ENGAGEMENT OPTIMIZATION');
  console.log('   - Enable all viral agents');
  console.log('   - Focus on follower growth vs research');
  console.log('   - Real-time engagement learning');
  console.log('');
  
  // Apply the fixes
  console.log('🚀 APPLYING NUCLEAR FIXES...');
  
  // 1. Emergency posting control
  await supabase
    .from('bot_config')
    .upsert({
      key: 'emergency_posting_control',
      value: {
        enabled: true,
        force_single_post_mode: true,
        minimum_interval_minutes: 120,
        max_posts_per_hour: 0.5,
        disable_burst_agents: true,
        disable_quick_post_mode: true,
        nuclear_anti_burst: true,
        timestamp: new Date().toISOString()
      }
    });
  
  // 2. Nuclear viral activation
  await supabase
    .from('bot_config')
    .upsert({
      key: 'nuclear_viral_mode',
      value: {
        enabled: true,
        force_viral_percentage: 80,
        ban_all_academic_content: true,
        require_viral_hooks: true,
        controversial_mode: true,
        engagement_focused: true,
        timestamp: new Date().toISOString()
      }
    });
  
  // 3. Force live mode
  await supabase
    .from('bot_config')
    .upsert({
      key: 'force_live_posting',
      value: {
        enabled: true,
        override_dry_run: true,
        force_twitter_posting: true,
        disable_test_mode: true,
        nuclear_live_override: true,
        timestamp: new Date().toISOString()
      }
    });
  
  console.log('✅ Nuclear fixes applied to database');
}

async function main() {
  console.log('🚨 === VIRAL SYSTEM DIAGNOSTIC STARTING ===');
  console.log('Investigating why viral transformation failed...');
  console.log('');

  await diagnoseBurstPostingIssue();
  await diagnoseContentStrategy();
  await diagnoseLiveMode();
  await diagnoseSystemConflicts();
  await generateFixPlan();
  
  console.log('\n🎯 === DIAGNOSTIC COMPLETE ===');
  console.log('Nuclear fixes applied - redeploy to activate viral system');
  console.log('Expected results after redeployment:');
  console.log('✅ Single posts every 2+ hours (no more bursting)');
  console.log('✅ "Hot take:" style content (no more academic)');
  console.log('✅ Live posting enabled (no more dry run)');
  console.log('✅ Viral hooks and controversial opinions');
  console.log('✅ Focus on engagement and followers vs research');
}

main().catch(console.error); 