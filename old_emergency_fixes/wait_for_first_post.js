#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://lqzqqxgrmxpnwivvzyqz.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxenFxeGdybXhwbndpdnZ6eXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE4Mzk1NzQsImV4cCI6MjA0NzQxNTU3NH0.s-9vCfcEjfKpPXtUhfKQ69r4Y4hcf3cIE8RjxQ7mRR4';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 WAITING FOR FIRST POST FROM YOUR BOT');
console.log('=====================================');
console.log('📊 Monitoring database for new tweets...');
console.log('⏱️  Bot startup delay: ~2-3 minutes');
console.log('🎯 Health tech content will appear soon!');
console.log('');

let lastTweetCount = 0;
let startTime = Date.now();

async function checkForNewPosts() {
    try {
        // Get latest tweets from database
        const { data: tweets, error } = await supabase
            .from('tweets')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.log('⚠️  Database check error:', error.message);
            return;
        }

        const currentCount = tweets?.length || 0;
        const runtime = Math.floor((Date.now() - startTime) / 1000);
        
        console.log(`⏱️  Runtime: ${Math.floor(runtime/60)}m ${runtime%60}s | Tweets: ${currentCount}`);

        if (currentCount > lastTweetCount) {
            console.log('');
            console.log('🎉 NEW POST DETECTED!');
            console.log('==================');
            
            const latestTweet = tweets[0];
            console.log(`📝 Content: ${latestTweet.content?.substring(0, 100)}...`);
            console.log(`⏰ Posted: ${new Date(latestTweet.created_at).toLocaleTimeString()}`);
            console.log(`📊 Tweet ID: ${latestTweet.tweet_id || 'Processing...'}`);
            console.log(`🎯 Type: ${latestTweet.type || 'Standard tweet'}`);
            
            if (latestTweet.tweet_id) {
                console.log(`🔗 View on Twitter: https://twitter.com/SignalAndSynapse/status/${latestTweet.tweet_id}`);
            }
            
            console.log('');
            console.log('🚀 YOUR BOT IS LIVE AND POSTING!');
            
            lastTweetCount = currentCount;
        }

        // Check bot health/activity
        const { data: activity, error: activityError } = await supabase
            .from('bot_activity')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(1);

        if (!activityError && activity?.length > 0) {
            const lastActivity = activity[0];
            const timeSince = Math.floor((Date.now() - new Date(lastActivity.timestamp).getTime()) / 1000);
            
            if (timeSince < 60) {
                console.log(`🤖 Bot active: ${lastActivity.activity_type} (${timeSince}s ago)`);
            }
        }

    } catch (error) {
        console.log('⚠️  Monitor error:', error.message);
    }
}

// Check every 10 seconds
setInterval(checkForNewPosts, 10000);

// Initial check
checkForNewPosts();

console.log('🔄 Monitoring every 10 seconds...');
console.log('📱 Press Ctrl+C to stop monitoring');
console.log(''); 