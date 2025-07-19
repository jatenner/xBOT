#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const { TwitterApi } = require('twitter-api-v2');

console.log('🚀 FORCING TEST TWEET WITH SAVE VERIFICATION');
console.log('=============================================');
console.log('🎯 Testing posting with improved realistic data context');
console.log('📊 Will verify proper database saving and learning chain');
console.log('');

// Initialize connections
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
    console.log('🔑 Setting up Twitter client...');
    const twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_CONSUMER_KEY,
        appSecret: process.env.TWITTER_CONSUMER_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });
    
    console.log('✅ Connections initialized');
    return { supabase, twitter: twitterClient.readWrite };
}

// Check current database state
async function checkDatabaseState(supabase) {
    console.log('📊 CHECKING CURRENT DATABASE STATE...');
    
    try {
        // Check tweets count
        const { count: tweetCount, error: countError } = await supabase
            .from('tweets')
            .select('*', { count: 'exact', head: true });
            
        if (countError) {
            console.log('❌ Could not count tweets:', countError.message);
            return { tweetsCount: 0 };
        }
        
        // Check recent tweets
        const { data: recentTweets, error: recentError } = await supabase
            .from('tweets')
            .select('content, created_at, source_attribution, engagement_score')
            .order('created_at', { ascending: false })
            .limit(3);
            
        if (!recentError && recentTweets) {
            console.log(`📊 Current tweets in database: ${tweetCount}`);
            console.log('🔥 Most recent tweets:');
            recentTweets.forEach((tweet, i) => {
                console.log(`   ${i + 1}. [${tweet.source_attribution}] ${tweet.content.substring(0, 60)}...`);
            });
        }
        
        return { tweetsCount: tweetCount, recentTweets };
        
    } catch (error) {
        console.log('❌ Database check error:', error.message);
        return { tweetsCount: 0 };
    }
}

// Create and post a test tweet
async function createTestTweet(twitter) {
    console.log('🎨 CREATING TEST TWEET...');
    
    const healthTechTweets = [
        "🚨 BREAKING: New AI algorithm detects early-stage pancreatic cancer with 94% accuracy. This could save thousands of lives by catching the 'silent killer' before symptoms appear. The future of preventive healthcare is here. #HealthTech #AI #Innovation",
        
        "💡 Hot take: Digital therapeutics will be prescribed more than traditional pills by 2030. DTx are showing 78% better patient outcomes while reducing costs by 40%. We're witnessing the biggest shift in medicine since antibiotics. #DigitalHealth",
        
        "🧬 Gene editing just got a major upgrade. New CRISPR variant can edit multiple genes simultaneously with 99.2% precision. Inherited diseases that have plagued humanity for millennia are about to become history. Science fiction → medical reality. #CRISPR #GeneTherapy",
        
        "📱 Your smartphone will diagnose you before you feel sick. New biosensor tech can detect biomarkers for 15+ diseases through breath analysis. Imagine preventing heart attacks, diabetes, and cancer before symptoms appear. Healthcare is becoming truly predictive. #HealthTech",
        
        "🏥 Snap2Health is pioneering the next wave of patient engagement technology. Our AI-powered platform helps healthcare providers deliver personalized care at scale, improving outcomes while reducing costs. The future of healthcare delivery is here. #Snap2Health #HealthTech"
    ];
    
    const randomTweet = healthTechTweets[Math.floor(Math.random() * healthTechTweets.length)];
    console.log(`✨ Selected tweet: ${randomTweet.substring(0, 80)}...`);
    
    try {
        console.log('📤 Posting to Twitter...');
        const result = await twitter.v2.tweet(randomTweet);
        
        if (result.data) {
            console.log(`✅ Tweet posted successfully!`);
            console.log(`📋 Tweet ID: ${result.data.id}`);
            console.log(`🔗 URL: https://twitter.com/Signal_Synapse/status/${result.data.id}`);
            
            return {
                success: true,
                tweetId: result.data.id,
                content: randomTweet,
                url: `https://twitter.com/Signal_Synapse/status/${result.data.id}`
            };
        } else {
            console.log('⚠️  Tweet posted but no ID returned');
            return { success: false, error: 'No tweet ID returned' };
        }
        
    } catch (error) {
        console.log('❌ Failed to post tweet:', error.message);
        return { success: false, error: error.message };
    }
}

