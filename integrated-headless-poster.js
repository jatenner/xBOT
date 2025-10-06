#!/usr/bin/env node

/**
 * 🔗 INTEGRATED HEADLESS POSTER
 * Works with your existing xBOT environment and configuration
 */

const HeadlessXPoster = require('./headless-x-poster');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Load environment variables from your config files
function loadEnvironment() {
  const envFiles = [
    './config/production.env',
    './railway_session.env',
    './.env'
  ];
  
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      console.log(`📋 Loading environment from ${envFile}`);
      const content = fs.readFileSync(envFile, 'utf8');
      
      // Parse simple KEY=VALUE format
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=');
            if (!process.env[key]) { // Don't override existing env vars
              process.env[key] = value;
            }
          }
        }
      });
    }
  }
}

class IntegratedXBot {
  constructor() {
    // Load environment first
    loadEnvironment();
    
    // Initialize components
    this.poster = new HeadlessXPoster();
    
    // Initialize OpenAI if key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      console.log('✅ OpenAI integration enabled');
    } else {
      console.log('⚠️ OpenAI API key not found - AI generation disabled');
    }
  }

  async initialize() {
    console.log('🚀 Initializing Integrated X Bot...');
    await this.poster.initialize();
    console.log('✅ Integrated X Bot ready');
  }

  async generateHealthTweet(style = 'informative') {
    if (!this.openai) {
      throw new Error('OpenAI not configured - set OPENAI_API_KEY');
    }

    const prompts = {
      informative: 'Generate an informative, engaging tweet about health and wellness. Make it educational but accessible. Include an interesting fact or tip. Keep it under 280 characters. No hashtags.',
      
      contrarian: 'Write a contrarian take on common health advice that challenges conventional wisdom with evidence-based insights. Be thought-provoking but not controversial. Keep it under 280 characters. No hashtags.',
      
      story: 'Tell a brief, engaging story or anecdote related to health and wellness that has a clear lesson or insight. Keep it under 280 characters. No hashtags.',
      
      tip: 'Share a practical, actionable health tip that people can implement today. Make it specific and valuable. Keep it under 280 characters. No hashtags.'
    };

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a health and wellness expert who writes engaging, evidence-based content for social media. Your tweets are informative, accessible, and never include hashtags or emojis unless specifically requested. Focus on actionable insights and interesting facts.'
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
      
      // Validate length
      if (tweet.length > 280) {
        return tweet.substring(0, 277) + '...';
      }
      
      return tweet;
      
    } catch (error) {
      console.error('❌ OpenAI generation failed:', error.message);
      throw error;
    }
  }

  async postTweet(text) {
    return await this.poster.postTweet(text);
  }

  async postGeneratedTweet(style = 'informative') {
    console.log(`🧠 Generating and posting ${style} tweet...`);
    
    const tweet = await this.generateHealthTweet(style);
    console.log(`📝 Generated: "${tweet}"`);
    
    const result = await this.postTweet(tweet);
    console.log(`📤 Posted: ${result.success ? '✅ Success' : '❌ Failed'}`);
    
    return { tweet, result };
  }

  async close() {
    await this.poster.close();
  }
}

// Export for use in other modules
module.exports = IntegratedXBot;

// CLI usage
if (require.main === module) {
  async function main() {
    const bot = new IntegratedXBot();
    
    try {
      await bot.initialize();
      
      const command = process.argv[2] || 'post';
      
      switch (command) {
        case 'post':
          const text = process.argv[3] || `🤖 Integrated headless posting test at ${new Date().toLocaleTimeString()}`;
          const result = await bot.postTweet(text);
          console.log('📊 Result:', result);
          break;
          
        case 'generate':
          const style = process.argv[3] || 'informative';
          const generated = await bot.postGeneratedTweet(style);
          console.log('📊 Generated and posted:', generated);
          break;
          
        case 'test':
          console.log('🧪 Running integration tests...');
          
          // Test 1: Basic posting
          console.log('\n1️⃣ Testing basic posting...');
          const testResult = await bot.postTweet('🧪 Integration test - basic posting');
          console.log(`   Result: ${testResult.success ? '✅ Success' : '❌ Failed'}`);
          
          // Test 2: AI generation (if available)
          if (bot.openai) {
            console.log('\n2️⃣ Testing AI generation...');
            const aiTweet = await bot.generateHealthTweet('tip');
            console.log(`   Generated: "${aiTweet}"`);
            
            console.log('\n3️⃣ Testing AI posting...');
            const aiResult = await bot.postTweet(aiTweet);
            console.log(`   Result: ${aiResult.success ? '✅ Success' : '❌ Failed'}`);
          } else {
            console.log('\n2️⃣ Skipping AI tests - OpenAI not configured');
          }
          
          console.log('\n✅ Integration tests complete');
          break;
          
        default:
          console.log('Usage:');
          console.log('  node integrated-headless-poster.js post [text]');
          console.log('  node integrated-headless-poster.js generate [style]');
          console.log('  node integrated-headless-poster.js test');
          console.log('');
          console.log('Styles: informative, contrarian, story, tip');
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await bot.close();
    }
  }
  
  main();
}
