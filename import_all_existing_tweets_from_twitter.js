#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const { TwitterApi } = require('twitter-api-v2');

console.log('📥 IMPORTING ALL EXISTING TWEETS FROM TWITTER');
console.log('============================================');
console.log('🎯 Goal: Import your 100+ existing tweets into Supabase');
console.log('🔗 This will complete the data chain and enable AI learning');
console.log('');

// Initialize connections with environment loading
async function initializeClients() {
    console.log('🔧 Initializing connections...');
    
    // Load environment manually
    const fs = require('fs');
    const path = require('path');
    
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envLines = envContent.split('\n');
        
        for (const line of envLines) {
            if (line.trim() && !line.startsWith('#') && line.includes('=')) {
                const [key, ...valueParts] = line.split('=');
                process.env[key.trim()] = valueParts.join('=').trim();
            }
        }
    }
    
    // Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || 'https://lqzqqxgrmxpnwivvzyqz.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseKey) {
        throw new Error('Missing Supabase key in environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Twitter client
    const twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });
    
    console.log('✅ Connections initialized');
    return { supabase, twitter: twitterClient.readOnly };
}

// Get user's own Twitter ID
async function getTwitterUserId(twitter) {
    try {
        console.log('🔍 Getting your Twitter user ID...');
        const user = await twitter.currentUser();
        console.log(`✅ Found user: @${user.screen_name} (ID: ${user.id_str})`);
        return { id: user.id_str, username: user.screen_name };
    } catch (error) {
        console.error('❌ Failed to get user ID:', error.message);
        throw error;
    }
}

// Fetch tweets from user timeline
async function fetchUserTweets(twitter, userId) {
    console.log('📥 Fetching your tweets from Twitter...');
    
    try {
        const tweets = await twitter.v2.userTimeline(userId, {
            max_results: 100,
            'tweet.fields': [
                'created_at',
                'public_metrics',
                'context_annotations',
                'entities',
                'lang',
                'possibly_sensitive',
                'referenced_tweets',
                'source'
            ].join(','),
            'user.fields': 'id,username,name',
            'media.fields': 'url,preview_image_url,type',
            'expansions': 'attachments.media_keys,referenced_tweets.id,author_id'
        });
        
        console.log(`✅ Fetched ${tweets.data?.length || 0} tweets`);
        return tweets.data || [];
        
    } catch (error) {
        console.error('❌ Error fetching tweets:', error.message);
        throw error;
    }
}

// Convert Twitter tweet to database format
function formatTweetForDatabase(tweet) {
    const metrics = tweet.public_metrics || {};
    
    return {
        tweet_id: tweet.id,
        content: tweet.text,
        created_at: tweet.created_at,
        tweet_type: determineTweetType(tweet),
        content_type: 'openai_enhanced',
        likes: metrics.like_count || 0,
        retweets: metrics.retweet_count || 0,
        replies: metrics.reply_count || 0,
        quotes: metrics.quote_count || 0,
        engagement_rate: calculateEngagementRate(metrics),
        hashtags: extractHashtags(tweet.text),
        mentions: extractMentions(tweet.text),
        lang: tweet.lang || 'en',
        source: tweet.source || 'Twitter Web App',
        is_reply: Boolean(tweet.referenced_tweets?.some(ref => ref.type === 'replied_to')),
        is_retweet: Boolean(tweet.referenced_tweets?.some(ref => ref.type === 'retweeted')),
        is_quote: Boolean(tweet.referenced_tweets?.some(ref => ref.type === 'quoted')),
        possibly_sensitive: tweet.possibly_sensitive || false,
        imported_at: new Date().toISOString(),
        imported_from: 'twitter_api_historical'
    };
}

function determineTweetType(tweet) {
    if (tweet.referenced_tweets?.some(ref => ref.type === 'replied_to')) return 'reply';
    if (tweet.referenced_tweets?.some(ref => ref.type === 'retweeted')) return 'retweet';
    if (tweet.referenced_tweets?.some(ref => ref.type === 'quoted')) return 'quote';
    return 'original';
}

