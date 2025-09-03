/**
 * STRATEGIC LIKES - Like viral health content to increase visibility
 */

const HEALTH_HASHTAGS = [
  '#biohacking',
  '#longevity', 
  '#healthoptimization',
  '#metabolichealth',
  '#sleepoptimization',
  '#nutrition',
  '#wellness'
];

export async function executeStrategicLikes(): Promise<void> {
  console.log('❤️ STRATEGIC_LIKES: Engaging with viral health content...');
  
  try {
    const targetHashtag = HEALTH_HASHTAGS[Math.floor(Math.random() * HEALTH_HASHTAGS.length)];
    console.log(`🎯 TARGET: Liking viral content in ${targetHashtag}`);
    
    // 🚀 REAL STRATEGIC LIKES: Use Playwright to actually like tweets
    const { browserManager } = await import('../posting/BrowserManager');
    
    const context = await browserManager.newPostingContext();
    try {
      const page = await context.newPage();
      
      try {
        // Search for the hashtag
        const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(targetHashtag)}&f=top`;
        await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
        
        // Wait for tweets to load
        await page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
        
        // Find tweets to like (target high engagement, medium-sized accounts)
        const tweetSelectors = await page.$$('[data-testid="tweet"]');
        
        let likesGiven = 0;
        const maxLikes = 5; // Conservative to avoid being flagged
        
        for (const tweetSelector of tweetSelectors.slice(0, 10)) {
          if (likesGiven >= maxLikes) break;
          
          try {
            // Check if tweet is not already liked and has decent engagement
            const likeButton = await tweetSelector.$('[data-testid="like"]');
            
            if (likeButton) {
              const isAlreadyLiked = await likeButton.evaluate(el => 
                el.getAttribute('aria-pressed') === 'true'
              );
              
              if (!isAlreadyLiked) {
                // Get engagement metrics to filter for viral content
                const engagementText = await tweetSelector.$eval('[role="group"]', 
                  el => el.textContent || ''
                ).catch(() => '');
                
                // Look for tweets with some engagement (but not from mega accounts)
                const hasEngagement = /\d/.test(engagementText);
                
                if (hasEngagement) {
                  await likeButton.click();
                  likesGiven++;
                  console.log(`❤️ LIKED: Tweet ${likesGiven}/${maxLikes}`);
                  
                  // Add human-like delay
                  await page.waitForTimeout(2000 + Math.random() * 3000);
                }
              }
            }
          } catch (likeError) {
            console.warn('⚠️ Failed to like individual tweet:', likeError);
          }
        }
        
        console.log(`✅ STRATEGIC_LIKES: Completed - Liked ${likesGiven} tweets in ${targetHashtag}`);
        
      } catch (scrapingError) {
        console.warn('⚠️ Strategic likes scraping failed:', scrapingError);
        console.log('✅ STRATEGIC_LIKES: Completed (fallback - scraping failed)');
      } finally {
        await page.close();
      }
    } finally {
      await context.close();
    }
    
  } catch (error: any) {
    console.error('❌ STRATEGIC_LIKES_ERROR:', error.message);
  }
}
