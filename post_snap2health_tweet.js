#!/usr/bin/env node

/**
 * SNAP2HEALTH Tweet Poster
 * Posts optimized healthcare tweets using the SNAP2HEALTH template
 */

const { TwitterApi } = require('twitter-api-v2');
const SNAP2HealthTweetGenerator = require('./generate_snap2health_tweet');
require('dotenv').config();

class SNAP2HealthPoster {
    constructor() {
        // Initialize Twitter client
        this.client = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        });

        this.generator = new SNAP2HealthTweetGenerator();
    }

    async postOptimizedTweet() {
        try {
            console.log('🏥 SNAP2HEALTH X-BOT — Generating optimized tweet...\n');
            
            // Generate optimal tweet
            const tweet = this.generator.generateOptimalTweet();
            
            console.log('📊 TWEET ANALYSIS');
            console.log('=================');
            console.log(`📝 Content: ${tweet.content}`);
            console.log(`📏 Length: ${tweet.length}/270 characters`);
            console.log(`📖 Readability: ${tweet.readabilityEstimate} (Grade-8+ target: ≥55)`);
            console.log(`📈 Engagement Score: ${tweet.score}/100`);
            console.log(`📋 Key Stat: ${tweet.stats}`);
            console.log(`🔗 Source: ${tweet.source}\n`);

            // Validate before posting
            if (tweet.length > 280) {
                throw new Error(`Tweet too long: ${tweet.length} chars`);
            }

            if (tweet.readabilityEstimate < 55) {
                console.log(`⚠️ Warning: Readability ${tweet.readabilityEstimate} below Grade-8 target (55)`);
            }

            console.log('📤 Posting to Twitter/X...');
            
            // Post to Twitter
            const result = await this.client.v2.tweet(tweet.content);
            
            console.log('✅ SNAP2HEALTH tweet posted successfully!');
            console.log(`🔗 Tweet ID: ${result.data.id}`);
            console.log(`⏰ Posted at: ${new Date().toISOString()}`);
            console.log(`🎯 Expected engagement: HIGH (optimized for healthcare audience)`);
            
            // Save to database if available
            await this.saveTweetToDatabase(result.data.id, tweet.content, 'SNAP2HEALTH');
            
            return {
                success: true,
                tweetId: result.data.id,
                content: tweet.content,
                stats: tweet
            };

        } catch (error) {
            console.error('❌ Failed to post SNAP2HEALTH tweet:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async saveTweetToDatabase(tweetId, content, source) {
        try {
            const { exec } = require('child_process');
            exec(`node save_posted_tweet_to_database.js ${tweetId} "${content}" "${source}"`, (error, stdout, stderr) => {
                if (error) {
                    console.log('⚠️ Database save failed:', error.message);
                } else {
                    console.log('💾 Tweet saved to database');
                }
            });
        } catch (error) {
            console.log('⚠️ Database save error:', error.message);
        }
    }

    async testGenerator() {
        console.log('🧪 TESTING SNAP2HEALTH GENERATOR');
        console.log('=================================\n');
        
        for (let i = 1; i <= 3; i++) {
            const tweet = this.generator.generateOptimalTweet();
            console.log(`📝 Sample ${i}:`);
            console.log(`Content: ${tweet.content}`);
            console.log(`Length: ${tweet.length} | Readability: ${tweet.readabilityEstimate} | Score: ${tweet.score}`);
            console.log(`Stats: ${tweet.stats}\n`);
        }
    }
}

// Main execution
async function main() {
    const poster = new SNAP2HealthPoster();
    
    const args = process.argv.slice(2);
    
    if (args.includes('--test')) {
        await poster.testGenerator();
    } else if (args.includes('--post')) {
        await poster.postOptimizedTweet();
    } else {
        console.log('🏥 SNAP2HEALTH X-BOT Tweet Poster');
        console.log('=================================');
        console.log('Usage:');
        console.log('  --test    Generate sample tweets');
        console.log('  --post    Post optimized tweet');
        console.log('\nExample: node post_snap2health_tweet.js --post');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = SNAP2HealthPoster;
