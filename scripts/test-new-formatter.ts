#!/usr/bin/env tsx
/**
 * TEST: New AI Visual Formatter with viral learning
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function test() {
  console.log('🧪 TESTING NEW AI VISUAL FORMATTER\n');
  
  const supabase = getSupabaseClient();
  
  // Check 1: Viral tweet library status
  const { count } = await supabase
    .from('viral_tweet_library')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  
  console.log(`📊 Viral Tweet Library: ${count || 0} tweets`);
  if (count && count > 0) {
    const { data: samples } = await supabase
      .from('viral_tweet_library')
      .select('hook_type, pattern_strength, why_it_works')
      .limit(3);
    console.log('  Sample patterns:');
    samples?.forEach((s: any, i: number) => {
      console.log(`    ${i + 1}. ${s.hook_type} (strength: ${s.pattern_strength})`);
      console.log(`       "${s.why_it_works?.substring(0, 60)}..."`);
    });
  } else {
    console.log('  ℹ️  Empty (will use baseline prompts)');
  }
  
  // Check 2: Test the aiVisualFormatter
  console.log('\n🎨 Testing AI Visual Formatter...');
  const aiVisualFormatterModule = await import('../src/posting/aiVisualFormatter');
  const aiVisualFormatter = aiVisualFormatterModule.default;
  
  const testContent = `Your gut microbiome affects mental health. Studies show 90% of serotonin is produced in the gut. Probiotics may reduce anxiety and depression symptoms.`;
  
  const testIntelligence = {
    topPerformers: [],
    strugglingFormats: [],
    insights: ['Test insight'],
    lastUpdated: new Date()
  };
  
  try {
    const result = await aiVisualFormatter(testContent, 'single', testIntelligence);
    console.log('\n✅ FORMATTED OUTPUT:');
    console.log('━'.repeat(60));
    console.log(result);
    console.log('━'.repeat(60));
    
    // Check for improvements
    const hasMarkdown = /\*\*|\*|__/.test(result);
    const hasHashtag = /#/.test(result);
    const charCount = result.length;
    
    console.log('\n📋 QUALITY CHECKS:');
    console.log(`  ${hasMarkdown ? '❌' : '✅'} No markdown: ${!hasMarkdown}`);
    console.log(`  ${hasHashtag ? '❌' : '✅'} No hashtags: ${!hasHashtag}`);
    console.log(`  ${charCount <= 280 ? '✅' : '❌'} Character count: ${charCount}/280`);
    
  } catch (error: any) {
    console.error('❌ Formatter error:', error.message);
  }
  
  // Check 3: Recent posts using new formatter
  console.log('\n📝 Recent posts (checking for new formatting):');
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select('content, visual_format, created_at')
    .eq('status', 'posted')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (recentPosts && recentPosts.length > 0) {
    recentPosts.forEach((post: any, i: number) => {
      const content = String(post.content || '');
      const hasOldIssues = /\*\*/.test(content) || /#\w/.test(content);
      console.log(`\n  ${i + 1}. ${hasOldIssues ? '⚠️' : '✅'} Posted ${new Date(post.created_at).toLocaleTimeString()}`);
      console.log(`     "${content.substring(0, 80)}..."`);
    });
  } else {
    console.log('  No recent posts found');
  }
  
  console.log('\n✅ TEST COMPLETE\n');
}

test()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });

