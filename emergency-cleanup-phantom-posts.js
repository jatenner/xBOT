/**
 * 🧹 EMERGENCY DATABASE CLEANUP
 * Clear all phantom posts that never actually posted to Twitter
 */

const { createClient } = require('@supabase/supabase-js');

async function clearPhantomPosts() {
    console.log('🧹 EMERGENCY_CLEANUP: Starting phantom post removal...');
    
    // Get Supabase credentials from environment
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials');
        process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
        // Step 1: Check current phantom posts
        console.log('🔍 CLEANUP: Checking for phantom posts...');
        
        const { data: allPosts, error: checkError } = await supabase
            .from('posted_decisions')
            .select('*')
            .order('posted_at', { ascending: false });
        
        if (checkError) {
            throw new Error(`Failed to check posts: ${checkError.message}`);
        }
        
        console.log(`📊 CLEANUP: Found ${allPosts?.length || 0} total posts in database`);
        
        // Step 2: Delete ALL posts (since Twitter shows ZERO posts today)
        // This is safe because we know nothing actually posted
        const { data: deletedPosts, error: deleteError } = await supabase
            .from('posted_decisions')
            .delete()
            .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
            .select();
        
        if (deleteError) {
            throw new Error(`Failed to delete phantom posts: ${deleteError.message}`);
        }
        
        const deletedCount = deletedPosts?.length || 0;
        console.log(`✅ CLEANUP: Deleted ${deletedCount} phantom posts from last 24 hours`);
        
        // Step 3: Verify cleanup
        const { count: remainingCount, error: countError } = await supabase
            .from('posted_decisions')
            .select('*', { count: 'exact', head: true })
            .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour
        
        if (countError) {
            console.warn('⚠️ CLEANUP: Could not verify cleanup');
        } else {
            console.log(`📊 CLEANUP: Remaining posts in last hour: ${remainingCount || 0}`);
        }
        
        console.log('🎉 CLEANUP: Phantom post removal completed!');
        console.log('🚀 CLEANUP: System should now be able to post again');
        
    } catch (error) {
        console.error('❌ CLEANUP: Failed:', error.message);
        process.exit(1);
    }
}

// Run the cleanup
clearPhantomPosts();
