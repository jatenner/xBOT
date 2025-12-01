/**
 * Review recent content for diversity and quality
 */

import { getSupabaseClient } from '../src/db';

async function reviewRecentContent() {
  const supabase = getSupabaseClient();
  
  // Get last 50 posts
  const { data: posts } = await supabase
    .from('content_metadata')
    .select('decision_id, content, generator_name, raw_topic, topic_cluster, hook_pattern, decision_type, created_at, quality_score')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (!posts || posts.length === 0) {
    console.log('No posts found');
    return;
  }
  
  console.log(`\n📊 CONTENT REVIEW: ${posts.length} Recent Posts\n`);
  console.log('='.repeat(80));
  
  // Analyze diversity
  const generators = new Set(posts.map(p => p.generator_name).filter(Boolean));
  const topics = new Set(posts.map(p => p.raw_topic).filter(Boolean));
  const topicClusters = new Set(posts.map(p => p.topic_cluster).filter(Boolean));
  const hookPatterns = new Set(posts.map(p => p.hook_pattern).filter(Boolean));
  
  console.log(`\n🎨 DIVERSITY ANALYSIS:\n`);
  console.log(`Generators used: ${generators.size} unique`);
  console.log(`  ${Array.from(generators).join(', ')}`);
  console.log(`\nTopics: ${topics.size} unique`);
  console.log(`Topic clusters: ${topicClusters.size} unique`);
  console.log(`  ${Array.from(topicClusters).join(', ')}`);
  console.log(`\nHook patterns: ${hookPatterns.size} unique`);
  console.log(`  ${Array.from(hookPatterns).join(', ')}`);
  
  // Show sample content
  console.log(`\n📝 SAMPLE CONTENT (First 10 posts):\n`);
  console.log('='.repeat(80));
  
  posts.slice(0, 10).forEach((post, i) => {
    console.log(`\n${i + 1}. [${post.generator_name || 'unknown'}] [${post.topic_cluster || 'unknown'}]`);
    console.log(`   Topic: ${post.raw_topic || 'N/A'}`);
    console.log(`   Hook: ${post.hook_pattern || 'N/A'}`);
    console.log(`   Quality: ${post.quality_score ? (post.quality_score * 100).toFixed(0) + '%' : 'N/A'}`);
    console.log(`   Content: ${post.content?.substring(0, 150) || 'N/A'}${post.content && post.content.length > 150 ? '...' : ''}`);
  });
  
  // Check for duplicates/similarity
  console.log(`\n🔍 SIMILARITY CHECK:\n`);
  const contentHashes = new Set();
  let duplicates = 0;
  
  posts.forEach(post => {
    if (post.content) {
      const hash = post.content.substring(0, 50).toLowerCase().replace(/\s+/g, ' ');
      if (contentHashes.has(hash)) {
        duplicates++;
      }
      contentHashes.add(hash);
    }
  });
  
  console.log(`Potential duplicates (same first 50 chars): ${duplicates}`);
  console.log(`Unique content starts: ${contentHashes.size}/${posts.length}`);
  
  // Generator distribution
  console.log(`\n📊 GENERATOR DISTRIBUTION:\n`);
  const generatorCounts: Record<string, number> = {};
  posts.forEach(post => {
    const gen = post.generator_name || 'unknown';
    generatorCounts[gen] = (generatorCounts[gen] || 0) + 1;
  });
  
  Object.entries(generatorCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([gen, count]) => {
      const pct = ((count / posts.length) * 100).toFixed(1);
      console.log(`  ${gen}: ${count} (${pct}%)`);
    });
  
  // Topic distribution
  console.log(`\n📚 TOPIC DISTRIBUTION:\n`);
  const topicCounts: Record<string, number> = {};
  posts.forEach(post => {
    const topic = post.topic_cluster || 'unknown';
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  });
  
  Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([topic, count]) => {
      const pct = ((count / posts.length) * 100).toFixed(1);
      console.log(`  ${topic}: ${count} (${pct}%)`);
    });
}

reviewRecentContent().catch(console.error);
