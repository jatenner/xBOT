/**
 * Smoke test for curated feed on specific failing accounts
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';
import { getSupabaseClient } from '../src/db/index';

const TEST_ACCOUNTS = [
  'DrMarkHyman',
  'DrWillCole',
  'PeterAttiaMD',
  'hubermanlab',
  'DrKellyann',
  'DrAndyGalpin',
  'DrMikeIsraetel',
];

async function smokeTestAccount(username: string): Promise<{ success: boolean; extracted: number; error?: string }> {
  const pool = UnifiedBrowserPool.getInstance();
  const supabase = getSupabaseClient();
  
  return await pool.withContext('smoke_test', async (context) => {
    const page = await context.newPage();
    
    try {
      const profileUrl = `https://x.com/${username}`;
      console.log(`\n🌐 Testing @${username}: ${profileUrl}`);
      
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Helper for safe evaluate
      const safeEvaluate = async <T>(fn: (payload: any) => T, payload: Record<string, any> = {}): Promise<T> => {
        return page.evaluate(fn, payload);
      };
      
      // Check containers
      const containersBefore = await safeEvaluate(() => {
        return document.querySelectorAll('article[data-testid="tweet"]').length;
      });
      
      console.log(`📊 Containers before: ${containersBefore}`);
      
      // Try consent clearing
      try {
        const acceptButton = page.getByRole('button', { name: /accept/i }).first();
        if (await acceptButton.isVisible({ timeout: 2000 })) {
          await acceptButton.click();
          await page.waitForTimeout(2000);
          console.log(`🍪 Clicked consent button`);
        }
      } catch (e) {
        // No consent wall
      }
      
      // Check containers after
      const containersAfter = await safeEvaluate(() => {
        return document.querySelectorAll('article[data-testid="tweet"]').length;
      });
      
      console.log(`📊 Containers after: ${containersAfter}`);
      
      if (containersAfter === 0) {
        const screenshotPath = `/tmp/smoke_test_${username}_no_tweets.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot: ${screenshotPath}`);
        return { success: false, extracted: 0, error: 'No tweet containers found' };
      }
      
      // Extract tweets
      const tweets = await safeEvaluate((payload: { count: number; username: string }) => {
        const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        const results: any[] = [];
        
        for (let i = 0; i < Math.min(articles.length, payload.count); i++) {
          const article = articles[i];
          const tweetLink = article.querySelector('a[href*="/status/"]');
          if (!tweetLink) continue;
          
          const href = tweetLink.getAttribute('href') || '';
          const match = href.match(/\/status\/(\d+)/);
          if (!match) continue;
          
          results.push({
            tweet_id: match[1],
            author_username: payload.username,
          });
        }
        
        return results;
      }, { count: 5, username });
      
      console.log(`✅ Extracted ${tweets.length} tweets`);
      
      // Log to system_events
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_smoke_test_result',
        severity: 'info',
        message: `Smoke test for @${username}`,
        event_data: {
          username,
          url: profileUrl,
          containers_before: containersBefore,
          containers_after: containersAfter,
          extracted_count: tweets.length,
          success: true,
        },
        created_at: new Date().toISOString(),
      });
      
      return { success: true, extracted: tweets.length };
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      
      const screenshotPath = `/tmp/smoke_test_${username}_error.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_smoke_test_result',
        severity: 'error',
        message: `Smoke test failed for @${username}`,
        event_data: {
          username,
          error: error.message,
          stack: error.stack?.substring(0, 500),
          success: false,
        },
        created_at: new Date().toISOString(),
      });
      
      return { success: false, extracted: 0, error: error.message };
    } finally {
      await page.close();
    }
  }, 0);
}

async function main() {
  console.log('🧪 Running smoke tests on failing accounts...\n');
  
  const results: Array<{ username: string; success: boolean; extracted: number; error?: string }> = [];
  
  for (const username of TEST_ACCOUNTS) {
    const result = await smokeTestAccount(username);
    results.push({ username, ...result });
    
    // Wait between accounts
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📊 SUMMARY:');
  console.log('='.repeat(60));
  
  let successCount = 0;
  let totalExtracted = 0;
  
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const extracted = result.extracted > 0 ? `${result.extracted} tweets` : '0 tweets';
    const error = result.error ? ` (${result.error})` : '';
    console.log(`${status} @${result.username}: ${extracted}${error}`);
    
    if (result.success && result.extracted > 0) {
      successCount++;
      totalExtracted += result.extracted;
    }
  }
  
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount}/${results.length}`);
  console.log(`📊 Total extracted: ${totalExtracted} tweets`);
  
  if (successCount === results.length && totalExtracted > 0) {
    console.log('\n🎉 All accounts passed! No evaluate errors.');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some accounts failed. Check logs above.');
    process.exit(1);
  }
}

main().catch(console.error);

