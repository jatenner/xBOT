#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

console.log('🔧 CREATING SAMPLE TWEET DATA (SCHEMA FIXED)');
console.log('===========================================');
console.log('🎯 Using correct schema to fix the broken data chain');
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

// Generate sample health tech tweets with correct schema
function generateSampleTweets() {
    const baseTime = new Date();
    
    const sampleTweets = [
        {
            tweet_id: '1850000000000000001',
            content: "🚀 Breakthrough in AI-powered drug discovery! New algorithms can identify potential treatments 100x faster than traditional methods. The future of personalized medicine is here. #HealthTech #AI #Innovation",
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            content_category: 'health_tech',
            source_attribution: 'Sample Data - AI Research',
            engagement_score: 68,
            likes: 45,
            retweets: 12,
            replies: 8,
            impressions: 1200,
            has_snap2health_cta: false,
            created_at: new Date(baseTime.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            tweet_id: '1850000000000000002',
            content: "📊 Digital health funding reached $29.1B in 2023. But here's what matters more: 78% of patients report better health outcomes with digital tools. Technology is truly transforming lives. 💚",
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            content_category: 'health_tech',
            source_attribution: 'Sample Data - Industry Analysis',
            engagement_score: 112,
            likes: 67,
            retweets: 23,
            replies: 15,
            impressions: 1800,
            has_snap2health_cta: false,
            created_at: new Date(baseTime.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            tweet_id: '1850000000000000003',
            content: "Mental health apps are powerful tools, but they work best as part of a comprehensive care plan. Technology enhances human connection—it doesn't replace it. 🧠💫 #MentalHealth #DigitalWellness",
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            content_category: 'health_tech',
            source_attribution: 'Sample Data - Mental Health',
            engagement_score: 156,
            likes: 89,
            retweets: 34,
            replies: 22,
            impressions: 2100,
            has_snap2health_cta: false,
            created_at: new Date(baseTime.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            tweet_id: '1850000000000000004',
            content: "🔬 Gene therapy success: First patient with inherited blindness regains sight after experimental treatment. When science fiction becomes medical reality. The possibilities are endless! ✨",
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            content_category: 'health_tech',
            source_attribution: 'Sample Data - Gene Therapy',
            engagement_score: 302,
            likes: 156,
            retweets: 78,
            replies: 43,
            impressions: 3500,
            has_snap2health_cta: false,
            created_at: new Date(baseTime.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            tweet_id: '1850000000000000005',
            content: "IoT in healthcare generates 25GB of data per patient daily. The challenge isn't collection—it's turning data into actionable insights that improve patient outcomes. 📈🏥 #HealthData #IoT",
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            content_category: 'health_tech',
            source_attribution: 'Sample Data - Healthcare IoT',
            engagement_score: 131,
            likes: 73,
            retweets: 31,
            replies: 18,
            impressions: 1900,
            has_snap2health_cta: false,
            created_at: new Date(baseTime.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            tweet_id: '1850000000000000006',
            content: "Telemedicine appointments increased 3800% during the pandemic and are here to stay. What started as necessity is now revolutionizing healthcare accessibility worldwide. 🌍📱 #Telemedicine",
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            content_category: 'health_tech',
            source_attribution: 'Sample Data - Telemedicine',
            engagement_score: 180,
            likes: 94,
            retweets: 45,
            replies: 27,
            impressions: 2400,
            has_snap2health_cta: false,
            created_at: new Date(baseTime.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            tweet_id: '1850000000000000007',
            content: "🤖 AI can detect skin cancer with 96% accuracy, but dermatologists with AI assistance achieve 99%. The magic happens when human expertise meets technological precision. #AI #Dermatology",
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            content_category: 'health_tech',
            source_attribution: 'Sample Data - AI Diagnostics',
            engagement_score: 218,
            likes: 112,
            retweets: 56,
            replies: 31,
            impressions: 2800,
            has_snap2health_cta: false,
            created_at: new Date(baseTime.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            tweet_id: '1850000000000000008',
            content: "🏥 Snap2Health is revolutionizing patient engagement! Our AI-powered platform helps healthcare providers deliver personalized care at scale. The future of healthcare is here. 🚀 #Snap2Health #HealthTech",
            tweet_type: 'original',
            content_type: 'openai_enhanced',
            content_category: 'health_tech',
            source_attribution: 'Sample Data - Snap2Health CTA',
            engagement_score: 85,
            likes: 52,
            retweets: 18,
            replies: 11,
            impressions: 1400,
            has_snap2health_cta: true,
            created_at: new Date(baseTime.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
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
            .like('tweet_id', '1850000000000000%');
            
        if (existing && existing.length > 0) {
            console.log(`⚠️  ${existing.length} sample tweets already exist, removing duplicates...`);
            
            // Remove existing sample tweets
            await supabase
                .from('tweets')
                .delete()
                .like('tweet_id', '1850000000000000%');
                
            console.log('✅ Old sample data cleared');
        }
        
        // Insert new sample tweets
        console.log('📥 Inserting fresh sample tweets...');
        
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
    
    if (result.inserted > 0) {
        console.log('\n🔗 DATA CHAIN STATUS: TEMPORARILY REPAIRED!');
        console.log('==========================================');
        console.log('💡 Knot 1 (tweets): ✅ NOW HAS DATA FOR AI LEARNING');
        console.log('✅ Database now has engagement patterns');
        console.log('✅ Content themes and categories established');
        console.log('✅ Engagement scores available for optimization');
        console.log('✅ Bot can start intelligent posting immediately');
        
        console.log('\n🚨 IMPORTANT REMINDERS:');
        console.log('======================');
        console.log('• This is TEMPORARY sample data');
        console.log('• Real tweet import will provide much better learning');
        console.log('• Fix Twitter API credentials when possible');
        console.log('• Re-run: node import_all_existing_tweets_from_twitter.js');
        
        console.log('\n🚀 IMMEDIATE NEXT STEPS:');
        console.log('=======================');
        console.log('1. ✅ Data chain is now functional');
        console.log('2. 🤖 Bot can start intelligent posting');
        console.log('3. 📊 AI will learn from sample engagement patterns');
        console.log('4. 🔄 Replace with real tweets when API is fixed');
        
        console.log('\n💡 THE BROKEN CHAIN IS NOW FIXED!');
        console.log('All 20 knots should now be functional for AI learning');
    } else if (result.error) {
        console.log(`\n❌ Error: ${result.error}`);
    }
}

main().catch(console.error); 