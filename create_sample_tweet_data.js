#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

console.log('🔧 CREATING SAMPLE TWEET DATA');
console.log('============================');
console.log('🎯 Temporarily fixing the broken data chain');
console.log('💡 This allows AI to start learning while we fix real tweet import');
console.log('');

// Initialize Supabase
async function initializeSupabase() {
    try {
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
        
        let supabaseUrl = process.env.SUPABASE_URL || 'https://lqzqqxgrmxpnwivvzyqz.supabase.co';
        let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        
        if (!supabaseKey) {
            supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxenFxeGdybXhwbndpdnZ6eXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE4Mzk1NzQsImV4cCI6MjA0NzQxNTU3NH0.s-9vCfcEjfKpPXtUhfKQ69r4Y4hcf3cIE8RjxQ7mRR4';
        }
        
        return createClient(supabaseUrl, supabaseKey);
    } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error.message);
        return null;
    }
}

// Generate sample health tech tweets
function generateSampleTweets() {
    const baseTime = new Date();
    
    const sampleTweets = [
        {
            tweet_id: '1850000000000000001',
            content: "🚀 Breakthrough in AI-powered drug discovery! New algorithms can identify potential treatments 100x faster than traditional methods. The future of personalized medicine is here. #HealthTech #AI #Innovation",
            created_at: new Date(baseTime.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            likes: 45,
            retweets: 12,
            replies: 8,
            quotes: 3,
            engagement_rate: 68,
            hashtags: ['HealthTech', 'AI', 'Innovation'],
            mentions: [],
            urls: [],
            media_type: null,
            media_url: null,
            lang: 'en',
            source: 'Twitter Web App',
            is_reply: false,
            is_retweet: false,
            is_quote: false,
            possibly_sensitive: false,
            imported_from: 'sample_data_temp'
        },
        {
            tweet_id: '1850000000000000002',
            content: "📊 Digital health funding reached $29.1B in 2023. But here's what matters more: 78% of patients report better health outcomes with digital tools. Technology is truly transforming lives. 💚",
            created_at: new Date(baseTime.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString(),
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            likes: 67,
            retweets: 23,
            replies: 15,
            quotes: 7,
            engagement_rate: 112,
            hashtags: ['DigitalHealth', 'HealthTech'],
            mentions: [],
            urls: [],
            media_type: null,
            media_url: null,
            lang: 'en',
            source: 'Twitter Web App',
            is_reply: false,
            is_retweet: false,
            is_quote: false,
            possibly_sensitive: false,
            imported_from: 'sample_data_temp'
        },
        {
            tweet_id: '1850000000000000003',
            content: "Mental health apps are powerful tools, but they work best as part of a comprehensive care plan. Technology enhances human connection—it doesn't replace it. 🧠💫 #MentalHealth #DigitalWellness",
            created_at: new Date(baseTime.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            likes: 89,
            retweets: 34,
            replies: 22,
            quotes: 11,
            engagement_rate: 156,
            hashtags: ['MentalHealth', 'DigitalWellness'],
            mentions: [],
            urls: [],
            media_type: null,
            media_url: null,
            lang: 'en',
            source: 'Twitter Web App',
            is_reply: false,
            is_retweet: false,
            is_quote: false,
            possibly_sensitive: false,
            imported_from: 'sample_data_temp'
        },
        {
            tweet_id: '1850000000000000004',
            content: "🔬 Gene therapy success: First patient with inherited blindness regains sight after experimental treatment. When science fiction becomes medical reality. The possibilities are endless! ✨",
            created_at: new Date(baseTime.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            likes: 156,
            retweets: 78,
            replies: 43,
            quotes: 25,
            engagement_rate: 302,
            hashtags: ['GeneTherapy', 'MedicalBreakthrough', 'Innovation'],
            mentions: [],
            urls: [],
            media_type: null,
            media_url: null,
            lang: 'en',
            source: 'Twitter Web App',
            is_reply: false,
            is_retweet: false,
            is_quote: false,
            possibly_sensitive: false,
            imported_from: 'sample_data_temp'
        },
        {
            tweet_id: '1850000000000000005',
            content: "IoT in healthcare generates 25GB of data per patient daily. The challenge isn't collection—it's turning data into actionable insights that improve patient outcomes. 📈🏥 #HealthData #IoT",
            created_at: new Date(baseTime.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            likes: 73,
            retweets: 31,
            replies: 18,
            quotes: 9,
            engagement_rate: 131,
            hashtags: ['HealthData', 'IoT', 'HealthTech'],
            mentions: [],
            urls: [],
            media_type: null,
            media_url: null,
            lang: 'en',
            source: 'Twitter Web App',
            is_reply: false,
            is_retweet: false,
            is_quote: false,
            possibly_sensitive: false,
            imported_from: 'sample_data_temp'
        },
        {
            tweet_id: '1850000000000000006',
            content: "Telemedicine appointments increased 3800% during the pandemic and are here to stay. What started as necessity is now revolutionizing healthcare accessibility worldwide. 🌍📱 #Telemedicine",
            created_at: new Date(baseTime.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            likes: 94,
            retweets: 45,
            replies: 27,
            quotes: 14,
            engagement_rate: 180,
            hashtags: ['Telemedicine', 'HealthAccess', 'DigitalHealth'],
            mentions: [],
            urls: [],
            media_type: null,
            media_url: null,
            lang: 'en',
            source: 'Twitter Web App',
            is_reply: false,
            is_retweet: false,
            is_quote: false,
            possibly_sensitive: false,
            imported_from: 'sample_data_temp'
        },
        {
            tweet_id: '1850000000000000007',
            content: "🤖 AI can detect skin cancer with 96% accuracy, but dermatologists with AI assistance achieve 99%. The magic happens when human expertise meets technological precision. #AI #Dermatology",
            created_at: new Date(baseTime.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            likes: 112,
            retweets: 56,
            replies: 31,
            quotes: 19,
            engagement_rate: 218,
            hashtags: ['AI', 'Dermatology', 'HealthTech'],
            mentions: [],
            urls: [],
            media_type: null,
            media_url: null,
            lang: 'en',
            source: 'Twitter Web App',
            is_reply: false,
            is_retweet: false,
            is_quote: false,
            possibly_sensitive: false,
            imported_from: 'sample_data_temp'
        }
    ];
    
    return sampleTweets;
}

async function insertSampleTweets(supabase) {
    console.log('📝 Generating sample health tech tweets...');
    
    const sampleTweets = generateSampleTweets();
    console.log(`✅ Generated ${sampleTweets.length} sample tweets`);
    
    try {
        // Check if sample data already exists
        const { data: existing } = await supabase
            .from('tweets')
            .select('tweet_id')
            .eq('imported_from', 'sample_data_temp');
            
        if (existing && existing.length > 0) {
            console.log('⚠️  Sample data already exists, skipping insert');
            return { inserted: 0, existing: existing.length };
        }
        
        // Insert sample tweets
        const { data, error } = await supabase
            .from('tweets')
            .insert(sampleTweets)
            .select('id');
            
        if (error) {
            console.error('❌ Failed to insert sample tweets:', error.message);
            return { inserted: 0, error: error.message };
        }
        
        console.log(`✅ Successfully inserted ${data.length} sample tweets`);
        return { inserted: data.length };
        
    } catch (error) {
        console.error('❌ Error inserting sample tweets:', error.message);
        return { inserted: 0, error: error.message };
    }
}

async function main() {
    const supabase = await initializeSupabase();
    if (!supabase) {
        console.log('❌ Cannot proceed without database connection');
        return;
    }
    
    console.log('🔄 Inserting sample tweets...');
    const result = await insertSampleTweets(supabase);
    
    console.log('\n🎯 SAMPLE DATA INSERTION COMPLETE!');
    console.log('=================================');
    console.log(`✅ Inserted: ${result.inserted} tweets`);
    if (result.existing) console.log(`⏭️  Already existed: ${result.existing} tweets`);
    
    if (result.inserted > 0) {
        console.log('\n🔗 DATA CHAIN STATUS: TEMPORARILY REPAIRED!');
        console.log('==========================================');
        console.log('✅ Database now has learning data for AI');
        console.log('✅ Engagement patterns available for analysis');
        console.log('✅ Content themes established');
        console.log('✅ Bot can start intelligent posting');
        
        console.log('\n🚨 IMPORTANT REMINDERS:');
        console.log('======================');
        console.log('• This is TEMPORARY sample data');
        console.log('• Real tweet import will provide much better learning');
        console.log('• Fix Twitter API credentials when possible');
        console.log('• Re-run real import: node import_all_existing_tweets_from_twitter.js');
        
        console.log('\n🚀 NEXT STEPS:');
        console.log('=============');
        console.log('1. Check Render deployment status');
        console.log('2. Monitor bot for intelligent posts');
        console.log('3. Verify AI is learning from sample data');
        console.log('4. Import real tweets when API credentials are fixed');
    }
}

main().catch(console.error); 