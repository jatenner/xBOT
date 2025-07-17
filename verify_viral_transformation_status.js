#!/usr/bin/env node

/**
 * 🔍 VERIFY VIRAL TRANSFORMATION STATUS
 * ====================================
 * 
 * This script checks if our viral transformation is ACTUALLY working
 * or if Render environment variables are blocking it.
 */

const { createClient } = require('@supabase/supabase-js');

async function verifyViralTransformationStatus() {
  console.log('🔍 VERIFYING VIRAL TRANSFORMATION STATUS');
  console.log('=======================================');
  
  const supabaseUrl = process.env.SUPABASE_URL || "https://qtgjmaelglghnlahqpbl.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Z2ptYWVsZ2xnaG5sYWhxcGJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYwNjUxMCwiZXhwIjoyMDY1MTgyNTEwfQ.Gze-MRjDg592T02LpyTlyXt14QkiIgRFgvnMeUchUfU";
  
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  console.log('\n🔍 DIAGNOSTIC CHECKS:');
  console.log('====================');
  
  // 1. Check bot configuration
  try {
    const { data: configs, error: configError } = await supabase
      .from('bot_config')
      .select('*')
      .in('key', [
        'emergency_mode',
        'viral_mode_active', 
        'content_strategy',
        'posting_schedule_type',
        'max_posts_per_day'
      ]);
    
    if (configError) {
      console.log('⚠️  Database config check failed:', configError.message);
    } else {
      console.log('\n📊 CURRENT BOT CONFIGURATION:');
      configs.forEach(config => {
        const status = config.key === 'emergency_mode' && config.value === 'false' ? '✅' : 
                      config.key === 'viral_mode_active' && config.value === 'true' ? '✅' :
                      config.key === 'content_strategy' && config.value.includes('viral') ? '✅' : '❌';
        console.log(`${status} ${config.key}: ${config.value}`);
      });
    }
  } catch (error) {
    console.log('❌ Config check failed:', error.message);
  }
  
  // 2. Check recent posts for viral content
  try {
    const { data: recentPosts, error: postsError } = await supabase
      .from('tweets')
      .select('content, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (postsError) {
      console.log('⚠️  Recent posts check failed:', postsError.message);
    } else {
      console.log('\n📝 RECENT POSTS ANALYSIS:');
      console.log('========================');
      
      let viralIndicators = 0;
      let academicIndicators = 0;
      
      recentPosts.forEach((post, index) => {
        const content = post.content;
        const isViral = /^(Hot take:|Unpopular opinion:|Plot twist:|Behind the scenes:|What they don't tell you)/i.test(content);
        const isAcademic = /Recent studies|research demonstrates|clinical trial|peer-reviewed|systematic review/i.test(content);
        
        if (isViral) viralIndicators++;
        if (isAcademic) academicIndicators++;
        
        const status = isViral ? '🔥 VIRAL' : isAcademic ? '📚 ACADEMIC' : '❓ NEUTRAL';
        console.log(`${index + 1}. ${status}: ${content.substring(0, 80)}...`);
      });
      
      console.log(`\n📊 CONTENT ANALYSIS:`);
      console.log(`🔥 Viral indicators: ${viralIndicators}/5 posts`);
      console.log(`📚 Academic indicators: ${academicIndicators}/5 posts`);
      
      if (viralIndicators >= 3) {
        console.log('✅ VIRAL TRANSFORMATION: ACTIVE');
      } else if (academicIndicators >= 3) {
        console.log('❌ EMERGENCY MODE: STILL BLOCKING VIRAL CONTENT');
      } else {
        console.log('⚠️  TRANSFORMATION: PARTIALLY ACTIVE');
      }
    }
  } catch (error) {
    console.log('❌ Posts analysis failed:', error.message);
  }
  
  // 3. Check posting schedule
  try {
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('bot_dashboard')
      .select('*')
      .eq('plan_date', new Date().toISOString().split('T')[0])
      .order('created_at', { ascending: true });
      
    if (scheduleError) {
      console.log('⚠️  Schedule check failed:', scheduleError.message);
    } else {
      console.log('\n⏰ TODAY\'S POSTING SCHEDULE:');
      console.log('===========================');
      
      if (scheduleData.length === 0) {
        console.log('❌ NO PLANNED POSTS - Emergency mode may be blocking scheduler');
      } else {
        scheduleData.forEach((plan, index) => {
          const date = plan.plan_date;
          const postsCount = Array.isArray(plan.planned_posts_json) ? plan.planned_posts_json.length : 0;
          console.log(`${index + 1}. ${date}: ${postsCount} posts planned`);
        });
        
        const totalPlanned = scheduleData.reduce((sum, plan) => {
          return sum + (Array.isArray(plan.planned_posts_json) ? plan.planned_posts_json.length : 0);
        }, 0);
        
        if (totalPlanned >= 6) {
          console.log('✅ DISTRIBUTED SCHEDULE: ACTIVE');
        } else if (totalPlanned <= 3) {
          console.log('❌ EMERGENCY SCHEDULE: Limited posts detected');
        } else {
          console.log('⚠️  HYBRID SCHEDULE: Partial activation');
        }
      }
    }
  } catch (error) {
    console.log('❌ Schedule analysis failed:', error.message);
  }
  
  // 4. Environment variable diagnostics
  console.log('\n🌍 ENVIRONMENT VARIABLE DIAGNOSIS:');
  console.log('==================================');
  console.log(`EMERGENCY_MODE (from env): ${process.env.EMERGENCY_MODE || 'not set'}`);
  console.log(`VIRAL_MODE (from env): ${process.env.VIRAL_MODE || 'not set'}`);
  console.log(`LIVE_POSTING_ENABLED: ${process.env.LIVE_POSTING_ENABLED || 'not set'}`);
  
  // 5. Final recommendation
  console.log('\n🎯 RECOMMENDATION:');
  console.log('==================');
  
  if (process.env.EMERGENCY_MODE === 'true') {
    console.log('🚨 CRITICAL ISSUE FOUND:');
    console.log('   Render environment variable EMERGENCY_MODE=true is blocking ALL viral transformation!');
    console.log('');
    console.log('🔧 IMMEDIATE ACTION REQUIRED:');
    console.log('   1. Log into Render dashboard');
    console.log('   2. Go to your xBOT service');
    console.log('   3. Navigate to Environment tab');
    console.log('   4. Change EMERGENCY_MODE from "true" to "false"');
    console.log('   5. Click "Save" and redeploy');
    console.log('');
    console.log('📈 EXPECTED RESULT:');
    console.log('   Within 1 hour: Viral content posts ("Hot take:", "Unpopular opinion:")');
    console.log('   Within 24 hours: 5-10x engagement increase');
    console.log('   Within 48 hours: Follower growth acceleration');
  } else {
    console.log('✅ Environment variables look good!');
    console.log('   If viral transformation isn\'t working, check database configuration above.');
  }
  
  console.log('\n🔄 VERIFICATION COMPLETE');
  console.log('========================');
}

// Run the verification
verifyViralTransformationStatus().catch(console.error); 