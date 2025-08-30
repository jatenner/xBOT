#!/usr/bin/env node

/**
 * 🧹 CLEAN FAKE TWEET IDs
 * 
 * Removes all fake tweet records (browser_, posted_, etc.) from the database
 */

require('dotenv').config();

async function cleanFakeTweetIds() {
  console.log('🧹 === CLEANING FAKE TWEET IDs ===');
  console.log('🎯 Goal: Remove all fake tweet records from database');
  console.log('⏰ Start Time:', new Date().toLocaleString());
  console.log('');

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('📊 PHASE 1: IDENTIFY FAKE RECORDS');
    console.log('=' .repeat(50));

    const fakePatterns = ['browser_%', 'posted_%', 'auto_%', 'twitter_%', 'tweet_%'];
    const deletedCounts = {};
    let totalDeleted = 0;

    for (const pattern of fakePatterns) {
      console.log(`🔍 Checking for ${pattern} pattern...`);
      
      // Count fake records first
      const { data: fakeRecords, error: countError } = await supabase
        .from('tweets')
        .select('id, tweet_id, content, created_at')
        .ilike('tweet_id', pattern)
        .order('created_at', { ascending: false });

      if (countError) {
        console.warn(`⚠️ Error counting ${pattern}: ${countError.message}`);
        continue;
      }

      if (!fakeRecords || fakeRecords.length === 0) {
        console.log(`✅ No ${pattern} records found`);
        deletedCounts[pattern] = 0;
        continue;
      }

      console.log(`❌ Found ${fakeRecords.length} ${pattern} records:`);
      fakeRecords.slice(0, 5).forEach(record => {
        console.log(`   - ID: ${record.id}, tweet_id: ${record.tweet_id}`);
        console.log(`     Content: "${(record.content || '').substring(0, 40)}..."`);
        console.log(`     Created: ${record.created_at}`);
      });

      if (fakeRecords.length > 5) {
        console.log(`   ... and ${fakeRecords.length - 5} more`);
      }

      // Delete fake records
      console.log(`🗑️ Deleting ${fakeRecords.length} ${pattern} records...`);
      
      const { error: deleteError } = await supabase
        .from('tweets')
        .delete()
        .ilike('tweet_id', pattern);

      if (deleteError) {
        console.error(`❌ Failed to delete ${pattern}: ${deleteError.message}`);
        deletedCounts[pattern] = 0;
      } else {
        console.log(`✅ Successfully deleted ${fakeRecords.length} ${pattern} records`);
        deletedCounts[pattern] = fakeRecords.length;
        totalDeleted += fakeRecords.length;
      }

      console.log('');
    }

    console.log('📊 PHASE 2: VERIFY CLEANUP');
    console.log('=' .repeat(50));

    // Verify cleanup by checking what's left
    const { data: remainingTweets, error: remainingError } = await supabase
      .from('tweets')
      .select('id, tweet_id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (remainingError) {
      console.warn(`⚠️ Error checking remaining tweets: ${remainingError.message}`);
    } else {
      console.log(`📊 Remaining tweets (${remainingTweets?.length || 0} most recent):`);
      
      if (remainingTweets && remainingTweets.length > 0) {
        remainingTweets.forEach(tweet => {
          const isReal = /^\d{15,19}$/.test(tweet.tweet_id);
          const status = isReal ? '✅ REAL' : '❌ FAKE';
          console.log(`   ${status}: ${tweet.tweet_id} - "${(tweet.content || '').substring(0, 30)}..."`);
        });
      } else {
        console.log('   (No tweets found)');
      }
    }

    console.log('');
    console.log('📊 PHASE 3: SUMMARY REPORT');
    console.log('=' .repeat(50));

    console.log('🗑️ Deletion Summary:');
    Object.entries(deletedCounts).forEach(([pattern, count]) => {
      console.log(`   - ${pattern}: ${count} records deleted`);
    });
    
    console.log(`\n🎯 Total Impact:`);
    console.log(`   - Total fake records removed: ${totalDeleted}`);
    console.log(`   - Database cleanup: ${totalDeleted > 0 ? 'SUCCESS' : 'NONE_NEEDED'}`);

    // Check if we have any real tweets now
    const { data: realTweets, error: realError } = await supabase
      .from('tweets')
      .select('tweet_id')
      .not('tweet_id', 'ilike', 'browser_%')
      .not('tweet_id', 'ilike', 'posted_%')
      .not('tweet_id', 'ilike', 'auto_%')
      .not('tweet_id', 'ilike', 'twitter_%')
      .not('tweet_id', 'ilike', 'tweet_%');

    if (!realError && realTweets) {
      const realCount = realTweets.length;
      const validRealTweets = realTweets.filter(t => /^\d{15,19}$/.test(t.tweet_id));
      
      console.log(`\n📈 Real Data Status:`);
      console.log(`   - Total non-fake records: ${realCount}`);
      console.log(`   - Valid Twitter ID format: ${validRealTweets.length}`);
      
      if (validRealTweets.length > 0) {
        console.log(`   ✅ Real data exists: System can learn from authentic tweets`);
      } else {
        console.log(`   ⚠️ No real tweet IDs detected: Need to fix ID extraction`);
      }
    }

    console.log(`\n⏰ Cleanup completed: ${new Date().toLocaleString()}`);
    
    return {
      success: true,
      totalDeleted,
      deletedByPattern: deletedCounts,
      realTweetsRemaining: realTweets?.length || 0
    };

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return {
      success: false,
      error: error.message,
      totalDeleted: 0
    };
  }
}

// Run the cleanup
if (require.main === module) {
  cleanFakeTweetIds()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 DATABASE CLEANUP SUCCESSFUL!');
        process.exit(0);
      } else {
        console.error('\n💥 DATABASE CLEANUP FAILED!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { cleanFakeTweetIds };
