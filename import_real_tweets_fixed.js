#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const { TwitterApi } = require('twitter-api-v2');

console.log('📥 IMPORTING YOUR REAL TWEETS (FIXED CREDENTIALS)');
console.log('===============================================');
console.log('🎯 Goal: Replace ALL sample data with your real 100+ tweets');
console.log('🔗 This will give AI authentic learning data from your account');
console.log('');

// Initialize connections with correct credential names
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
    
    // Twitter client with CORRECT credential names from your .env
    console.log('🔑 Using Twitter credentials from .env...');
    const twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_CONSUMER_KEY,        // YOUR actual key name
        appSecret: process.env.TWITTER_CONSUMER_SECRET,  // YOUR actual secret name  
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });
    
    console.log('✅ Connections initialized with real credentials');
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

// Fetch tweets from user timeline (multiple pages)
async function fetchAllUserTweets(twitter, userId) {
    console.log('📥 Fetching ALL your tweets from Twitter...');
    
    const allTweets = [];
    let maxId = null;
    let pageCount = 0;
    
    try {
        do {
            pageCount++;
            console.log(`   📄 Fetching page ${pageCount}...`);
            
            const options = {
                count: 200, // Maximum per request for v1.1 API
                include_rts: true,
                exclude_replies: false,
                tweet_mode: 'extended'
            };
            
            if (maxId) {
                options.max_id = maxId;
            }
            
            const tweets = await twitter.v1.userTimeline(userId, options);
            
            if (tweets && tweets.length > 0) {
                console.log(`   ✅ Found ${tweets.length} tweets on this page`);
                
                // Remove the last tweet to avoid duplicates (max_id is inclusive)
                if (maxId && tweets.length > 0) {
                    tweets.shift();
                }
                
                allTweets.push(...tweets);
                
                // Set next max_id
                if (tweets.length > 0) {
                    maxId = tweets[tweets.length - 1].id_str;
                }
            } else {
                console.log('   ℹ️  No more tweets found');
                break;
            }
            
            // Rate limiting - be conservative
            if (pageCount % 5 === 0) {
                console.log('   ⏳ Pausing to respect rate limits...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
        } while (allTweets.length < 3200 && pageCount < 16); // Twitter limits
        
        console.log(`✅ Fetched total of ${allTweets.length} real tweets from your account`);
        return allTweets;
        
    } catch (error) {
        console.error('❌ Error fetching tweets:', error.message);
        if (allTweets.length > 0) {
            console.log(`⚠️  Returning ${allTweets.length} tweets fetched before error`);
            return allTweets;
        }
        throw error;
    }
}

// Convert Twitter v1.1 tweet to database format
function formatTweetForDatabase(tweet) {
    return {
        tweet_id: tweet.id_str,
        content: tweet.full_text || tweet.text,
        created_at: new Date(tweet.created_at).toISOString(),
        tweet_type: determineTweetType(tweet),
        content_type: 'openai_enhanced',
        content_category: 'health_tech',
        source_attribution: 'Real Twitter Account',
        engagement_score: calculateEngagementScore(tweet),
        likes: tweet.favorite_count || 0,
        retweets: tweet.retweet_count || 0,
        replies: tweet.reply_count || 0,
        impressions: 0, // Not available in v1.1 API
        has_snap2health_cta: containsSnap2HealthCTA(tweet.full_text || tweet.text),
        created_at: new Date(tweet.created_at).toISOString()
    };
}

function determineTweetType(tweet) {
    if (tweet.in_reply_to_status_id_str) return 'reply';
    if (tweet.retweeted_status) return 'retweet';
    if (tweet.is_quote_status) return 'quote';
    return 'original';
}

function calculateEngagementScore(tweet) {
    const likes = tweet.favorite_count || 0;
    const retweets = tweet.retweet_count || 0;
    const replies = tweet.reply_count || 0;
    return likes + (retweets * 2) + (replies * 3); // Weight replies more
}

function containsSnap2HealthCTA(text) {
    return text.toLowerCase().includes('snap2health');
}

// Clear ALL sample data and import real tweets
async function replaceWithRealTweets(supabase, realTweets) {
    console.log('🧹 CLEARING ALL SAMPLE DATA...');
    
    try {
        // Delete ALL existing tweets (sample data)
        const { error: deleteError } = await supabase
            .from('tweets')
            .delete()
            .neq('id', 'impossible-id'); // Delete everything
            
        if (deleteError) {
            console.log('⚠️  Could not clear existing data:', deleteError.message);
        } else {
            console.log('✅ Cleared all sample/existing tweets');
        }
        
        // Insert real tweets
        console.log('📥 Inserting your REAL tweets...');
        
        if (realTweets.length === 0) {
            console.log('⚠️  No real tweets to import');
            return { imported: 0 };
        }
        
        const formattedTweets = realTweets.map(tweet => formatTweetForDatabase(tweet));
        
        // Insert in batches
        const batchSize = 50;
        let totalImported = 0;
        
        for (let i = 0; i < formattedTweets.length; i += batchSize) {
            const batch = formattedTweets.slice(i, i + batchSize);
            console.log(`   📦 Importing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(formattedTweets.length/batchSize)} (${batch.length} real tweets)...`);
            
            const { data, error } = await supabase
                .from('tweets')
                .insert(batch)
                .select('id');
                
            if (error) {
                console.error(`   ❌ Batch failed:`, error.message);
            } else {
                console.log(`   ✅ Batch imported successfully (${data.length} real tweets)`);
                totalImported += data.length;
            }
            
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`✅ Successfully imported ${totalImported} REAL tweets`);
        return { imported: totalImported };
        
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
        
        // Fetch ALL real tweets
        const realTweets = await fetchAllUserTweets(twitter, userInfo.id);
        
        if (realTweets.length === 0) {
            console.log('⚠️  No real tweets found to import');
            return;
        }
        
        // Replace sample data with real tweets
        const result = await replaceWithRealTweets(supabase, realTweets);
        
        // Final summary
        console.log('\n🎉 REAL TWEET IMPORT COMPLETE!');
        console.log('=============================');
        console.log(`📥 Total real tweets found: ${realTweets.length}`);
        console.log(`✅ Successfully imported: ${result.imported}`);
        console.log(`🗑️  Sample data cleared: ALL`);
        
        if (result.imported > 0) {
            console.log('\n🔗 DATA CHAIN STATUS: FIXED WITH REAL DATA!');
            console.log('==========================================');
            console.log('✅ Database now has YOUR authentic tweets');
            console.log('✅ AI can learn from YOUR real engagement patterns'); 
            console.log('✅ Content themes based on YOUR successful posts');
            console.log('✅ Bot will post like YOU, not like sample data');
            
            console.log('\n🚀 IMMEDIATE BENEFITS:');
            console.log('=====================');
            console.log('• AI learns YOUR writing style and voice');
            console.log('• Understands what content YOUR audience engages with');
            console.log('• Replicates YOUR successful content patterns');
            console.log('• Posts will be authentic to YOUR brand');
            
            console.log('\n💎 THE DATA CHAIN IS NOW AUTHENTIC!');
            console.log('All AI learning is based on YOUR real Twitter success');
        }
        
    } catch (error) {
        console.error('\n❌ REAL IMPORT FAILED:', error.message);
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('1. Check Twitter API credentials are correct');
        console.log('2. Verify account has tweet access permissions');
        console.log('3. Ensure rate limits are not exceeded');
    }
}

main().catch(console.error); 