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
      
      for (let i = 0; i < Math.min(tweetElements.length, 25); i++) {
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
          
          // ULTRA-AGGRESSIVE FILTERING: Maximize reply opportunities since they get better engagement
          const hasContent = content.length > 10; // Lowered threshold
          const hasReplyOpportunity = replyCount < 150; // Increased for more opportunities
          const isEngageable = !content.includes('http') && !content.includes('RT @');
          const isHealthRelated = /health|fitness|nutrition|supplement|sleep|exercise|diet|wellness|biohack|longevity|gut|brain|energy|stress|anxiety|depression|weight|muscle|cardio|strength|recovery|immune|inflammation|hormone|vitamin|mineral|protein|fasting|keto|paleo|metabolism|cortisol|insulin|dopamine|serotonin|testosterone|estrogen|thyroid|adrenal|mitochondria|autophagy|glycogen|ketosis|microbiome|probiotics|prebiotics|fiber|antioxidant|polyphenol/i.test(content);
          const isEngaging = replyCount >= 1; // Any engagement is good
          const isFromInfluencer = /verified|\u2713/.test(tweet.innerHTML); // Target verified accounts more
          const hasSpecificTopics = /mg|gram|study|research|protocol|method|technique|strategy|hack|tip|secret|truth|fact|science|data|result|benefit|effect|mechanism|pathway|receptor|enzyme/i.test(content);
          
          // Enhanced filtering logic - replies get better engagement so be more aggressive
          const shouldReply = hasContent && hasReplyOpportunity && isEngageable && (
            (isHealthRelated && isEngaging) || 
            (isFromInfluencer && hasSpecificTopics) ||
            (isHealthRelated && hasSpecificTopics)
          );
          
          if (shouldReply) {
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

/**
 * Extract specific health topics from tweet content
 */
function extractHealthTopics(content: string): string[] {
  const healthKeywords = {
    'supplements': ['magnesium', 'vitamin', 'omega', 'protein', 'creatine', 'zinc', 'b12', 'iron', 'calcium'],
    'exercise': ['workout', 'training', 'cardio', 'strength', 'hiit', 'running', 'lifting', 'yoga'],
    'nutrition': ['diet', 'fasting', 'keto', 'carbs', 'protein', 'fat', 'calories', 'meal'],
    'sleep': ['sleep', 'melatonin', 'circadian', 'insomnia', 'rem', 'deep sleep', 'wake'],
    'mental_health': ['anxiety', 'depression', 'stress', 'meditation', 'mindfulness', 'dopamine', 'serotonin'],
    'longevity': ['aging', 'longevity', 'lifespan', 'anti-aging', 'cellular', 'mitochondria', 'autophagy'],
    'gut_health': ['gut', 'microbiome', 'probiotics', 'digestion', 'fiber', 'inflammation', 'leaky gut']
  };
  
  const contentLower = content.toLowerCase();
  const topics: string[] = [];
  
  for (const [category, keywords] of Object.entries(healthKeywords)) {
    if (keywords.some(keyword => contentLower.includes(keyword))) {
      topics.push(category);
    }
  }
  
  return topics;
}

/**
 * Identify key biological mechanisms mentioned
 */
function identifyKeyMechanisms(content: string): string[] {
  const mechanisms = [
    'mtor', 'ampk', 'autophagy', 'mitochondria', 'insulin', 'glucose', 'cortisol',
    'inflammation', 'oxidative stress', 'glycogen', 'ketosis', 'metabolism',
    'neurotransmitter', 'hormone', 'enzyme', 'pathway', 'receptor', 'protein synthesis'
  ];
  
  const contentLower = content.toLowerCase();
  return mechanisms.filter(mechanism => contentLower.includes(mechanism));
}

async function generateContextAwareReply(tweet: TweetToReplyTo, influencer: any): Promise<string | null> {
  try {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Analyze the tweet content for specific health topics
    const healthTopics = extractHealthTopics(tweet.content);
    const keyMechanisms = identifyKeyMechanisms(tweet.content);
    
    // Select reply strategy for variety and maximum engagement
    const strategies = [
      'mechanism_expert', 'study_data', 'protocol_enhancement', 
      'unexpected_connection', 'actionable_insight', 'brand_specific'
    ];
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    
    const strategyPrompts = {
      mechanism_expert: 'Focus on explaining the biological mechanism or pathway behind their point',
      study_data: 'Include specific recent research data and percentage improvements',
      protocol_enhancement: 'Suggest a specific enhancement or optimization to their approach',
      unexpected_connection: 'Connect their point to an unexpected but related health factor',
      actionable_insight: 'Provide immediate, specific actionable steps they can take',
      brand_specific: 'Mention specific brands, dosages, or products that optimize their approach'
    };
    
    console.log(`🎯 REPLY_STRATEGY: Using ${strategy} approach for maximum engagement`);
    
    const contextPrompt = `You are a leading health expert and researcher replying to a tweet. Generate an EXTRAORDINARILY VALUABLE reply that makes people think "this person knows their stuff":

TWEET TO REPLY TO:
"${tweet.content}"
BY: ${tweet.author}
TOPIC: ${tweet.topic}
INFLUENCER EXPERTISE: ${influencer.expertise}
DETECTED HEALTH TOPICS: ${healthTopics.join(', ')}
KEY MECHANISMS: ${keyMechanisms.join(', ')}
REPLY STRATEGY: ${strategy.toUpperCase()}
STRATEGY FOCUS: ${strategyPrompts[strategy]}

CREATE A REPLY THAT:

🎯 CONTENT STRATEGY:
- Add a SPECIFIC mechanism, pathway, or biological process that explains WHY their point works
- Include EXACT numbers from recent studies (2022-2024 preferred)
- Mention specific brands, dosages, or protocols when relevant
- Connect to a related but unexpected factor most people don't know
- Make it immediately actionable with clear next steps

📊 FORMATTING REQUIREMENTS:
- 200-240 characters (use every character for value)
- NO quotes around the content
- NO generic acknowledgments ("great point", "love this", "thanks")
- NO emoji or hashtags
- Sound like a peer researcher, not a fan
- Include specific timeframes when mentioning results

🧬 EXAMPLES OF PERFECT REPLIES:
"The key is glutathione recycling - that's why NAC works better with glycine (2:1 ratio). A 2023 study showed 47% better absorption when taken with 500mg vitamin C on empty stomach."

"Interesting connection to circadian biology here. The same pathway upregulates CLOCK genes, which is why this protocol works 3x better when done 2-3 hours before your usual bedtime."

"This activates the mTOR pathway differently than expected. Japanese research from 2024 found combining it with 15-minute cold exposure increased biomarkers by 89% in 28 days."

💡 GENERATE ONE STRATEGIC REPLY THAT DEMONSTRATES DEEP EXPERTISE:`;

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
