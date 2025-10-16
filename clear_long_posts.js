/**
 * Clear ALL posts with 1000+ characters - these are broken wall-of-text posts
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearLongPosts() {
  console.log('🧹 Clearing ALL posts with 1000+ characters (broken wall-of-text posts)...');
  
  // Get count first
  const { count: totalCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .in('status', ['queued', 'scheduled']);
  
  console.log(`📊 Total queued/scheduled posts: ${totalCount || 0}`);
  
  // Get posts with long content
  const { data: longPosts, error: fetchError } = await supabase
    .from('content_metadata')
    .select('id, content')
    .in('status', ['queued', 'scheduled']);
  
  if (fetchError) {
    console.error('Error fetching posts:', fetchError);
    return;
  }
  
  // Filter posts with 1000+ characters
  const postsToDelete = longPosts.filter(post => post.content && post.content.length >= 1000);
  
  console.log(`📊 Found ${postsToDelete.length} posts with 1000+ characters`);
  
  if (postsToDelete.length === 0) {
    console.log('✅ No long posts to delete!');
    return;
  }
  
  // Delete them
  const idsToDelete = postsToDelete.map(p => p.id);
  
  const { error: deleteError } = await supabase
    .from('content_metadata')
    .delete()
    .in('id', idsToDelete);
  
  if (deleteError) {
    console.error('Error deleting posts:', deleteError);
    return;
  }
  
  console.log(`✅ Deleted ${postsToDelete.length} broken wall-of-text posts`);
  
  // Show what's left
  const { count: remainingCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .in('status', ['queued', 'scheduled']);
  
  console.log(`📊 Remaining queued posts: ${remainingCount || 0}`);
  
  // Show sample of remaining posts
  const { data: samples } = await supabase
    .from('content_metadata')
    .select('content')
    .in('status', ['queued', 'scheduled'])
    .limit(3);
  
  if (samples && samples.length > 0) {
    console.log('\n📝 Sample of remaining posts:');
    samples.forEach((s, i) => {
      console.log(`\n${i + 1}. (${s.content.length} chars): ${s.content.substring(0, 100)}...`);
    });
  }
}

clearLongPosts();

