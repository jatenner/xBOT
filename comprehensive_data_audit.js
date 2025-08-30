#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE DATA AUDIT
 * 
 * Audits all data sources to ensure only real data flows through the system
 */

require('dotenv').config();

async function comprehensiveDataAudit() {
  console.log('🔍 === COMPREHENSIVE DATA AUDIT ===');
  console.log('🎯 Goal: Verify ONLY real data is flowing through the system');
  console.log('⏰ Audit Time:', new Date().toLocaleString());
  console.log('');

  const issues = [];
  const successes = [];

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('📊 AUDIT SECTION 1: DATABASE FAKE DATA CHECK');
    console.log('=' .repeat(50));

    // 1. Check for fake post IDs in main tables
    console.log('🔍 Checking for fake post IDs...');
    
    const fakePatterns = ['browser_', 'posted_', 'auto_', 'twitter_', 'tweet_'];
    
    for (const pattern of fakePatterns) {
      // Check learning_posts table
      const { data: learningFakes, error: learningError } = await supabase
        .from('learning_posts')
        .select('post_id, likes, retweets, created_at')
        .ilike('post_id', `${pattern}%`)
        .limit(10);

      if (learningError) {
        console.warn(`⚠️ Error checking learning_posts for ${pattern}: ${learningError.message}`);
      } else if (learningFakes && learningFakes.length > 0) {
        issues.push(`❌ FAKE_IDS_FOUND: ${learningFakes.length} posts with ${pattern} pattern in learning_posts`);
        console.log(`❌ Found ${learningFakes.length} fake IDs with pattern: ${pattern}`);
        learningFakes.forEach(post => {
          console.log(`   - ${post.post_id}: ${post.likes} likes, ${post.retweets} retweets`);
        });
      } else {
        successes.push(`✅ No ${pattern} patterns found in learning_posts`);
      }

      // Check unified_posts table
      const { data: unifiedFakes, error: unifiedError } = await supabase
        .from('unified_posts')
        .select('post_id, engagement_score, created_at')
        .ilike('post_id', `${pattern}%`)
        .limit(10);

      if (unifiedError) {
        console.warn(`⚠️ Error checking unified_posts for ${pattern}: ${unifiedError.message}`);
      } else if (unifiedFakes && unifiedFakes.length > 0) {
        issues.push(`❌ FAKE_IDS_FOUND: ${unifiedFakes.length} posts with ${pattern} pattern in unified_posts`);
        console.log(`❌ Found ${unifiedFakes.length} fake IDs with pattern: ${pattern} in unified_posts`);
      } else {
        successes.push(`✅ No ${pattern} patterns found in unified_posts`);
      }
    }

    console.log('');
    console.log('📊 AUDIT SECTION 2: UNREALISTIC METRICS CHECK');
    console.log('=' .repeat(50));

    // 2. Check for unrealistic engagement metrics
    console.log('🔍 Checking for unrealistic engagement metrics...');
    
    const { data: highEngagement, error: engagementError } = await supabase
      .from('learning_posts')
      .select('post_id, likes, retweets, replies, impressions, created_at')
      .or('likes.gt.10,retweets.gt.5,replies.gt.3')
      .order('created_at', { ascending: false })
      .limit(10);

    if (engagementError) {
      console.warn(`⚠️ Error checking engagement: ${engagementError.message}`);
    } else if (highEngagement && highEngagement.length > 0) {
      console.log(`⚠️ Found ${highEngagement.length} posts with high engagement (may be unrealistic for small account):`);
      highEngagement.forEach(post => {
        const totalEngagement = (post.likes || 0) + (post.retweets || 0) + (post.replies || 0);
        if (totalEngagement > 15) {
          issues.push(`❌ UNREALISTIC_ENGAGEMENT: ${post.post_id} has ${totalEngagement} total engagement`);
        }
        console.log(`   - ${post.post_id}: ${post.likes}L, ${post.retweets}RT, ${post.replies}R (${totalEngagement} total)`);
      });
    } else {
      successes.push(`✅ All engagement metrics appear realistic`);
    }

    console.log('');
    console.log('📊 AUDIT SECTION 3: RECENT POST ID VALIDATION');
    console.log('=' .repeat(50));

    // 3. Check recent posts for valid Twitter ID format
    console.log('🔍 Checking recent post ID formats...');
    
    const { data: recentPosts, error: recentError } = await supabase
      .from('learning_posts')
      .select('post_id, created_at, _data_source')
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentError) {
      console.warn(`⚠️ Error checking recent posts: ${recentError.message}`);
    } else if (recentPosts && recentPosts.length > 0) {
      console.log(`🔍 Analyzing ${recentPosts.length} recent posts...`);
      
      const twitterIdPattern = /^\d{15,19}$/;
      let realIds = 0;
      let fakeIds = 0;
      
      recentPosts.forEach(post => {
        if (twitterIdPattern.test(post.post_id)) {
          realIds++;
          console.log(`   ✅ REAL: ${post.post_id} (${post._data_source || 'unknown source'})`);
        } else {
          fakeIds++;
          console.log(`   ❌ FAKE: ${post.post_id} (${post._data_source || 'unknown source'})`);
        }
      });
      
      if (fakeIds > 0) {
        issues.push(`❌ FAKE_IDS: ${fakeIds}/${recentPosts.length} recent posts have fake IDs`);
      } else {
        successes.push(`✅ All ${realIds} recent posts have valid Twitter ID format`);
      }
    }

    console.log('');
    console.log('📊 AUDIT SECTION 4: DATA SOURCE VERIFICATION');
    console.log('=' .repeat(50));

    // 4. Check data sources and verification metadata
    console.log('🔍 Checking data source metadata...');
    
    const { data: sourcedPosts, error: sourceError } = await supabase
      .from('learning_posts')
      .select('post_id, _data_source, _verified, _confidence, created_at')
      .order('created_at', { ascending: false })
      .limit(15);

    if (sourceError) {
      console.warn(`⚠️ Error checking data sources: ${sourceError.message}`);
    } else if (sourcedPosts && sourcedPosts.length > 0) {
      console.log(`📊 Data source breakdown:`);
      
      const sources = {};
      let verifiedCount = 0;
      let unverifiedCount = 0;
      
      sourcedPosts.forEach(post => {
        const source = post._data_source || 'unknown';
        sources[source] = (sources[source] || 0) + 1;
        
        if (post._verified) {
          verifiedCount++;
        } else {
          unverifiedCount++;
        }
        
        const confidence = post._confidence ? ` (${(post._confidence * 100).toFixed(1)}%)` : '';
        console.log(`   - ${post.post_id}: ${source}${confidence} ${post._verified ? '✅' : '❌'}`);
      });
      
      console.log(`\n📈 Source Summary:`);
      Object.entries(sources).forEach(([source, count]) => {
        console.log(`   - ${source}: ${count} posts`);
      });
      
      console.log(`\n🛡️ Verification Summary:`);
      console.log(`   - Verified: ${verifiedCount}`);
      console.log(`   - Unverified: ${unverifiedCount}`);
      
      if (unverifiedCount > verifiedCount) {
        issues.push(`⚠️ MORE_UNVERIFIED: ${unverifiedCount} unverified vs ${verifiedCount} verified posts`);
      } else {
        successes.push(`✅ Verification rate: ${verifiedCount}/${sourcedPosts.length} posts verified`);
      }
    }

    console.log('');
    console.log('📊 AUDIT SECTION 5: SYSTEM HEALTH CHECK');
    console.log('=' .repeat(50));

    // 5. Check for system health indicators
    console.log('🔍 Checking system health indicators...');
    
    const { data: healthCheck, error: healthError } = await supabase
      .from('learning_posts')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (healthError) {
      console.warn(`⚠️ Error checking system health: ${healthError.message}`);
    } else {
      const postsLast24h = healthCheck?.length || 0;
      console.log(`📊 Posts in last 24 hours: ${postsLast24h}`);
      
      if (postsLast24h < 3) {
        issues.push(`⚠️ LOW_ACTIVITY: Only ${postsLast24h} posts in last 24h (expected 8-16)`);
      } else if (postsLast24h > 25) {
        issues.push(`⚠️ HIGH_ACTIVITY: ${postsLast24h} posts in last 24h (may indicate spam)`);
      } else {
        successes.push(`✅ Healthy posting frequency: ${postsLast24h} posts in 24h`);
      }
    }

  } catch (error) {
    console.error('❌ Audit failed:', error);
    issues.push(`❌ AUDIT_FAILURE: ${error.message}`);
  }

  console.log('');
  console.log('🎯 === AUDIT RESULTS ===');
  console.log('=' .repeat(50));
  
  console.log(`\n✅ SUCCESSES (${successes.length}):`);
  successes.forEach(success => console.log(success));
  
  console.log(`\n❌ ISSUES FOUND (${issues.length}):`);
  issues.forEach(issue => console.log(issue));
  
  console.log('');
  if (issues.length === 0) {
    console.log('🎉 AUDIT PASSED: Only real data is flowing through the system!');
  } else if (issues.length <= 2) {
    console.log('⚠️ AUDIT WARNING: Minor issues found, mostly real data flowing');
  } else {
    console.log('🚨 AUDIT FAILED: Significant fake data contamination detected');
  }
  
  console.log(`\n📊 Final Score: ${successes.length}/${successes.length + issues.length} checks passed`);
  console.log('⏰ Audit completed:', new Date().toLocaleString());
}

// Run the audit
comprehensiveDataAudit().catch(console.error);
