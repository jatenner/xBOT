#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE LOG AUDIT
 * 
 * Analyzes system logs to identify issues and performance problems
 */

require('dotenv').config();

async function comprehensiveLogAudit() {
  console.log('🔍 === COMPREHENSIVE LOG AUDIT ===');
  console.log('🎯 Goal: Identify issues in system logs and performance');
  console.log('⏰ Audit Time:', new Date().toLocaleString());
  console.log('');

  const issues = [];
  const warnings = [];
  const successes = [];

  try {
    console.log('📊 SECTION 1: DATABASE STATUS CHECK');
    console.log('=' .repeat(50));

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check recent posting activity
    const { data: recentPosts, error: postsError } = await supabase
      .from('tweets')
      .select('id, tweet_id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (postsError) {
      issues.push(`❌ DATABASE_ERROR: ${postsError.message}`);
    } else {
      console.log(`📊 Recent posts analysis (${recentPosts?.length || 0} posts):`);
      
      if (!recentPosts || recentPosts.length === 0) {
        issues.push('❌ NO_RECENT_POSTS: No posts found in database');
      } else {
        let realIds = 0;
        let fakeIds = 0;
        const last24h = Date.now() - (24 * 60 * 60 * 1000);
        let recent24h = 0;

        recentPosts.forEach(post => {
          const isReal = /^\d{15,19}$/.test(post.tweet_id);
          const isFake = /^(browser_|posted_|auto_)/.test(post.tweet_id);
          const postTime = new Date(post.created_at).getTime();
          
          if (postTime > last24h) recent24h++;
          
          if (isReal) {
            realIds++;
            console.log(`   ✅ REAL: ${post.tweet_id} - "${(post.content || '').substring(0, 30)}..."`);
          } else if (isFake) {
            fakeIds++;
            console.log(`   ❌ FAKE: ${post.tweet_id} - "${(post.content || '').substring(0, 30)}..."`);
          } else {
            console.log(`   ⚠️ UNKNOWN: ${post.tweet_id} - "${(post.content || '').substring(0, 30)}..."`);
          }
        });

        console.log(`\n📈 Summary:`);
        console.log(`   - Real IDs: ${realIds}`);
        console.log(`   - Fake IDs: ${fakeIds}`);
        console.log(`   - Posts last 24h: ${recent24h}`);

        if (fakeIds > 0) {
          issues.push(`❌ FAKE_IDS_STILL_PRESENT: ${fakeIds} fake IDs detected`);
        } else {
          successes.push(`✅ NO_FAKE_IDS: All IDs appear real or valid`);
        }

        if (recent24h === 0) {
          issues.push('❌ NO_RECENT_ACTIVITY: No posts in last 24 hours');
        } else if (recent24h < 3) {
          warnings.push(`⚠️ LOW_ACTIVITY: Only ${recent24h} posts in 24h`);
        } else {
          successes.push(`✅ HEALTHY_ACTIVITY: ${recent24h} posts in 24h`);
        }
      }
    }

    console.log('');
    console.log('📊 SECTION 2: SYSTEM CONFIGURATION CHECK');
    console.log('=' .repeat(50));

    // Check environment variables
    const criticalEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY', 
      'OPENAI_API_KEY',
      'TWITTER_SESSION_B64'
    ];

    console.log('🔧 Environment variables:');
    criticalEnvVars.forEach(envVar => {
      if (process.env[envVar]) {
        const value = process.env[envVar];
        const masked = value.length > 10 ? value.substring(0, 10) + '...' : value;
        console.log(`   ✅ ${envVar}: ${masked}`);
        successes.push(`✅ ENV_VAR_SET: ${envVar}`);
      } else {
        console.log(`   ❌ ${envVar}: NOT SET`);
        issues.push(`❌ MISSING_ENV_VAR: ${envVar}`);
      }
    });

    console.log('');
    console.log('📊 SECTION 3: RECENT ERRORS ANALYSIS');
    console.log('=' .repeat(50));

    // Check for common error patterns in recent posts
    const errorPatterns = [
      'browser_',
      'ENHANCED_TWEET_ID_EXTRACTION',
      'CAPTURED_FROM',
      'Failed to',
      'Error:',
      'TypeError:',
      'Cannot read properties',
      'undefined'
    ];

    console.log('🔍 Checking for error patterns in system...');
    
    // Since we can't directly access Railway logs, let's check our database for any error indicators
    try {
      // Check if our enhanced extraction is working by looking at recent tweet IDs
      const { data: veryRecentPosts } = await supabase
        .from('tweets')
        .select('tweet_id, created_at')
        .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Last 2 hours
        .order('created_at', { ascending: false });

      if (veryRecentPosts && veryRecentPosts.length > 0) {
        console.log('📊 Recent 2-hour posting analysis:');
        let enhancedExtractionWorking = false;
        
        veryRecentPosts.forEach(post => {
          const isReal = /^\d{15,19}$/.test(post.tweet_id);
          const isFake = /^browser_/.test(post.tweet_id);
          
          console.log(`   - ${post.tweet_id}: ${isReal ? '✅ REAL' : isFake ? '❌ FAKE' : '⚠️ UNKNOWN'} (${new Date(post.created_at).toLocaleTimeString()})`);
          
          if (isReal) enhancedExtractionWorking = true;
        });

        if (enhancedExtractionWorking) {
          successes.push('✅ ENHANCED_EXTRACTION_WORKING: Real IDs detected in recent posts');
        } else {
          if (veryRecentPosts.some(p => p.tweet_id.startsWith('browser_'))) {
            issues.push('❌ ENHANCED_EXTRACTION_FAILED: Still generating browser_ IDs');
          } else {
            warnings.push('⚠️ NO_RECENT_POSTS: Cannot verify extraction status');
          }
        }
      } else {
        warnings.push('⚠️ NO_RECENT_POSTS_2H: No posts in last 2 hours to analyze');
      }

    } catch (analysisError) {
      warnings.push(`⚠️ ANALYSIS_ERROR: ${analysisError.message}`);
    }

    console.log('');
    console.log('📊 SECTION 4: PERFORMANCE INDICATORS');
    console.log('=' .repeat(50));

    // Check posting frequency and timing
    const { data: hourlyStats } = await supabase
      .from('tweets')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (hourlyStats && hourlyStats.length > 0) {
      const timeDiffs = [];
      for (let i = 0; i < hourlyStats.length - 1; i++) {
        const diff = new Date(hourlyStats[i].created_at).getTime() - new Date(hourlyStats[i + 1].created_at).getTime();
        timeDiffs.push(diff / (60 * 1000)); // Convert to minutes
      }

      if (timeDiffs.length > 0) {
        const avgInterval = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
        const minInterval = Math.min(...timeDiffs);
        const maxInterval = Math.max(...timeDiffs);

        console.log(`📊 Posting intervals (last ${timeDiffs.length} posts):`);
        console.log(`   - Average: ${avgInterval.toFixed(1)} minutes`);
        console.log(`   - Minimum: ${minInterval.toFixed(1)} minutes`);
        console.log(`   - Maximum: ${maxInterval.toFixed(1)} minutes`);

        if (avgInterval > 300) { // > 5 hours
          issues.push(`❌ LONG_INTERVALS: Average ${avgInterval.toFixed(1)} min between posts`);
        } else if (avgInterval > 180) { // > 3 hours  
          warnings.push(`⚠️ SLOW_POSTING: Average ${avgInterval.toFixed(1)} min between posts`);
        } else {
          successes.push(`✅ GOOD_FREQUENCY: Average ${avgInterval.toFixed(1)} min between posts`);
        }
      }
    }

    console.log('');
    console.log('📊 SECTION 5: CONTENT QUALITY ANALYSIS');
    console.log('=' .repeat(50));

    // Check for content diversity and quality
    const { data: contentAnalysis } = await supabase
      .from('tweets')
      .select('content')
      .order('created_at', { ascending: false })
      .limit(20);

    if (contentAnalysis && contentAnalysis.length > 0) {
      const contents = contentAnalysis.map(p => p.content).filter(Boolean);
      const uniqueContents = new Set(contents.map(c => c.toLowerCase().trim()));
      
      console.log(`📝 Content analysis (${contents.length} posts):`);
      console.log(`   - Unique content pieces: ${uniqueContents.size}`);
      console.log(`   - Duplicate rate: ${((contents.length - uniqueContents.size) / contents.length * 100).toFixed(1)}%`);

      // Check for specific repeated patterns
      const patterns = {};
      contents.forEach(content => {
        const firstWords = content.split(' ').slice(0, 5).join(' ').toLowerCase();
        patterns[firstWords] = (patterns[firstWords] || 0) + 1;
      });

      const duplicatePatterns = Object.entries(patterns).filter(([_, count]) => count > 1);
      
      if (duplicatePatterns.length > 0) {
        console.log('⚠️ Repeated content patterns:');
        duplicatePatterns.forEach(([pattern, count]) => {
          console.log(`   - "${pattern}...": ${count} times`);
        });
        warnings.push(`⚠️ CONTENT_REPETITION: ${duplicatePatterns.length} repeated patterns`);
      } else {
        successes.push('✅ CONTENT_DIVERSITY: No repeated patterns detected');
      }
    }

  } catch (error) {
    console.error('❌ Audit failed:', error);
    issues.push(`❌ AUDIT_FAILURE: ${error.message}`);
  }

  console.log('');
  console.log('🎯 === AUDIT RESULTS SUMMARY ===');
  console.log('=' .repeat(50));
  
  console.log(`\n✅ SUCCESSES (${successes.length}):`);
  successes.forEach(success => console.log(success));
  
  console.log(`\n⚠️ WARNINGS (${warnings.length}):`);
  warnings.forEach(warning => console.log(warning));
  
  console.log(`\n❌ CRITICAL ISSUES (${issues.length}):`);
  issues.forEach(issue => console.log(issue));
  
  console.log('');
  
  // Overall health assessment
  const totalChecks = successes.length + warnings.length + issues.length;
  const healthScore = (successes.length / totalChecks * 100).toFixed(1);
  
  console.log('🏥 SYSTEM HEALTH ASSESSMENT:');
  console.log(`   - Health Score: ${healthScore}%`);
  console.log(`   - Critical Issues: ${issues.length}`);
  console.log(`   - Warnings: ${warnings.length}`);
  console.log(`   - Successes: ${successes.length}`);
  
  if (issues.length === 0) {
    console.log('🎉 SYSTEM STATUS: HEALTHY');
  } else if (issues.length <= 2) {
    console.log('⚠️ SYSTEM STATUS: NEEDS ATTENTION');
  } else {
    console.log('🚨 SYSTEM STATUS: CRITICAL ISSUES DETECTED');
  }
  
  console.log(`\n⏰ Audit completed: ${new Date().toLocaleString()}`);
  
  return {
    success: true,
    healthScore: parseFloat(healthScore),
    issues,
    warnings,
    successes,
    totalChecks
  };
}

// Run the audit
if (require.main === module) {
  comprehensiveLogAudit()
    .then(result => {
      if (result.success) {
        process.exit(result.issues.length > 0 ? 1 : 0);
      } else {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Fatal audit error:', error);
      process.exit(1);
    });
}

module.exports = { comprehensiveLogAudit };