function calculateEngagementRate(metrics) {
    const total = (metrics.like_count || 0) + (metrics.retweet_count || 0) + 
                 (metrics.reply_count || 0) + (metrics.quote_count || 0);
    return total > 0 ? total : 0;
}

function extractHashtags(text) {
    const hashtags = text.match(/#[\w]+/g);
    return hashtags ? hashtags.map(tag => tag.substring(1)) : [];
}

function extractMentions(text) {
    const mentions = text.match(/@[\w]+/g);
    return mentions ? mentions.map(mention => mention.substring(1)) : [];
}

// Import tweets to database
async function importTweetsToDatabase(supabase, tweets) {
    console.log('💾 Importing tweets to database...');
    
    if (tweets.length === 0) {
        console.log('⚠️  No tweets to import');
        return { imported: 0 };
    }
    
    try {
        const formattedTweets = tweets.map(tweet => formatTweetForDatabase(tweet));
        
        // Check for existing tweets first
        const existingTweetIds = new Set();
        try {
            const { data: existing } = await supabase
                .from('tweets')
                .select('tweet_id');
            
            if (existing) {
                existing.forEach(t => existingTweetIds.add(t.tweet_id));
            }
        } catch (error) {
            console.log('⚠️  Could not check existing tweets, proceeding with import...');
        }
        
        // Filter out existing tweets
        const newTweets = formattedTweets.filter(tweet => !existingTweetIds.has(tweet.tweet_id));
        console.log(`📊 ${newTweets.length} new tweets to import (${formattedTweets.length - newTweets.length} already exist)`);
        
        if (newTweets.length === 0) {
            console.log('✅ All tweets already imported!');
            return { imported: 0, skipped: formattedTweets.length };
        }
        
        const { data, error } = await supabase
            .from('tweets')
            .insert(newTweets)
            .select('id');
            
        if (error) {
            console.error('❌ Import failed:', error.message);
            return { imported: 0, error: error.message };
        }
        
        console.log(`✅ Successfully imported ${data.length} tweets`);
        return { imported: data.length, skipped: existingTweetIds.size };
        
    } catch (error) {
        console.error('❌ Import error:', error.message);
        return { imported: 0, error: error.message };
    }
}

async function main() {
    try {
        // Initialize connections
        const { supabase, twitter } = await initializeClients();
        
        // Get user info
        const userInfo = await getTwitterUserId(twitter);
        
        // Fetch tweets
        const tweets = await fetchUserTweets(twitter, userInfo.id);
        
        if (tweets.length === 0) {
            console.log('⚠️  No tweets found to import');
            return;
        }
        
        // Import to database
        const result = await importTweetsToDatabase(supabase, tweets);
        
        // Final summary
        console.log('\n�� TWEET IMPORT COMPLETE!');
        console.log('========================');
        console.log(`📥 Total tweets found: ${tweets.length}`);
        console.log(`✅ Successfully imported: ${result.imported}`);
        console.log(`⏭️  Already existed: ${result.skipped || 0}`);
        
        if (result.imported > 0) {
            console.log('\n🔗 DATA CHAIN STATUS: REPAIRED!');
            console.log('✅ Your bot now has historical tweet data');
            console.log('✅ AI learning systems can analyze patterns');
            console.log('✅ Engagement optimization can begin');
            
            console.log('\n🚀 NEXT STEPS:');
            console.log('1. Run database mapping system to verify chain health');
            console.log('2. Wait for deployment to complete');
            console.log('3. Monitor for intelligent posts based on learning');
        }
        
    } catch (error) {
        console.error('\n❌ IMPORT FAILED:', error.message);
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('1. Check Twitter API credentials in .env file');
        console.log('2. Verify Supabase connection and permissions');
        console.log('3. Ensure tweets table exists and has correct schema');
    }
}

main().catch(console.error);
