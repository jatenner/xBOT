import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n🔍 REPLY SYSTEM AUDIT (Last 24 Hours)\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // Get last 20 replies
  const { data: replies } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, tweet_id, target_tweet_id, target_username, content, posted_at, status')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false })
    .limit(20);

  if (!replies || replies.length === 0) {
    console.log('❌ No replies found in last 24 hours');
    return;
  }

  console.log(`📊 Total Replies: ${replies.length}\n`);

  // ISSUE 1: Check for self-replies (replying to our own tweets)
  const ourUsername = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
  const selfReplies = replies.filter(r => r.target_username?.toLowerCase() === ourUsername.toLowerCase());
  
  console.log(`🔴 ISSUE 1: SELF-REPLIES (replying to ourselves)`);
  console.log(`   Self-replies: ${selfReplies.length} / ${replies.length} (${((selfReplies.length / replies.length) * 100).toFixed(0)}%)`);
  
  if (selfReplies.length > 0) {
    console.log(`   ❌ PROBLEM: We're replying to our own tweets!\n`);
    selfReplies.slice(0, 5).forEach((r, i) => {
      const ago = Math.round((Date.now() - new Date(r.posted_at).getTime()) / 60000);
      console.log(`   ${i+1}. @${r.target_username} - ${ago}m ago`);
      console.log(`      "${r.content.substring(0, 80)}..."`);
      console.log(`      https://x.com/${ourUsername}/status/${r.tweet_id}\n`);
    });
  } else {
    console.log(`   ✅ Good: No self-replies detected\n`);
  }

  // ISSUE 2: Check reply quality
  console.log(`🔴 ISSUE 2: REPLY QUALITY`);
  const qualityIssues: any[] = [];
  
  replies.forEach(r => {
    const content = r.content;
    const issues: string[] = [];
    
    // Check for JSON artifacts
    if (content.includes('{') || content.includes('[') || content.includes('}') || content.includes(']')) {
      issues.push('JSON artifacts');
    }
    
    // Check for generic templates
    const genericPhrases = [
      'here are', 'check out these', 'let me share', 'here\'s how',
      'dive deeper', 'unlock your', 'boost your', 'transform your',
      'interesting perspective', 'great point'
    ];
    if (genericPhrases.some(phrase => content.toLowerCase().includes(phrase))) {
      issues.push('Generic template');
    }
    
    // Check length
    if (content.length > 250) {
      issues.push('Too long (>250 chars)');
    }
    
    if (content.length < 50) {
      issues.push('Too short (<50 chars)');
    }
    
    // Check for multiple sentences (replies should be concise)
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 3) {
      issues.push('Too many sentences');
    }
    
    if (issues.length > 0) {
      qualityIssues.push({
        target: r.target_username,
        content: r.content,
        issues,
        url: `https://x.com/${ourUsername}/status/${r.tweet_id}`
      });
    }
  });
  
  console.log(`   Quality issues: ${qualityIssues.length} / ${replies.length} (${((qualityIssues.length / replies.length) * 100).toFixed(0)}%)`);
  
  if (qualityIssues.length > 0) {
    console.log(`   ❌ PROBLEM: Many replies have quality issues\n`);
    qualityIssues.slice(0, 5).forEach((issue, i) => {
      console.log(`   ${i+1}. @${issue.target} - Issues: ${issue.issues.join(', ')}`);
      console.log(`      "${issue.content.substring(0, 100)}..."`);
      console.log(`      ${issue.url}\n`);
    });
  } else {
    console.log(`   ✅ Good: No major quality issues\n`);
  }

  // ISSUE 3: Check target diversity
  console.log(`🔴 ISSUE 3: TARGET DIVERSITY`);
  const targetCounts: Record<string, number> = {};
  replies.forEach(r => {
    if (r.target_username) {
      targetCounts[r.target_username] = (targetCounts[r.target_username] || 0) + 1;
    }
  });
  
  const uniqueTargets = Object.keys(targetCounts).length;
  const avgRepliesPerTarget = replies.length / uniqueTargets;
  
  console.log(`   Unique targets: ${uniqueTargets}`);
  console.log(`   Avg replies per target: ${avgRepliesPerTarget.toFixed(1)}`);
  
  if (avgRepliesPerTarget > 2) {
    console.log(`   ⚠️  WARNING: Low diversity (replying to same people multiple times)\n`);
  } else {
    console.log(`   ✅ Good: High diversity\n`);
  }
  
  // Top targets
  const topTargets = Object.entries(targetCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  
  console.log(`   Top 10 reply targets:`);
  topTargets.forEach(([username, count], i) => {
    console.log(`   ${i+1}. @${username}: ${count} replies`);
  });
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📋 SUMMARY OF ISSUES:\n');
  
  const issues: string[] = [];
  
  if (selfReplies.length > 0) {
    issues.push(`❌ Self-replies: ${selfReplies.length} replies to ourselves (should be 0)`);
  }
  
  if (qualityIssues.length / replies.length > 0.3) {
    issues.push(`❌ Quality: ${qualityIssues.length} replies with issues (${((qualityIssues.length / replies.length) * 100).toFixed(0)}%)`);
  }
  
  if (avgRepliesPerTarget > 2) {
    issues.push(`⚠️  Diversity: Averaging ${avgRepliesPerTarget.toFixed(1)} replies per target (should be < 2)`);
  }
  
  if (issues.length === 0) {
    console.log('✅ No major issues detected!');
  } else {
    issues.forEach(issue => console.log(issue));
  }
  
  console.log('\n═══════════════════════════════════════════════════════\n');
}

main();

