const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

class ImmediatePostingBot {
    constructor() {
        this.client = new TwitterApi({
            appKey: process.env.TWITTER_APP_KEY,
            appSecret: process.env.TWITTER_APP_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_SECRET,
        });
        
        this.healthTechTweets = [
            "🧬 CRISPR-Cas9 technology just achieved 99.1% precision in gene editing trials. The era of genetic medicine is accelerating faster than expected. #GeneTherapy #HealthTech",
            "📊 Digital therapeutics market expected to reach $32.4B by 2030. We're witnessing the transformation from pills to pixels in healthcare delivery. #DigitalHealth",
            "🔬 AI-powered drug discovery reduced development time from 10 years to 3 years for a new Alzheimer's treatment. Technology is rewriting pharmaceutical timelines. #AI #DrugDiscovery",
            "🏥 Telemedicine adoption jumped 3,800% during the pandemic and continues growing. Remote care is becoming the new standard, not the exception. #Telemedicine",
            "🧠 Neural interfaces allowed paralyzed patients to control computers with 96% accuracy. Brain-computer interfaces are moving from sci-fi to medical reality. #NeuroTech",
            "💊 Personalized medicine based on genetic profiles shows 2.5x better outcomes than standard treatments. One-size-fits-all medicine is becoming obsolete. #PrecisionMedicine",
            "🔍 Liquid biopsies can now detect cancer 2 years before symptoms appear. Early detection technology is revolutionizing oncology outcomes. #CancerDetection",
            "📱 Mental health apps show 68% effectiveness in treating anxiety and depression. Digital therapeutics are democratizing mental healthcare access. #MentalHealth",
            "🏭 Lab-grown organs successfully transplanted in human trials. Regenerative medicine is solving the organ shortage crisis. #RegenerativeMedicine",
            "⚡ Real-time glucose monitoring reduces diabetic complications by 40%. Continuous health monitoring is transforming chronic disease management. #DiabetesTech"
        ];
        
        this.currentIndex = 0;
        this.isRunning = false;
    }
    
    async start() {
        console.log('🚀 IMMEDIATE POSTING BOT STARTED');
        console.log('=================================');
        console.log('📊 Bot will post every 2 hours');
        console.log('🎯 Focus: Health Tech & Medical Innovation');
        
        this.isRunning = true;
        
        // Post immediately
        await this.postNextTweet();
        
        // Then post every 2 hours
        setInterval(async () => {
            if (this.isRunning) {
                await this.postNextTweet();
            }
        }, 2 * 60 * 60 * 1000); // 2 hours
        
        console.log('✅ Bot is now running - tweets will post every 2 hours');
    }
    
    async postNextTweet() {
        try {
            const tweet = this.healthTechTweets[this.currentIndex];
            
            console.log(`\n📤 Posting tweet ${this.currentIndex + 1}/${this.healthTechTweets.length}:`);
            console.log(`📝 ${tweet}`);
            
            const result = await this.client.v2.tweet(tweet);
            
            console.log(`✅ Tweet posted successfully!`);
            console.log(`🔗 Tweet ID: ${result.data.id}`);
            console.log(`⏰ Posted at: ${new Date().toISOString()}`);
            
            // Move to next tweet
            this.currentIndex = (this.currentIndex + 1) % this.healthTechTweets.length;
            
            // Save success to database
            await this.saveTweetToDatabase(result.data.id, tweet);
            
        } catch (error) {
            console.log('❌ Failed to post tweet:', error.message);
            
            // Try next tweet on failure
            this.currentIndex = (this.currentIndex + 1) % this.healthTechTweets.length;
        }
    }
    
    async saveTweetToDatabase(tweetId, content) {
        try {
            // Simple database save using existing script
            const { exec } = require('child_process');
            exec(`node save_posted_tweet_to_database.js ${tweetId} "${content}"`, (error, stdout, stderr) => {
                if (error) {
                    console.log('⚠️  Database save failed:', error.message);
                } else {
                    console.log('💾 Tweet saved to database');
                }
            });
        } catch (error) {
            console.log('⚠️  Database save error:', error.message);
        }
    }
    
    stop() {
        this.isRunning = false;
        console.log('🛑 Bot stopped');
    }
}

// Start the bot
const bot = new ImmediatePostingBot();
bot.start().catch(console.error);

// Keep the process running
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, stopping bot...');
    bot.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, stopping bot...');
    bot.stop();
    process.exit(0);
}); 