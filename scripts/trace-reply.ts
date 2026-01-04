#!/usr/bin/env tsx
/**
 * 🔍 REPLY FORENSIC TRACE SCRIPT
 * Traces a reply by tweet_id to find exactly why it was broken
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ 
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

interface TraceResult {
  tweet_id: string;
  decision_id: string;
  decision_type: string;
  content: string;
  content_length: number;
  target_tweet_id: string;
  root_tweet_id: string | null;
  original_candidate_tweet_id: string | null;
  resolved_via_root: boolean | null;
  target_tweet_content_snapshot: string | null;
  target_tweet_content_hash: string | null;
  semantic_similarity: number | null;
  generation_source: string | null;
  generator_name: string | null;
  guard_results: any;
  skip_reason: string | null;
  status: string;
  created_at: string;
  posted_at: string;
  
  // Analysis
  has_thread_markers: boolean;
  thread_marker_found: string | null;
  has_empty_snapshot: boolean;
  line_count: number;
}

async function traceReply(tweetId: string): Promise<void> {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`🔍 FORENSIC TRACE FOR tweet_id=${tweetId}`);
  console.log(`${'═'.repeat(80)}\n`);
  
  try {
    // 1. Find the decision by tweet_id
    const { rows } = await pool.query(`
      SELECT 
        tweet_id,
        decision_id,
        decision_type,
        content,
        LENGTH(content) as content_length,
        target_tweet_id,
        root_tweet_id,
        original_candidate_tweet_id,
        resolved_via_root,
        target_tweet_content_snapshot,
        target_tweet_content_hash,
        semantic_similarity,
        generation_source,
        generator_name,
        guard_results,
        skip_reason,
        status,
        created_at,
        posted_at
      FROM content_generation_metadata_comprehensive
      WHERE tweet_id = $1
         OR decision_id = $1
      LIMIT 1
    `, [tweetId]);
    
    if (rows.length === 0) {
      console.log(`❌ No decision found for tweet_id=${tweetId}`);
      console.log('\n🔍 Searching in posting_attempts...');
      
      const { rows: attemptRows } = await pool.query(`
        SELECT * FROM posting_attempts WHERE tweet_id = $1 LIMIT 1
      `, [tweetId]);
      
      if (attemptRows.length > 0) {
        console.log('Found in posting_attempts:', JSON.stringify(attemptRows[0], null, 2));
      }
      return;
    }
    
    const decision = rows[0] as TraceResult;
    
    // Analyze content for thread markers
    const content = decision.content || '';
    const threadPatterns = [
      { pattern: /\b\d+\/\d+\b/, name: 'numbered (1/5)' },
      { pattern: /^\d+\.\s/m, name: 'numbered list (1.)' },
      { pattern: /\(\d+\)/, name: 'parenthetical ((1))' },
      { pattern: /🧵/, name: 'thread emoji' },
      { pattern: /\bthread\b/i, name: 'word "thread"' },
      { pattern: /TIP\s*\d+/i, name: 'TIP marker' },
      { pattern: /\bPROTOCOL:/i, name: 'PROTOCOL:' },
    ];
    
    let threadMarkerFound: string | null = null;
    for (const { pattern, name } of threadPatterns) {
      if (pattern.test(content)) {
        threadMarkerFound = name;
        break;
      }
    }
    
    const lineCount = content.split('\n').filter((l: string) => l.trim()).length;
    const hasEmptySnapshot = !decision.target_tweet_content_snapshot || 
                             decision.target_tweet_content_snapshot.trim() === '';
    
    // Print the trace report
    console.log('📋 DECISION METADATA');
    console.log('─'.repeat(40));
    console.log(`  decision_id:        ${decision.decision_id}`);
    console.log(`  decision_type:      ${decision.decision_type}`);
    console.log(`  status:             ${decision.status}`);
    console.log(`  generation_source:  ${decision.generation_source}`);
    console.log(`  generator_name:     ${decision.generator_name}`);
    console.log(`  created_at:         ${decision.created_at}`);
    console.log(`  posted_at:          ${decision.posted_at}`);
    console.log(`  skip_reason:        ${decision.skip_reason || '(none)'}`);
    
    console.log('\n📍 TARGET RESOLUTION');
    console.log('─'.repeat(40));
    console.log(`  target_tweet_id:          ${decision.target_tweet_id}`);
    console.log(`  root_tweet_id:            ${decision.root_tweet_id || '(null)'}`);
    console.log(`  original_candidate_id:    ${decision.original_candidate_tweet_id || '(null)'}`);
    console.log(`  resolved_via_root:        ${decision.resolved_via_root}`);
    
    console.log('\n📝 CONTEXT SNAPSHOT');
    console.log('─'.repeat(40));
    console.log(`  snapshot_hash:      ${decision.target_tweet_content_hash || '(null)'}`);
    console.log(`  semantic_similarity: ${decision.semantic_similarity ?? '(null)'}`);
    console.log(`  snapshot_empty:     ${hasEmptySnapshot ? '⚠️  YES - EMPTY!' : '✅ No'}`);
    if (decision.target_tweet_content_snapshot) {
      console.log(`  snapshot_preview:   "${decision.target_tweet_content_snapshot.substring(0, 200)}..."`);
    } else {
      console.log(`  snapshot_preview:   (null/empty)`);
    }
    
    console.log('\n📄 REPLY CONTENT');
    console.log('─'.repeat(40));
    console.log(`  content_length:     ${decision.content_length} chars`);
    console.log(`  line_count:         ${lineCount} lines`);
    console.log(`  thread_marker:      ${threadMarkerFound ? `⚠️  FOUND: ${threadMarkerFound}` : '✅ None detected'}`);
    console.log(`  content_preview:    "${content.substring(0, 200)}..."`);
    
    console.log('\n🛡️ GUARD RESULTS');
    console.log('─'.repeat(40));
    if (decision.guard_results) {
      console.log(JSON.stringify(decision.guard_results, null, 2));
    } else {
      console.log('  (no guard results stored)');
    }
    
    // DIAGNOSIS
    console.log('\n🔎 DIAGNOSIS');
    console.log('═'.repeat(40));
    
    const issues: string[] = [];
    
    // Check for issues
    if (threadMarkerFound) {
      issues.push(`(A) THREAD-LIKE CONTENT: Found "${threadMarkerFound}" pattern in reply`);
    }
    
    if (lineCount > 3) {
      issues.push(`(A) TOO MANY LINES: ${lineCount} lines (max 3 for reply)`);
    }
    
    if ((decision.content_length || 0) > 260) {
      issues.push(`(A) TOO LONG: ${decision.content_length} chars (max 260 for reply)`);
    }
    
    if (hasEmptySnapshot) {
      issues.push(`(B) EMPTY CONTEXT SNAPSHOT: LLM had no anchor to the target tweet`);
    }
    
    if (decision.generation_source?.includes('thread') || 
        decision.generation_source?.includes('multi') ||
        decision.generator_name?.includes('thread')) {
      issues.push(`(A) WRONG GENERATOR: ${decision.generation_source}/${decision.generator_name} is thread-oriented`);
    }
    
    if (!decision.root_tweet_id && decision.target_tweet_id) {
      issues.push(`(C) NO ROOT RESOLUTION: Posted to target without verifying if it's root`);
    }
    
    if (decision.resolved_via_root === false && decision.root_tweet_id !== decision.target_tweet_id) {
      issues.push(`(C) POSTED TO REPLY-CHAIN: Target may be a reply, not root`);
    }
    
    if (!decision.guard_results) {
      issues.push(`(D) NO GUARD RESULTS: Invariants may have been bypassed`);
    }
    
    if (issues.length === 0) {
      console.log('✅ No obvious issues detected in stored data');
      console.log('   May need to check live tweet to verify if target was actually a reply');
    } else {
      console.log('⚠️  ISSUES FOUND:');
      issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
    }
    
    console.log('\n' + '═'.repeat(80) + '\n');
    
  } catch (error: any) {
    console.error('❌ Trace error:', error.message);
  }
}

async function main() {
  const tweetIds = process.argv.slice(2);
  
  if (tweetIds.length === 0) {
    console.log('Usage: tsx scripts/trace-reply.ts <tweet_id1> [tweet_id2] ...');
    console.log('\nExample: tsx scripts/trace-reply.ts 2007394704745476527');
    process.exit(1);
  }
  
  for (const tweetId of tweetIds) {
    await traceReply(tweetId);
  }
  
  await pool.end();
}

main().catch(console.error);

