#!/usr/bin/env node

/**
 * 📊 VIRAL GROWTH MONITORING DASHBOARD
 * ====================================
 */

const { supabaseClient } = require('./src/utils/supabaseClient');

async function displayViralGrowthDashboard() {
    console.log('📊 === VIRAL GROWTH MONITORING DASHBOARD ===');
    console.log(`🕐 ${new Date().toLocaleString()}`);
    console.log('');
    
    try {
        // Get recent posts
        const { data: recentPosts } = await supabaseClient.supabase
            .from('tweets')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
            
        // Get bot config
        const { data: botConfig } = await supabaseClient.supabase
            .from('bot_config')
            .select('key, value');
            
        // Get performance data
        const { data: performance } = await supabaseClient.supabase
            .from('tweet_performance_analysis')
            .select('*')
            .order('posting_time', { ascending: false })
            .limit(10);
    
        console.log('🤖 === BOT STATUS ===');
        console.log(`Recent Posts: ${recentPosts?.length || 0}`);
        console.log(`Config Entries: ${botConfig?.length || 0}`);
        console.log(`Performance Records: ${performance?.length || 0}`);
        console.log('');
        
        if (recentPosts && recentPosts.length > 0) {
            console.log('📝 === RECENT POSTS ===');
            recentPosts.forEach((post, index) => {
                const content = post.content?.substring(0, 60) + '...';
                const time = new Date(post.created_at).toLocaleTimeString();
                console.log(`${index + 1}. [${time}] ${content}`);
            });
            console.log('');
        }
        
        console.log('⚙️  === SYSTEM CONFIGURATION ===');
        console.log(`BOT_PHASE: ${process.env.BOT_PHASE || 'not set'}`);
        console.log(`ENABLE_ELITE_STRATEGIST: ${process.env.ENABLE_ELITE_STRATEGIST || 'not set'}`);
        console.log(`ENABLE_AUTO_ENGAGEMENT: ${process.env.ENABLE_AUTO_ENGAGEMENT || 'not set'}`);
        console.log(`MAX_DAILY_POSTS: ${process.env.MAX_DAILY_POSTS || 'not set'}`);
        console.log('');
        
        console.log('🎯 === NEXT STEPS FOR VIRAL GROWTH ===');
        console.log('1. Ensure all environment variables are set in Railway');
        console.log('2. Monitor posting frequency (target: 8-25 posts/day)');
        console.log('3. Track engagement metrics (target: 3.5%+ engagement rate)');
        console.log('4. Verify AI content generation is working');
        console.log('5. Monitor follower growth (target: 8+ new followers/day)');
        
    } catch (error) {
        console.error('❌ Dashboard error:', error.message);
    }
}

if (require.main === module) {
    displayViralGrowthDashboard().catch(console.error);
}

module.exports = { displayViralGrowthDashboard };
