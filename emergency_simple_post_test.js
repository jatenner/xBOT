const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

async function emergencyPostTest() {
    console.log('🚨 EMERGENCY SIMPLE POSTING TEST');
    console.log('================================');
    
    console.log('🔍 Checking environment variables...');
    const apiKey = process.env.TWITTER_APP_KEY;
    const apiSecret = process.env.TWITTER_APP_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_SECRET;

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        console.log('❌ Missing Twitter API credentials');
        console.log(`API Key: ${apiKey ? 'Present' : 'Missing'}`);
        console.log(`API Secret: ${apiSecret ? 'Present' : 'Missing'}`);
        console.log(`Access Token: ${accessToken ? 'Present' : 'Missing'}`);
        console.log(`Access Secret: ${accessSecret ? 'Present' : 'Missing'}`);
        return;
    }
    
    console.log('✅ All Twitter credentials present');
    
    try {
        // Initialize Twitter client - exact same pattern as xClient.ts
        const client = new TwitterApi({
            appKey: apiKey,
            appSecret: apiSecret,
            accessToken: accessToken,
            accessSecret: accessSecret,
        });

        console.log('🔑 Twitter client initialized');
        
        // Test basic API access
        console.log('📊 Testing API access...');
        try {
            const me = await client.currentUser();
            console.log(`✅ Connected as: @${me.screen_name} (${me.name})`);
            console.log(`📊 Account stats: ${me.statuses_count} tweets, ${me.followers_count} followers`);
        } catch (authError) {
            console.log('❌ Authentication failed:', authError.message);
            if (authError.data) {
                console.log('📊 Auth error details:', JSON.stringify(authError.data, null, 2));
            }
            throw authError;
        }
        
        // Simple test tweet
        const testTweet = `🧬 AI breakthrough: New precision medicine protocols showing 94% success rate in early trials. The future of personalized healthcare is here! #HealthTech #AI`;
        
        console.log('📤 Attempting to post test tweet...');
        console.log(`📝 Tweet content: ${testTweet}`);
        console.log(`📏 Tweet length: ${testTweet.length} characters`);
        
        // Use exact same method as xClient.ts
        const tweet = await client.v2.tweet(testTweet);
        
        console.log('✅ SUCCESS! Tweet posted');
        console.log(`🔗 Tweet ID: ${tweet.data.id}`);
        console.log(`📊 Tweet text: ${tweet.data.text}`);
        
        return tweet;
        
    } catch (error) {
        console.log('❌ ERROR:', error.message);
        console.log('🔍 Error type:', error.constructor.name);
        
        if (error.code) {
            console.log('📊 Error code:', error.code);
        }
        
        if (error.data) {
            console.log('📊 Error details:', JSON.stringify(error.data, null, 2));
        }
        
        if (error.errors) {
            console.log('📊 API errors:', JSON.stringify(error.errors, null, 2));
        }
        
        // Check for specific error types
        if (error.message.includes('401')) {
            console.log('🔧 Suggestion: Check Twitter API credentials and permissions');
        } else if (error.message.includes('403')) {
            console.log('🔧 Suggestion: Check if Twitter app has write permissions');
        } else if (error.message.includes('429')) {
            console.log('🔧 Suggestion: Rate limit exceeded, wait before trying again');
        }
        
        throw error;
    }
}

// Run the test
emergencyPostTest()
    .then(() => {
        console.log('🎉 Emergency posting test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.log('💥 Emergency posting test failed!');
        console.log('🔧 This indicates a Twitter API configuration issue');
        process.exit(1);
    }); 