/**
 * 🔍 AUDIT ALL MISATTRIBUTED POSTS
 * Finds all posts where tweet_id doesn't match content
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

async function auditMisattributedPosts() {
  try {
    const { getSupabaseClient } = await import('../src/db/index');
    const supabase = getSupabaseClient();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 AUDITING ALL POSTS FOR MISATTRIBUTION');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get all posts with tweet_ids
    const { data: posts, error } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, content, thread_parts, tweet_id, actual_impressions, generator_name, posted_at')
      .in('decision_type', ['single', 'thread'])
      .not('tweet_id', 'is', null)
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(100); // Check last 100 posts

    if (error) {
      console.error(`❌ Error querying posts: ${error.message}`);
      return;
    }

    if (!posts || posts.length === 0) {
      console.log('✅ No posts found to audit.');
      return;
    }

    console.log(`📊 Checking ${posts.length} posts for misattribution...\n`);

    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const browserPool = UnifiedBrowserPool.getInstance();
    const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
    
    const { verifyContentMatch, verifyThreadContentMatch } = await import('../src/utils/contentVerification');

    let misattributed: any[] = [];
    let checked = 0;

    for (const post of posts) {
      checked++;
      const expectedContent = post.decision_type === 'thread'
        ? (post.thread_parts || []).join(' ')
        : (post.content || '');

      if (!expectedContent || !post.tweet_id) {
        continue;
      }

      try {
        // Fetch actual tweet content from Twitter
        const actualContent = await browserPool.withContext(
          'content_audit',
          async (context) => {
            const page = await context.newPage();
            try {
              const tweetUrl = `https://x.com/${username}/status/${post.tweet_id}`;
              await page.goto(tweetUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
              });
              
              await page.waitForSelector('[data-testid="tweetText"]', { timeout: 10000 }).catch(() => null);
              
              const tweetText = await page.evaluate(() => {
                const textElement = document.querySelector('[data-testid="tweetText"]');
                return textElement?.textContent?.trim() || '';
              });
              
              return tweetText || null;
            } finally {
              await page.close();
            }
          },
          3
        );

        if (!actualContent) {
          console.log(`⚠️  ${checked}/${posts.length}: Could not fetch content for tweet ${post.tweet_id}`);
          continue;
        }

        // Verify content matches
        const verification = post.decision_type === 'thread'
          ? verifyThreadContentMatch((post.thread_parts || []), actualContent, 0.6)
          : verifyContentMatch(expectedContent, actualContent, 0.7);

        if (!verification.isValid) {
          misattributed.push({
            ...post,
            actualContent,
            verification
          });
          
          console.log(`🚨 MISATTRIBUTED: ${checked}/${posts.length}`);
          console.log(`   Tweet ID: ${post.tweet_id}`);
          console.log(`   Decision ID: ${post.decision_id}`);
          console.log(`   Expected: "${verification.expectedPreview}..."`);
          console.log(`   Actual: "${verification.actualPreview}..."`);
          console.log(`   Similarity: ${(verification.similarity * 100).toFixed(1)}%`);
          console.log('');
        } else {
          if (checked % 10 === 0) {
            console.log(`✅ Checked ${checked}/${posts.length}...`);
          }
        }

        // Rate limit: wait 2 seconds between checks
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error: any) {
        console.warn(`⚠️  Error checking tweet ${post.tweet_id}: ${error.message}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`📊 AUDIT COMPLETE: ${checked} posts checked`);
    console.log(`🚨 MISATTRIBUTED: ${misattributed.length} posts`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (misattributed.length > 0) {
      console.log('🚨 MISATTRIBUTED POSTS:\n');
      misattributed.forEach((post, idx) => {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`ISSUE #${idx + 1}: ${post.decision_type.toUpperCase()}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Decision ID: ${post.decision_id}`);
        console.log(`Tweet ID: ${post.tweet_id}`);
        console.log(`Generator: ${post.generator_name || 'unknown'}`);
        console.log(`Views: ${post.actual_impressions || 0}`);
        console.log(`Similarity: ${(post.verification.similarity * 100).toFixed(1)}%`);
        console.log(`\nExpected:`);
        console.log(`"${post.verification.expectedPreview}..."`);
        console.log(`\nActual:`);
        console.log(`"${post.verification.actualPreview}..."`);
        console.log('');
      });
    } else {
      console.log('✅ No misattributed posts found!\n');
    }

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

auditMisattributedPosts().catch(console.error);

