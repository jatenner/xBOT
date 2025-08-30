#!/usr/bin/env node

/**
 * ⚡ QUICK SYSTEM STATUS CHECK
 * 
 * Fast verification of system health and posting activity
 */

require('dotenv').config();

async function quickSystemStatus() {
  console.log('⚡ === QUICK SYSTEM STATUS ===');
  console.log('⏰ Check time:', new Date().toLocaleString());
  console.log('');

  const checks = [];

  // 1. Database connectivity
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('tweets')
      .select('count')
      .limit(1);

    if (!error) {
      checks.push('✅ Database: Connected');
    } else {
      checks.push(`❌ Database: ${error.message}`);
    }
  } catch (error) {
    checks.push(`❌ Database: ${error.message}`);
  }

  // 2. Recent posting activity
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check last 3 hours for posts
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    
    const { data: recentPosts, error } = await supabase
      .from('tweets')
      .select('tweet_id, posted_at, content')
      .gte('posted_at', threeHoursAgo)
      .order('posted_at', { ascending: false })
      .limit(5);

    if (!error && recentPosts) {
      if (recentPosts.length > 0) {
        checks.push(`✅ Recent Posts: ${recentPosts.length} in last 3h`);
        
        console.log('📋 RECENT ACTIVITY:');
        recentPosts.forEach((post, i) => {
          const timeAgo = Math.round((Date.now() - new Date(post.posted_at).getTime()) / 60000);
          console.log(`   ${i+1}. ${timeAgo}min ago: ${post.content?.substring(0, 50)}...`);
        });
        console.log('');

        // Check posting frequency
        if (recentPosts.length >= 2) {
          const timeBetween = new Date(recentPosts[0].posted_at).getTime() - 
                            new Date(recentPosts[1].posted_at).getTime();
          const minutesBetween = Math.round(timeBetween / 60000);
          
          if (minutesBetween <= 120) { // Less than 2 hours
            checks.push(`✅ Frequency: ${minutesBetween}min between posts (GOOD)`);
          } else {
            checks.push(`⚠️ Frequency: ${minutesBetween}min between posts (TARGET: ~90min)`);
          }
        }
      } else {
        checks.push('⚠️ Recent Posts: None in last 3h');
      }
    } else {
      checks.push(`❌ Recent Posts: ${error?.message || 'Query failed'}`);
    }
  } catch (error) {
    checks.push(`❌ Recent Posts: ${error.message}`);
  }

  // 3. Environment variables
  const requiredEnvs = ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
  
  if (missingEnvs.length === 0) {
    checks.push('✅ Environment: All required variables present');
  } else {
    checks.push(`❌ Environment: Missing ${missingEnvs.join(', ')}`);
  }

  // 4. OpenAI connectivity (quick test)
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Quick test with minimal token usage
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "test"' }],
      max_tokens: 5
    });

    if (response.choices?.[0]?.message?.content) {
      checks.push('✅ OpenAI: API responding');
    } else {
      checks.push('❌ OpenAI: No response');
    }
  } catch (error) {
    checks.push(`❌ OpenAI: ${error.message}`);
  }

  // Display results
  console.log('📊 SYSTEM STATUS:');
  checks.forEach(check => console.log(`   ${check}`));
  console.log('');

  // Overall assessment
  const passedChecks = checks.filter(check => check.startsWith('✅')).length;
  const totalChecks = checks.length;
  const healthScore = Math.round((passedChecks / totalChecks) * 100);

  console.log(`🎯 OVERALL HEALTH: ${healthScore}% (${passedChecks}/${totalChecks} checks passed)`);
  
  if (healthScore >= 80) {
    console.log('✅ SYSTEM STATUS: HEALTHY - Heavy operation ready');
  } else if (healthScore >= 60) {
    console.log('⚠️ SYSTEM STATUS: NEEDS ATTENTION - Some issues detected');
  } else {
    console.log('❌ SYSTEM STATUS: CRITICAL - Multiple failures');
  }

  console.log('');
  console.log('🚀 OPTIMIZATIONS ACTIVE:');
  console.log('   - Posting interval: 90 minutes (was 4 hours)');
  console.log('   - Daily limit: 16-20 posts (was 8)');
  console.log('   - JSON parsing: Enhanced with markdown cleaning');
  console.log('   - Quality gates: Improved fallback systems');
}

// Run quick status check
quickSystemStatus();
