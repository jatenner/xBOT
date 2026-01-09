/**
 * Test content extraction on real tweets
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';

const TEST_ACCOUNTS = ['DrMarkHyman', 'hubermanlab', 'PeterAttiaMD'];

async function testContentExtraction() {
  const pool = UnifiedBrowserPool.getInstance();
  
  for (const username of TEST_ACCOUNTS) {
    console.log(`\n🧪 Testing @${username}...`);
    
    await pool.withContext('content_test', async (context) => {
      const page = await context.newPage();
      
      try {
        const profileUrl = `https://x.com/${username}`;
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        
        // Extract first 3 tweets with improved content extraction
        const tweets = await page.evaluate((payload: { count: number }) => {
          const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
          const results: any[] = [];
          
          for (let i = 0; i < Math.min(articles.length, payload.count); i++) {
            const article = articles[i];
            
            // Skip replies
            const socialContext = article.querySelector('[data-testid="socialContext"]');
            const hasReplyIndicator = socialContext ? 
              /Replying to/i.test(socialContext.textContent || '') : false;
            
            if (hasReplyIndicator) {
              continue;
            }
            
            // Extract tweet ID
            const tweetLink = article.querySelector('a[href*="/status/"]');
            if (!tweetLink) continue;
            
            const href = tweetLink.getAttribute('href') || '';
            const match = href.match(/\/status\/(\d+)/);
            if (!match) continue;
            
            const tweet_id = match[1];
            
            // ROBUST content extraction
            const tweetTextContainer = article.querySelector('[data-testid="tweetText"]');
            let content = '';
            if (tweetTextContainer) {
              const spans = tweetTextContainer.querySelectorAll('span');
              const textParts: string[] = [];
              spans.forEach(span => {
                const text = span.textContent?.trim();
                if (text && text.length > 0) {
                  textParts.push(text);
                }
              });
              if (textParts.length === 0) {
                content = tweetTextContainer.textContent?.trim() || '';
              } else {
                content = textParts.join(' ').replace(/\s+/g, ' ').trim();
              }
            }
            
            results.push({
              tweet_id,
              content_length: content.length,
              content_preview: content.substring(0, 100),
            });
          }
          
          return results;
        }, { count: 3 });
        
        console.log(`✅ Extracted ${tweets.length} tweets:`);
        tweets.forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.tweet_id}: ${t.content_length} chars - "${t.content_preview}..."`);
          if (t.content_length < 50) {
            console.log(`     ⚠️ WARNING: Content length < 50`);
          }
        });
        
      } finally {
        await page.close();
      }
    }, 0);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✅ Content extraction test complete');
}

testContentExtraction().catch(console.error);

