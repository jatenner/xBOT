import { Page, Response } from 'playwright';

export type PostResult = { 
  rootId: string; 
  ids: string[];
  success: boolean;
  error?: string;
};

export async function postThread(
  page: Page, 
  hook: string, 
  tweets: { text: string }[]
): Promise<PostResult> {
  const ids: string[] = [];
  let rootId = '';

  try {
    console.log(`🧵 Starting thread post: hook + ${tweets.length} tweets`);

    // Post the hook (first tweet)
    rootId = await postSingleTweet(page, hook);
    ids.push(rootId);
    console.log(`✅ Posted hook: ${rootId}`);

    // Post each reply in sequence
    for (let i = 0; i < tweets.length; i++) {
      const replyId = await postSingleTweet(page, tweets[i].text, rootId);
      ids.push(replyId);
      console.log(`✅ Posted reply ${i + 1}/${tweets.length}: ${replyId}`);
      
      // Brief pause between tweets to avoid rate limiting
      await page.waitForTimeout(1000);
    }

    console.log(`🎉 Thread completed successfully: ${ids.length} tweets posted`);
    return { rootId, ids, success: true };

  } catch (error) {
    console.error(`❌ Thread posting failed:`, error);
    
    // If we have a partial thread, we should ideally clean it up
    // For now, we'll just return the failure
    return { 
      rootId, 
      ids, 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function postSingleTweet(
  page: Page, 
  text: string, 
  inReplyToId?: string
): Promise<string> {
  let createdId: string | undefined;
  let responseReceived = false;

  // Set up response interceptor to capture CreateTweet response
  const responseHandler = (response: Response) => {
    const url = response.url();
    const method = response.request().method();
    
    if (url.includes('/CreateTweet') && method === 'POST') {
      console.log(`📡 Intercepted CreateTweet response`);
      
      response.json().then(jsonData => {
        const restId = jsonData?.data?.create_tweet?.tweet_results?.result?.rest_id;
        if (restId) {
          createdId = restId;
          console.log(`🎯 Extracted tweet ID: ${restId}`);
        } else {
          console.warn(`⚠️ CreateTweet response missing rest_id:`, jsonData);
        }
        responseReceived = true;
      }).catch(error => {
        console.error('Error parsing CreateTweet response:', error);
        responseReceived = true;
      });
    }
  };

  page.on('response', responseHandler);

  try {
    if (inReplyToId) {
      // Posting a reply
      console.log(`💬 Posting reply to ${inReplyToId}`);
      
      // Navigate to the tweet we're replying to
      await page.goto(`https://x.com/i/status/${inReplyToId}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      // Wait for and click reply button
      await page.waitForSelector('[data-testid="reply"]', { timeout: 15000 });
      await page.click('[data-testid="reply"]');
      
      // Wait for reply composer
      await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 15000 });
      
    } else {
      // Posting a new tweet
      console.log(`📝 Posting new tweet`);
      
      // Navigate to home and open composer
      await page.goto('https://x.com/home', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      // Click the compose button
      await page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { timeout: 15000 });
      await page.click('[data-testid="SideNav_NewTweet_Button"]');
      
      // Wait for composer to open
      await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 15000 });
    }

    // FINAL SANITIZER: Strip any remaining formatting and validate
    const { stripFormatting, validateTweetText } = await import('../utils/text/sanitize');
    const sanitizedText = stripFormatting(text);
    
    const validation = validateTweetText(sanitizedText);
    if (!validation.valid) {
      throw new Error(`Final validation failed: ${validation.reason}. Text: "${sanitizedText}"`);
    }
    
    console.log(`📝 Final sanitized text (${sanitizedText.length} chars): ${sanitizedText.substring(0, 80)}${sanitizedText.length > 80 ? '...' : ''}`);
    
    // Clear any existing text and type our sanitized content
    await page.fill('[data-testid="tweetTextarea_0"]', '');
    await page.type('[data-testid="tweetTextarea_0"]', sanitizedText);
    
    // Wait a moment for the interface to update
    await page.waitForTimeout(500);

    // Click the tweet/reply button
    const tweetButton = await page.waitForSelector('[data-testid="tweetButton"]', { timeout: 15000 });
    await tweetButton.click();

    console.log(`📤 Tweet submitted, waiting for response...`);

    // Wait for the CreateTweet response (up to 20 seconds)
    const startTime = Date.now();
    while (!responseReceived && Date.now() - startTime < 20000) {
      await page.waitForTimeout(200);
    }

    if (!createdId) {
      throw new Error('Failed to capture tweet ID from CreateTweet response');
    }

    return createdId;

  } finally {
    page.off('response', responseHandler);
  }
}

export async function deletePartialThread(page: Page, tweetIds: string[]): Promise<void> {
  console.log(`🗑️ Attempting to delete partial thread: ${tweetIds.length} tweets`);
  
  for (const tweetId of tweetIds.reverse()) { // Delete in reverse order
    try {
      await page.goto(`https://x.com/i/status/${tweetId}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      // Click the more options menu
      const moreButton = await page.waitForSelector('[data-testid="caret"]', { timeout: 10000 });
      await moreButton.click();
      
      // Click delete
      const deleteButton = await page.waitForSelector('[data-testid="Dropdown"] [role="menuitem"]', { timeout: 5000 });
      await deleteButton.click();
      
      // Confirm deletion
      const confirmButton = await page.waitForSelector('[data-testid="confirmationSheetConfirm"]', { timeout: 5000 });
      await confirmButton.click();
      
      console.log(`✅ Deleted tweet: ${tweetId}`);
      await page.waitForTimeout(1000);
      
    } catch (error) {
      console.warn(`⚠️ Failed to delete tweet ${tweetId}:`, error);
      // Continue with other deletions
    }
  }
}
