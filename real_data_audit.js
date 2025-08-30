#!/usr/bin/env node

/**
 * 🔍 REAL DATA AUDIT - Using Correct Schema
 * 
 * Audits actual database tables with correct column names
 */

require('dotenv').config();

async function realDataAudit() {
  console.log('🔍 === REAL DATA AUDIT (Correct Schema) ===');
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

    console.log('📊 AUDIT SECTION 1: MAIN TWEETS TABLE');
    console.log('=' .repeat(50));

    // 1. Check main tweets table for fake IDs
    console.log('🔍 Checking tweets table for fake tweet_id patterns...');
    
    const fakePatterns = ['browser_', 'posted_', 'auto_', 'twitter_', 'tweet_'];
    
    for (const pattern of fakePatterns) {
      const { data: fakeTweets, error } = await supabase
        .from('tweets')
        .select('id, tweet_id, likes, retweets, content, created_at')
        .ilike('tweet_id', `${pattern}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.warn(`⚠️ Error checking tweets for ${pattern}: ${error.message}`);
      } else if (fakeTweets && fakeTweets.length > 0) {
        issues.push(`❌ FAKE_TWEET_IDS: ${fakeTweets.length} tweets with ${pattern} pattern`);
        console.log(`❌ Found ${fakeTweets.length} tweets with fake ${pattern} IDs:`);
        fakeTweets.forEach(tweet => {
          console.log(`   - ID: ${tweet.id}, tweet_id: ${tweet.tweet_id}`);
          console.log(`     Engagement: ${tweet.likes || 0}L, ${tweet.retweets || 0}RT`);
          console.log(`     Content: "${(tweet.content || '').substring(0, 50)}..."`);
        });
      } else {
        successes.push(`✅ No ${pattern} patterns found in tweets table`);
      }
    }

    console.log('');
    console.log('📊 AUDIT SECTION 2: RECENT REAL TWEETS VALIDATION');
    console.log('=' .repeat(50));

    // 2. Check recent tweets for valid Twitter ID format
    console.log('🔍 Checking recent tweets for valid Twitter ID format...');
    
    const { data: recentTweets, error: recentError } = await supabase
      .from('tweets')
      .select('id, tweet_id, likes, retweets, impressions, content, created_at, posted_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentError) {
      console.warn(`⚠️ Error checking recent tweets: ${recentError.message}`);
    } else if (recentTweets && recentTweets.length > 0) {
      console.log(`🔍 Analyzing ${recentTweets.length} recent tweets...`);
      
      const twitterIdPattern = /^\d{15,19}$/;
      let realIds = 0;
      let fakeIds = 0;
      
      recentTweets.forEach(tweet => {
        const isReal = twitterIdPattern.test(tweet.tweet_id);
        const engagement = (tweet.likes || 0) + (tweet.retweets || 0);
        
        if (isReal) {
          realIds++;
          console.log(`   ✅ REAL: ${tweet.tweet_id} (${engagement} eng, "${(tweet.content || '').substring(0, 30)}...")`);
        } else {
          fakeIds++;
          console.log(`   ❌ FAKE: ${tweet.tweet_id} (${engagement} eng, "${(tweet.content || '').substring(0, 30)}...")`);
        }
      });
      
      console.log(`\n📊 ID Validation Summary:`);
      console.log(`   - Real Twitter IDs: ${realIds}`);
      console.log(`   - Fake/Invalid IDs: ${fakeIds}`);
      
      if (fakeIds > 0) {
        issues.push(`❌ FAKE_IDS_PRESENT: ${fakeIds}/${recentTweets.length} recent tweets have fake IDs`);
      } else {
        successes.push(`✅ All ${realIds} recent tweets have valid Twitter ID format`);
      }
    }

    console.log('');
    console.log('📊 AUDIT SECTION 3: ENGAGEMENT REALISM CHECK');
    console.log('=' .repeat(50));

    // 3. Check for unrealistic engagement (for small account ~23 followers)
    console.log('🔍 Checking for unrealistic engagement levels...');
    
    const { data: highEngagement, error: engagementError } = await supabase
      .from('tweets')
      .select('id, tweet_id, likes, retweets, replies, impressions, content, created_at')
      .or('likes.gt.15,retweets.gt.8,replies.gt.5')
      .order('created_at', { ascending: false })
      .limit(15);

    if (engagementError) {
      console.warn(`⚠️ Error checking engagement: ${engagementError.message}`);
    } else if (highEngagement && highEngagement.length > 0) {
      console.log(`⚠️ Found ${highEngagement.length} tweets with high engagement:`);
      highEngagement.forEach(tweet => {
        const totalEngagement = (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0);
        const isUnrealistic = totalEngagement > 25; // For 23-follower account
        
        if (isUnrealistic) {
          issues.push(`❌ UNREALISTIC_ENGAGEMENT: ${tweet.tweet_id} has ${totalEngagement} total engagement`);
        }
        
        console.log(`   ${isUnrealistic ? '❌' : '⚠️'} ${tweet.tweet_id}: ${tweet.likes}L, ${tweet.retweets}RT, ${tweet.replies}R (${totalEngagement} total)`);
        console.log(`     Content: "${(tweet.content || '').substring(0, 40)}..."`);
      });
    } else {
      successes.push(`✅ All engagement metrics appear realistic for small account`);
    }

    console.log('');
    console.log('📊 AUDIT SECTION 4: POSTING FREQUENCY ANALYSIS');
    console.log('=' .repeat(50));

    // 4. Check posting frequency for the last 24 hours
    console.log('🔍 Checking posting frequency...');
    
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent24h, error: freq24Error } = await supabase
      .from('tweets')
      .select('id, tweet_id, created_at, posted_at')
      .gte('created_at', last24h)
      .order('created_at', { ascending: false });

    if (freq24Error) {
      console.warn(`⚠️ Error checking 24h frequency: ${freq24Error.message}`);
    } else {
      const count24h = recent24h?.length || 0;
      console.log(`📊 Posts in last 24 hours: ${count24h}`);
      
      if (count24h === 0) {
        issues.push(`❌ NO_RECENT_POSTS: 0 posts in last 24h (system may be down)`);
      } else if (count24h < 2) {
        issues.push(`⚠️ LOW_POSTING_FREQUENCY: Only ${count24h} posts in 24h (expected 8-16 with new optimizations)`);
      } else if (count24h > 30) {
        issues.push(`⚠️ HIGH_POSTING_FREQUENCY: ${count24h} posts in 24h (may indicate spam)`);
      } else {
        successes.push(`✅ Healthy posting frequency: ${count24h} posts in 24h`);
      }
      
      // Show recent posts timeline
      if (recent24h && recent24h.length > 0) {
        console.log(`\n🕐 Recent posts timeline:`);
        recent24h.slice(0, 8).forEach(tweet => {
          const timeAgo = Math.round((Date.now() - new Date(tweet.created_at).getTime()) / (60 * 1000));
          console.log(`   - ${tweet.tweet_id}: ${timeAgo} minutes ago`);
        });
      }
    }

    console.log('');
    console.log('📊 AUDIT SECTION 5: CONTENT QUALITY CHECK');
    console.log('=' .repeat(50));

    // 5. Check for duplicate or low-quality content
    console.log('🔍 Checking for content quality issues...');
    
    const { data: recentContent, error: contentError } = await supabase
      .from('tweets')
      .select('tweet_id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (contentError) {
      console.warn(`⚠️ Error checking content: ${contentError.message}`);
    } else if (recentContent && recentContent.length > 0) {
      console.log(`📝 Recent content analysis:`);
      
      const contentHashes = new Set();
      let duplicates = 0;
      let generic = 0;
      
      recentContent.forEach((tweet, index) => {
        const content = tweet.content || '';
        const contentHash = content.toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Check for duplicates
        if (contentHashes.has(contentHash)) {
          duplicates++;
          console.log(`   ❌ DUPLICATE: "${content.substring(0, 40)}..."`);
        } else {
          contentHashes.add(contentHash);
          
          // Check for generic content patterns
          const genericPatterns = [
            /get.rich.quick/i,
            /this.*changed.*life/i,
            /doctors.*hate.*trick/i,
            /amazing.*secret/i,
            /one.*simple.*trick/i
          ];
          
          const isGeneric = genericPatterns.some(pattern => pattern.test(content));
          if (isGeneric) {
            generic++;
            console.log(`   ⚠️ GENERIC: "${content.substring(0, 40)}..."`);
          } else {
            console.log(`   ✅ QUALITY: "${content.substring(0, 40)}..."`);
          }
        }
      });
      
      if (duplicates > 0) {
        issues.push(`❌ DUPLICATE_CONTENT: ${duplicates} duplicate posts found`);
      }
      
      if (generic > recentContent.length / 2) {
        issues.push(`⚠️ LOW_QUALITY_CONTENT: ${generic}/${recentContent.length} posts appear generic`);
      } else {
        successes.push(`✅ Content quality: ${recentContent.length - generic - duplicates}/${recentContent.length} posts are unique and high-quality`);
      }
    }

  } catch (error) {
    console.error('❌ Audit failed:', error);
    issues.push(`❌ AUDIT_FAILURE: ${error.message}`);
  }

  console.log('');
  console.log('🎯 === COMPREHENSIVE AUDIT RESULTS ===');
  console.log('=' .repeat(50));
  
  console.log(`\n✅ SUCCESSES (${successes.length}):`);
  successes.forEach(success => console.log(success));
  
  console.log(`\n❌ ISSUES FOUND (${issues.length}):`);
  issues.forEach(issue => console.log(issue));
  
  console.log('');
  const criticalIssues = issues.filter(issue => issue.includes('❌'));
  const warningIssues = issues.filter(issue => issue.includes('⚠️'));
  
  if (criticalIssues.length === 0) {
    console.log('🎉 CRITICAL CHECK PASSED: No fake data contamination detected!');
  } else {
    console.log(`🚨 CRITICAL ISSUES: ${criticalIssues.length} fake data problems found`);
  }
  
  if (warningIssues.length === 0) {
    console.log('✅ QUALITY CHECK PASSED: System operating optimally');
  } else {
    console.log(`⚠️ QUALITY WARNINGS: ${warningIssues.length} optimization opportunities`);
  }
  
  console.log(`\n📊 Final Score: ${successes.length}/${successes.length + issues.length} checks passed`);
  console.log('⏰ Audit completed:', new Date().toLocaleString());
  
  // Return audit results for further processing
  return {
    successes,
    issues,
    criticalIssues,
    warningIssues,
    score: successes.length / (successes.length + issues.length)
  };
}

// Run the audit
if (require.main === module) {
  realDataAudit().catch(console.error);
}

module.exports = { realDataAudit };
