#!/usr/bin/env node

/**
 * 🧠 OPENAI + X INTEGRATION
 * Generates tweets with OpenAI and posts them headlessly to X
 */

const HeadlessXPoster = require('./headless-x-poster');
const OpenAI = require('openai');

class OpenAIXIntegration {
  constructor() {
    // Check for OpenAI API key in environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({ apiKey });
    this.poster = new HeadlessXPoster();
    console.log('🤖 OpenAI + X Integration initialized');
  }

  async generateTweet(topic = null, style = 'informative') {
    console.log('🧠 Generating tweet with OpenAI...');
    
    const prompts = {
      informative: `Generate an informative, engaging tweet about ${topic || 'health and wellness'}. Make it educational but accessible. Include an interesting fact or tip. Keep it under 280 characters. No hashtags.`,
      
      conversational: `Write a conversational tweet about ${topic || 'health and wellness'} that sounds human and relatable. Ask a question or share a personal insight. Keep it under 280 characters. No hashtags.`,
      
      contrarian: `Write a contrarian take on ${topic || 'common health advice'} that challenges conventional wisdom with evidence-based insights. Be thought-provoking but not controversial. Keep it under 280 characters. No hashtags.`,
      
      story: `Tell a brief, engaging story or anecdote related to ${topic || 'health and wellness'} that has a clear lesson or insight. Keep it under 280 characters. No hashtags.`
    };

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a health and wellness expert who writes engaging, evidence-based content for social media. Your tweets are informative, accessible, and never include hashtags or emojis unless specifically requested.'
          },
          {
            role: 'user',
            content: prompts[style] || prompts.informative
          }
        ],
        max_tokens: 100,
        temperature: 0.8
      });

      const tweet = response.choices[0].message.content.trim();
      console.log(`✅ Generated tweet: "${tweet}"`);
      
      // Validate length
      if (tweet.length > 280) {
        console.log('⚠️ Tweet too long, truncating...');
        return tweet.substring(0, 277) + '...';
      }
      
      return tweet;
      
    } catch (error) {
      console.error('❌ OpenAI generation failed:', error.message);
      throw error;
    }
  }

  async postGeneratedTweet(topic = null, style = 'informative') {
    console.log('🚀 Starting OpenAI + X Integration...');
    
    try {
      // Initialize the poster
      await this.poster.initialize();
      
      // Generate tweet
      const tweet = await this.generateTweet(topic, style);
      
      // Post tweet
      console.log('📤 Posting generated tweet...');
      const result = await this.poster.postTweet(tweet);
      
      console.log('🎉 Success! Tweet posted:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Integration failed:', error.message);
      throw error;
    } finally {
      await this.poster.close();
    }
  }

  async generateMultipleTweets(count = 3, topic = null, style = 'informative') {
    console.log(`🧠 Generating ${count} tweets with OpenAI...`);
    
    const tweets = [];
    for (let i = 0; i < count; i++) {
      try {
        const tweet = await this.generateTweet(topic, style);
        tweets.push(tweet);
        console.log(`✅ Generated tweet ${i + 1}/${count}`);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Failed to generate tweet ${i + 1}:`, error.message);
      }
    }
    
    return tweets;
  }

  async postMultipleTweets(tweets, delayMinutes = 30) {
    console.log(`📤 Posting ${tweets.length} tweets with ${delayMinutes} minute delays...`);
    
    await this.poster.initialize();
    
    const results = [];
    
    for (let i = 0; i < tweets.length; i++) {
      try {
        console.log(`\n📤 Posting tweet ${i + 1}/${tweets.length}...`);
        const result = await this.poster.postTweet(tweets[i]);
        results.push(result);
        console.log(`✅ Tweet ${i + 1} posted successfully`);
        
        // Wait before next tweet (except for the last one)
        if (i < tweets.length - 1) {
          const delayMs = delayMinutes * 60 * 1000;
          console.log(`⏳ Waiting ${delayMinutes} minutes before next tweet...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
      } catch (error) {
        console.error(`❌ Failed to post tweet ${i + 1}:`, error.message);
        results.push({ success: false, error: error.message });
      }
    }
    
    await this.poster.close();
    return results;
  }
}

// Export for use in other modules
module.exports = OpenAIXIntegration;

// CLI usage
if (require.main === module) {
  async function main() {
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY environment variable is required');
      process.exit(1);
    }

    const integration = new OpenAIXIntegration();
    
    const command = process.argv[2] || 'single';
    const topic = process.argv[3] || null;
    const style = process.argv[4] || 'informative';
    
    try {
      switch (command) {
        case 'single':
          console.log('🎯 Posting single generated tweet...');
          await integration.postGeneratedTweet(topic, style);
          break;
          
        case 'generate':
          const count = parseInt(process.argv[3]) || 3;
          const tweets = await integration.generateMultipleTweets(count, topic, style);
          console.log('\n📝 Generated tweets:');
          tweets.forEach((tweet, i) => {
            console.log(`${i + 1}. ${tweet}`);
          });
          break;
          
        case 'batch':
          const batchCount = parseInt(process.argv[3]) || 3;
          const batchTopic = process.argv[4] || null;
          const delayMinutes = parseInt(process.argv[5]) || 30;
          
          console.log(`🎯 Generating and posting ${batchCount} tweets...`);
          const generatedTweets = await integration.generateMultipleTweets(batchCount, batchTopic, style);
          const results = await integration.postMultipleTweets(generatedTweets, delayMinutes);
          
          console.log('\n📊 Batch posting results:');
          results.forEach((result, i) => {
            console.log(`${i + 1}. ${result.success ? '✅ Success' : '❌ Failed'}: ${result.tweetId || result.error}`);
          });
          break;
          
        default:
          console.log('Usage:');
          console.log('  node openai-x-integration.js single [topic] [style]');
          console.log('  node openai-x-integration.js generate [count] [topic] [style]');
          console.log('  node openai-x-integration.js batch [count] [topic] [delayMinutes]');
          console.log('');
          console.log('Styles: informative, conversational, contrarian, story');
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
  
  main();
}
