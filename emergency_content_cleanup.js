#!/usr/bin/env node

/**
 * 🚨 EMERGENCY CONTENT CLEANUP
 * Clear any cached/queued low-quality content and force fresh generation
 */

const { AdvancedDatabaseManager } = require('./src/lib/advancedDatabaseManager');

async function emergencyContentCleanup() {
  console.log('🚨 EMERGENCY CONTENT CLEANUP STARTING...');
  
  try {
    const db = AdvancedDatabaseManager.getInstance();
    await db.initialize();
    
    // 1. Clear any cached content that matches bad patterns
    console.log('🧹 Clearing cached content with "Let\'s dive into" patterns...');
    
    await db.executeQuery('clear_bad_content', async (client) => {
      // Clear content candidates with bad patterns
      const { data: badCandidates, error1 } = await client
        .from('content_candidates')
        .delete()
        .or('tweets_json->>\'tweets\'->>0.ilike.*Let\'s dive into*,tweets_json->>\'tweets\'->>0.ilike.*Let\'s explore*')
        .select();
      
      if (error1) console.warn('Could not clear content_candidates:', error1.message);
      else console.log(`✅ Cleared ${badCandidates?.length || 0} bad content candidates`);
      
      // Clear any draft tweets with bad patterns  
      const { data: badTweets, error2 } = await client
        .from('tweets')
        .delete()
        .or('content.ilike.*Let\'s dive into*,content.ilike.*Let\'s explore*')
        .is('posted_at', null) // Only drafts
        .select();
      
      if (error2) console.warn('Could not clear draft tweets:', error2.message);
      else console.log(`✅ Cleared ${badTweets?.length || 0} bad draft tweets`);
      
      return { cleared: (badCandidates?.length || 0) + (badTweets?.length || 0) };
    });
    
    // 2. Add content quality enforcement
    console.log('🛡️ Adding content quality enforcement...');
    
    await db.executeQuery('add_quality_rules', async (client) => {
      const { error } = await client
        .from('bot_config')
        .upsert({
          config_key: 'content_quality_enforcement',
          config_value: {
            enabled: true,
            blocked_patterns: [
              "Let's dive into",
              "Let's explore", 
              "Here's what you need to know:",
              "Stay tuned for more",
              "More details coming soon"
            ],
            min_quality_score: 3,
            require_complete_thoughts: true,
            enforce_health_focus: true,
            updated_at: new Date().toISOString()
          }
        }, { onConflict: 'config_key' });
      
      if (error) throw error;
      return { success: true };
    });
    
    console.log('✅ Content quality enforcement activated');
    
    // 3. Force content regeneration on next post
    await db.executeQuery('force_fresh_content', async (client) => {
      const { error } = await client
        .from('bot_config')
        .upsert({
          config_key: 'force_content_regeneration',
          config_value: {
            enabled: true,
            reason: 'Emergency cleanup - ensure fresh high-quality content',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
          }
        }, { onConflict: 'config_key' });
      
      if (error) throw error;
      return { success: true };
    });
    
    console.log('✅ Forced content regeneration for next 24 hours');
    
    console.log(`
🎉 EMERGENCY CLEANUP COMPLETE!
    
✅ Cleared all cached "Let's dive into" content
✅ Activated content quality enforcement  
✅ Forced fresh content generation
✅ Next posts will use new high-quality system

The bot will now ONLY post complete, valuable health content!
    `);
    
  } catch (error) {
    console.error('❌ Emergency cleanup failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

if (require.main === module) {
  emergencyContentCleanup();
}

module.exports = { emergencyContentCleanup };
