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
    const tweets = await page.evaluate((focusData) => {
      const { focus, healthKeywords } = focusData;
      
      // Helper function inside evaluate context
      function isRelevantHealthContent(content, focusArea) {
        const keywords = healthKeywords[focusArea] || [];
        const generalHealth = ['health', 'wellness', 'fitness', 'diet', 'weight', 'energy'];
        const allKeywords = [...keywords, ...generalHealth];
        const contentLower = content.toLowerCase();
        
        const matchCount = allKeywords.filter(keyword => contentLower.includes(keyword)).length;
        return matchCount >= 2;
      }
      
      const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
      const results = [];
      
      for (let i = 0; i < Math.min(tweetElements.length, 15); i++) {
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
          
          // AGGRESSIVE FILTERING: Maximum engagement opportunities
          const hasContent = content.length > 15;
          const hasReplyOpportunity = replyCount < 100; // Increased from 50
          const isEngageable = !content.includes('http') && !content.includes('RT @');
          const isHealthRelated = /health|fitness|nutrition|supplement|sleep|exercise|diet|wellness|biohack|longevity|gut|brain|energy|stress|anxiety|depression|weight|muscle|cardio|strength|recovery|immune|inflammation|hormone/i.test(content);
          const isPopular = replyCount > 2; // Some engagement shows interest
          
          if (hasContent && hasReplyOpportunity && isEngageable && (isHealthRelated || isPopular)) {
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
    }, {
      focus: influencer.focus,
      healthKeywords: {
        neuroscience: ['brain', 'dopamine', 'serotonin', 'sleep', 'focus', 'cognitive', 'memory', 'stress'],
        longevity: ['aging', 'lifespan', 'exercise', 'nutrition', 'metabolic', 'heart', 'cardiovascular'],
        research: ['study', 'research', 'data', 'science', 'evidence', 'vitamin', 'supplement'],
        'functional medicine': ['gut', 'inflammation', 'immune', 'detox', 'hormone', 'thyroid'],
        biohacking: ['optimize', 'performance', 'protocol', 'hack', 'tracking', 'quantified']
      }
    });
    
      return tweets[0] || null;
    });
  } catch (error) {
    console.error('Failed to find replyable tweet:', error);
    return null;
  }
}

// Helper function to intelligently filter relevant health content
function isRelevantHealthContent(content: string, focus: string): boolean {
  const healthKeywords = {
    neuroscience: ['brain', 'dopamine', 'serotonin', 'sleep', 'focus', 'cognitive', 'memory', 'stress'],
    longevity: ['aging', 'lifespan', 'exercise', 'nutrition', 'metabolic', 'heart', 'cardiovascular'],
    research: ['study', 'research', 'data', 'science', 'evidence', 'vitamin', 'supplement'],
    'functional medicine': ['gut', 'inflammation', 'immune', 'detox', 'hormone', 'thyroid'],
    biohacking: ['optimize', 'performance', 'protocol', 'hack', 'tracking', 'quantified']
  };
  
  const focusKeywords = healthKeywords[focus as keyof typeof healthKeywords] || [];
  const generalHealth = ['health', 'wellness', 'fitness', 'diet', 'weight', 'energy'];
  
  const allKeywords = [...focusKeywords, ...generalHealth];
  const contentLower = content.toLowerCase();
  
  // Must contain at least 2 relevant keywords to ensure we understand the topic
  const matchCount = allKeywords.filter(keyword => contentLower.includes(keyword)).length;
  return matchCount >= 2;
}

async function generateContextAwareReply(tweet: TweetToReplyTo, influencer: any): Promise<string | null> {
  try {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const contextPrompt = `You are a health expert replying to a tweet. Generate a HIGHLY VALUABLE, CONTEXT-AWARE reply that adds genuine insight:

TWEET TO REPLY TO:
"${tweet.content}"
BY: ${tweet.author}
TOPIC: ${tweet.topic}
INFLUENCER EXPERTISE: ${influencer.expertise}

REPLY REQUIREMENTS:
- Add SPECIFIC, ACTIONABLE value related to the exact topic mentioned
- Share a LESSER-KNOWN fact, mechanism, or protocol that complements their point
- Include specific numbers, studies, or brands when relevant
- Keep it under 240 characters
- Sound like a knowledgeable peer adding valuable context
- Include actionable insight or protocol if possible
- NO generic phrases like "great point", "thanks for sharing", or "love this"
- NO quotes around the reply content
- Make it so valuable people will want to follow for more insights

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
        
        // 📊 STORE REPLY DATA FOR LEARNING
        await storeReplyForLearning(result.tweetId!, replyContent, tweetUrl);
      } else {
        console.error(`❌ STRATEGIC_REPLY_FAILED: ${result.error}`);
      }
    });
    
  } catch (error) {
    console.error('Failed to post strategic reply:', error);
  }
}

async function storeReplyForLearning(replyId: string, replyContent: string, originalTweetUrl: string): Promise<void> {
  try {
    console.log('📊 STORING_REPLY_DATA: Saving reply for learning analysis');
    
    const { admin } = await import('../lib/supabaseClients');
    const supabase = admin;
    
    // Store in learning_posts table as reply type
    const { error } = await supabase
      .from('learning_posts')
      .insert([{
        tweet_id: replyId,
        content: replyContent,
        content_type: 'reply',
        is_thread: false,
        replied_to_url: originalTweetUrl,
        posted_at: new Date().toISOString(),
        likes: 0,
        retweets: 0,
        replies: 0,
        impressions: 0,
        engagement_score: 0,
        learning_metadata: {
          type: 'strategic_reply',
          context_aware: true,
          original_tweet_url: originalTweetUrl,
          generated_at: new Date().toISOString()
        }
      }]);

    if (error) {
      console.warn('⚠️ REPLY_STORAGE_WARNING:', error.message);
    } else {
      console.log('✅ REPLY_DATA_STORED: Reply data saved for learning');
    }
    
    // Start engagement tracking for this reply
    const { RealEngagementIntegration } = await import('../learning/realEngagementIntegration');
    const engagementTracker = RealEngagementIntegration.getInstance();
    await engagementTracker.startTracking(replyId);
    
  } catch (error) {
    console.error('❌ REPLY_STORAGE_FAILED:', error);
  }
}
