/**
 * STRATEGIC REPLIES - Build followers through strategic conversations
 */

import { Page } from 'playwright';
import { browserManager } from '../posting/BrowserManager';

const HEALTH_INFLUENCERS = [
  { handle: '@hubermanlab', focus: 'neuroscience', expertise: 'dopamine, sleep, protocols' },
  { handle: '@peterattia', focus: 'longevity', expertise: 'metabolic health, exercise, nutrition' },
  { handle: '@rhondapatrick', focus: 'research', expertise: 'micronutrients, sauna, aging' },
  { handle: '@drmarkhyman', focus: 'functional medicine', expertise: 'gut health, detox, inflammation' },
  { handle: '@bengreenfieldhq', focus: 'biohacking', expertise: 'optimization, tech, performance' }
];

interface TweetToReplyTo {
  id: string;
  content: string;
  author: string;
  replyCount: number;
  topic: string;
  url: string;
}

export async function executeStrategicReplies(): Promise<void> {
  console.log('💬 STRATEGIC_REPLIES: Finding high-value conversations...');
  
  try {
    const targetInfluencer = HEALTH_INFLUENCERS[Math.floor(Math.random() * HEALTH_INFLUENCERS.length)];
    console.log(`🎯 TARGET: Analyzing ${targetInfluencer.handle} (${targetInfluencer.focus})`);
    
    const tweet = await findReplyableTweet(targetInfluencer);
    if (!tweet) {
      console.log('⚠️ No suitable tweets found for strategic replies');
      return;
    }
    
    const contextAwareReply = await generateContextAwareReply(tweet, targetInfluencer);
    if (!contextAwareReply) {
      console.log('⚠️ Could not generate suitable context-aware reply');
      return;
    }
    
    console.log(`📝 CONTEXT_REPLY: "${contextAwareReply.substring(0, 80)}..."`);
    console.log(`🎯 REPLYING_TO: "${tweet.content.substring(0, 50)}..." by ${tweet.author}`);
    
    // Post the reply using our posting system
    await postStrategicReply(tweet.url, contextAwareReply);
    
  } catch (error: any) {
    console.error('❌ STRATEGIC_REPLIES_ERROR:', error.message);
  }
}

async function findReplyableTweet(influencer: any): Promise<TweetToReplyTo | null> {
  try {
    return await browserManager.withContext('posting', async (context) => {
      const page = await context.newPage();
    
    // Navigate to influencer's profile
    const profileUrl = `https://x.com/${influencer.handle.replace('@', '')}`;
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    // Find recent tweets with low reply counts
    const tweets = await page.evaluate((focus) => {
      const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
      const results = [];
      
      for (let i = 0; i < Math.min(tweetElements.length, 5); i++) {
        const tweet = tweetElements[i];
        const contentEl = tweet.querySelector('[data-testid="tweetText"]');
        const authorEl = tweet.querySelector('[data-testid="User-Name"]');
        const linkEl = tweet.querySelector('a[href*="/status/"]');
        const replyEl = tweet.querySelector('[data-testid="reply"]');
        
        if (contentEl && authorEl && linkEl) {
          const content = contentEl.textContent || '';
          const author = authorEl.textContent || '';
          const href = linkEl.getAttribute('href') || '';
          const replyText = replyEl?.textContent || '0';
          const replyCount = parseInt(replyText.replace(/[^\d]/g, '')) || 0;
          
          // Look for tweets related to the influencer's focus area with <30 replies
          if (content.length > 50 && replyCount < 30 && content.toLowerCase().includes(focus)) {
            const match = href.match(/\/status\/(\d+)/);
            if (match) {
              results.push({
                id: match[1],
                content,
                author,
                replyCount,
                topic: focus,
                url: `https://x.com${href}`
              });
            }
          }
        }
      }
      return results;
    }, influencer.focus);
    
      return tweets[0] || null;
    });
  } catch (error) {
    console.error('Failed to find replyable tweet:', error);
    return null;
  }
}

async function generateContextAwareReply(tweet: TweetToReplyTo, influencer: any): Promise<string | null> {
  try {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const contextPrompt = `You are a health expert replying to a tweet. Generate a VALUABLE, CONTEXT-AWARE reply that:

TWEET TO REPLY TO:
"${tweet.content}"
BY: ${tweet.author}
TOPIC: ${tweet.topic}
INFLUENCER EXPERTISE: ${influencer.expertise}

REPLY REQUIREMENTS:
- Add SPECIFIC value related to the exact topic mentioned
- Share a LESSER-KNOWN fact that complements their point
- Keep it under 240 characters
- Sound like a knowledgeable peer, not a fan
- Include actionable insight if possible
- NO generic phrases like "great point" or "thanks for sharing"

EXAMPLES OF GOOD REPLIES:
"The mechanism behind this is fascinating - it actually works through upregulating AMPK, which is why timing matters. Best results happen when combined with 16:8 fasting."

"There's also the lesser-known connection to vagal tone. A 2023 study showed this protocol increases HRV by 23% when done consistently for 3 weeks."

Generate ONE strategic reply:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: contextPrompt }],
      max_tokens: 150,
      temperature: 0.7
    });
    
    return response.choices[0]?.message?.content?.trim() || null;
    
  } catch (error) {
    console.error('Failed to generate context-aware reply:', error);
    return null;
  }
}

async function postStrategicReply(tweetUrl: string, replyContent: string): Promise<void> {
  console.log('🚀 POSTING_STRATEGIC_REPLY: Posting context-aware reply...');
  
  try {
    const { TwitterComposer } = await import('../posting/TwitterComposer');
    
    await browserManager.withContext('posting', async (context) => {
      const page = await context.newPage();
      const composer = new TwitterComposer(page);
      
      // Extract tweet ID from URL
      const match = tweetUrl.match(/\/status\/(\d+)/);
      if (!match) throw new Error('Invalid tweet URL');
      
      const tweetId = match[1];
      const result = await composer.postReply(replyContent, tweetId);
      
      if (result.success) {
        console.log(`✅ STRATEGIC_REPLY_POSTED: Reply ID ${result.tweetId}`);
      } else {
        console.error(`❌ STRATEGIC_REPLY_FAILED: ${result.error}`);
      }
    });
    
  } catch (error) {
    console.error('Failed to post strategic reply:', error);
  }
}
