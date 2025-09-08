/**
 * 🔧 CONTENT GENERATION FIX
 * Replace all personal language with authoritative expert content
 */

import { config } from 'dotenv';
config();

import { AuthoritativeContentEngine } from '../src/ai/content/authoritativeContentEngine';
import { getRedisSafeClient } from '../src/lib/redisSafe';
import { getSafeDatabase } from '../src/lib/db';

async function fixContentGeneration() {
  console.log('🔧 CONTENT_FIX: Starting authoritative content system...');
  
  try {
    const contentEngine = AuthoritativeContentEngine.getInstance();
    const redis = getRedisSafeClient();
    const db = getSafeDatabase();

    // Clear any cached bad content
    console.log('🧹 CACHE_CLEAR: Removing cached content with personal language...');
    
    try {
      await redis.del('content_cache');
      await redis.del('recent_posts');
      await redis.del('content_performance_insights');
      console.log('✅ CACHE_CLEARED');
    } catch (error) {
      console.warn('⚠️ CACHE_CLEAR_PARTIAL:', error instanceof Error ? error.message : error);
    }

    // Test the new authoritative system
    console.log('\n🧪 TESTING: Generating authoritative content samples...');
    
    const testTopics = [
      'hormone optimization',
      'metabolic health', 
      'sleep quality',
      'cardiovascular fitness'
    ];

    for (const topic of testTopics) {
      console.log(`\n📊 TESTING: ${topic}`);
      
      // Generate single tweet
      const singleResult = await contentEngine.generateAuthoritativeContent({
        topic,
        format: 'single',
        useDataInsights: true
      });

      console.log(`Single Tweet (Score: ${singleResult.scores.overall}/100):`);
      console.log(`"${singleResult.content[0]}"`);
      
      if (singleResult.rejectionReasons.length > 0) {
        console.log(`❌ Rejection reasons: ${singleResult.rejectionReasons.join(', ')}`);
      }

      // Generate thread
      const threadResult = await contentEngine.generateAuthoritativeContent({
        topic,
        format: 'thread',
        useDataInsights: true
      });

      console.log(`\nThread (Score: ${threadResult.scores.overall}/100):`);
      threadResult.content.forEach((tweet, i) => {
        console.log(`${i + 1}. "${tweet}"`);
      });
      
      if (threadResult.rejectionReasons.length > 0) {
        console.log(`❌ Thread rejection reasons: ${threadResult.rejectionReasons.join(', ')}`);
      }

      // Validate no personal language
      const allContent = [...singleResult.content, ...threadResult.content].join(' ');
      const personalLanguage = /\b(I|my|me|myself|personally|in my experience|I tried|I found|worked for me|my friend|a friend told me)\b/gi;
      
      if (personalLanguage.test(allContent)) {
        console.error(`❌ PERSONAL_LANGUAGE_DETECTED in ${topic}!`);
        const matches = allContent.match(personalLanguage);
        console.error(`Problematic words: ${matches?.join(', ')}`);
      } else {
        console.log(`✅ NO_PERSONAL_LANGUAGE: ${topic} content is properly authoritative`);
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Update configuration to force authoritative mode
    console.log('\n🔧 CONFIG_UPDATE: Setting authoritative mode...');
    
    try {
      await redis.setJSON('system_config', {
        content_mode: 'authoritative_only',
        personal_language_blocked: true,
        minimum_authority_score: 70,
        minimum_evidence_score: 60,
        last_updated: new Date().toISOString()
      }, 86400); // 24 hour cache
      
      console.log('✅ CONFIG_UPDATED: System will only generate authoritative content');
    } catch (error) {
      console.warn('⚠️ CONFIG_UPDATE_FAILED:', error instanceof Error ? error.message : error);
    }

    // Final health check
    console.log('\n🔍 HEALTH_CHECK: Testing system connectivity...');
    
    const healthResults = await Promise.allSettled([
      redis.ping(),
      db.healthCheck()
    ]);

    healthResults.forEach((result, index) => {
      const system = ['Redis', 'Database'][index];
      if (result.status === 'fulfilled') {
        console.log(`✅ ${system}: OK`);
      } else {
        console.warn(`⚠️ ${system}: ${result.reason}`);
      }
    });

    console.log('\n🎉 CONTENT_FIX_COMPLETE: Authoritative content system is active!');
    console.log('🎯 NEXT: Your bot will now generate expert-level content without personal language');
    
  } catch (error) {
    console.error('💥 CONTENT_FIX_FAILED:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixContentGeneration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 SCRIPT_FAILED:', error);
      process.exit(1);
    });
}

export { fixContentGeneration };