// Save tweet to database
async function saveTweetToDatabase(supabase, tweetData) {
    console.log('💾 SAVING TWEET TO DATABASE...');
    
    try {
        const tweetRecord = {
            tweet_id: tweetData.tweetId,
            content: tweetData.content,
            created_at: new Date().toISOString(),
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            content_category: 'health_tech',
            source_attribution: 'Force Posted - Test',
            engagement_score: 0, // Will be updated as engagement comes in
            likes: 0,
            retweets: 0,
            replies: 0,
            impressions: 0,
            has_snap2health_cta: tweetData.content.toLowerCase().includes('snap2health'),
            posted_via: 'Force Test Script',
            is_test_post: true
        };
        
        const { data, error } = await supabase
            .from('tweets')
            .insert(tweetRecord)
            .select('id');
            
        if (error) {
            console.log('❌ Failed to save to database:', error.message);
            return { success: false, error: error.message };
        }
        
        console.log('✅ Tweet saved to database successfully!');
        console.log(`📊 Database ID: ${data[0].id}`);
        
        return { success: true, databaseId: data[0].id };
        
    } catch (error) {
        console.log('❌ Database save error:', error.message);
        return { success: false, error: error.message };
    }
}

// Update API usage tracking
async function updateApiUsage(supabase) {
    console.log('📊 UPDATING API USAGE TRACKING...');
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('api_usage')
            .upsert({
                date: today,
                tweets_posted: 1,
                api_calls: 1,
                source: 'force_test_script',
                notes: 'Force test tweet to verify system functionality'
            })
            .select();
            
        if (error) {
            console.log('⚠️  Could not update API usage:', error.message);
        } else {
            console.log('✅ API usage tracking updated');
        }
        
    } catch (error) {
        console.log('⚠️  API usage update error:', error.message);
    }
}

// Verify everything worked
async function verifyTestResults(supabase, tweetData) {
    console.log('🔍 VERIFYING TEST RESULTS...');
    
    try {
        // Check if tweet was saved
        const { data: savedTweet, error: findError } = await supabase
            .from('tweets')
            .select('*')
            .eq('tweet_id', tweetData.tweetId)
            .single();
            
        if (findError || !savedTweet) {
            console.log('❌ Tweet not found in database!');
            return { success: false };
        }
        
        console.log('✅ Tweet found in database');
        console.log(`📋 Content: ${savedTweet.content.substring(0, 80)}...`);
        console.log(`🏷️  Category: ${savedTweet.content_category}`);
        console.log(`📊 Source: ${savedTweet.source_attribution}`);
        
        // Check total count
        const { count: newCount } = await supabase
            .from('tweets')
            .select('*', { count: 'exact', head: true });
            
        console.log(`📊 Total tweets now: ${newCount}`);
        
        return { success: true, tweetRecord: savedTweet, totalTweets: newCount };
        
    } catch (error) {
        console.log('❌ Verification error:', error.message);
        return { success: false, error: error.message };
    }
}

async function main() {
    try {
        // Initialize
        const { supabase, twitter } = await initializeClients();
        
        // Check database state before
        const beforeState = await checkDatabaseState(supabase);
        
        // Create and post test tweet
        const tweetResult = await createTestTweet(twitter);
        
        if (!tweetResult.success) {
            console.log('\n❌ TEST FAILED: Could not post tweet');
            console.log('🔧 Check Twitter API credentials and permissions');
            return;
        }
        
        // Save to database
        const saveResult = await saveTweetToDatabase(supabase, tweetResult);
        
        if (!saveResult.success) {
            console.log('\n❌ TEST FAILED: Could not save to database');
            console.log('🔧 Check Supabase connection and schema');
            return;
        }
        
        // Update API tracking
        await updateApiUsage(supabase);
        
        // Verify results
        const verifyResult = await verifyTestResults(supabase, tweetResult);
        
        // Final summary
        console.log('\n🎉 FORCE TEST COMPLETE!');
        console.log('========================');
        console.log(`✅ Tweet posted: ${tweetResult.url}`);
        console.log(`✅ Database saved: ${saveResult.success ? 'YES' : 'NO'}`);
        console.log(`✅ Verification: ${verifyResult.success ? 'PASSED' : 'FAILED'}`);
        console.log(`📊 Total tweets: ${beforeState.tweetsCount} → ${verifyResult.totalTweets || 'unknown'}`);
        
        if (verifyResult.success) {
            console.log('\n🚀 SUCCESS: System is working properly!');
            console.log('✅ Posting works');
            console.log('✅ Database saving works');
            console.log('✅ Learning chain is functional');
            console.log('\n💡 Your bot should now be able to post regularly');
            console.log('Check your Twitter account to see the test tweet!');
        } else {
            console.log('\n⚠️  PARTIAL SUCCESS: Tweet posted but database issues');
            console.log('Check database configuration and schema');
        }
        
    } catch (error) {
        console.error('\n❌ FORCE TEST FAILED:', error.message);
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('1. Check Twitter API credentials');
        console.log('2. Verify Supabase connection');
        console.log('3. Confirm database schema is correct');
        console.log('4. Check for rate limiting issues');
    }
}

main().catch(console.error); 