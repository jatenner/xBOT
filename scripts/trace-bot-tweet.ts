#!/usr/bin/env tsx
/**
 * 🔍 BOT TWEET FORENSIC TRACE SCRIPT
 * Traces a bot tweet by tweet_id to find exactly why it was broken
 * 
 * Usage: tsx scripts/trace-bot-tweet.ts <tweet_id1> [tweet_id2] ...
 */

import { config } from 'dotenv';
config({ path: '.env' });

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

interface TraceReport {
  tweet_id: string;
  found_in_db: boolean;
  decision_id: string | null;
  decision_type: string | null;
  generator: string | null;
  created_by_job: string | null;
  target_tweet_id: string | null;
  root_tweet_id: string | null;
  root_equals_target: boolean | null;
  snapshot_preview: string | null;
  snapshot_length: number | null;
  snapshot_hash: string | null;
  semantic_similarity: number | null;
  status: string | null;
  skip_reason: string | null;
  posted_at: string | null;
  created_at: string | null;
  content_preview: string | null;
  issues: string[];
}

async function traceBotTweet(tweetId: string): Promise<TraceReport> {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`🔍 FORENSIC TRACE FOR tweet_id=${tweetId}`);
  console.log(`${'═'.repeat(80)}\n`);
  
  const report: TraceReport = {
    tweet_id: tweetId,
    found_in_db: false,
    decision_id: null,
    decision_type: null,
    generator: null,
    created_by_job: null,
    target_tweet_id: null,
    root_tweet_id: null,
    root_equals_target: null,
    snapshot_preview: null,
    snapshot_length: null,
    snapshot_hash: null,
    semantic_similarity: null,
    status: null,
    skip_reason: null,
    posted_at: null,
    created_at: null,
    content_preview: null,
    issues: []
  };
  
  try {
    // 1. Search in main content table
    const { rows: contentRows } = await pool.query(`
      SELECT 
        decision_id,
        decision_type,
        generation_source,
        generator_name,
        target_tweet_id,
        root_tweet_id,
        target_tweet_content_snapshot,
        target_tweet_content_hash,
        semantic_similarity,
        status,
        skip_reason,
        content,
        created_at,
        posted_at
      FROM content_generation_metadata_comprehensive
      WHERE tweet_id = $1
         OR decision_id = $1
      LIMIT 1
    `, [tweetId]);
    
    if (contentRows.length > 0) {
      const row = contentRows[0];
      report.found_in_db = true;
      report.decision_id = row.decision_id;
      report.decision_type = row.decision_type;
      report.generator = row.generation_source || row.generator_name;
      report.created_by_job = row.generation_source;
      report.target_tweet_id = row.target_tweet_id;
      report.root_tweet_id = row.root_tweet_id;
      report.root_equals_target = row.root_tweet_id === row.target_tweet_id;
      report.snapshot_preview = row.target_tweet_content_snapshot?.substring(0, 100);
      report.snapshot_length = row.target_tweet_content_snapshot?.length || 0;
      report.snapshot_hash = row.target_tweet_content_hash;
      report.semantic_similarity = parseFloat(row.semantic_similarity) || null;
      report.status = row.status;
      report.skip_reason = row.skip_reason;
      report.posted_at = row.posted_at;
      report.created_at = row.created_at;
      report.content_preview = row.content?.substring(0, 150);
      
      // Analyze issues
      if (report.decision_type === 'reply') {
        if (!report.target_tweet_id) {
          report.issues.push('❌ MISSING target_tweet_id');
        }
        if (!report.root_tweet_id) {
          report.issues.push('❌ MISSING root_tweet_id');
        }
        if (report.root_tweet_id && report.target_tweet_id && report.root_tweet_id !== report.target_tweet_id) {
          report.issues.push('❌ ROOT-ONLY VIOLATION: root != target');
        }
        if (!report.snapshot_length || report.snapshot_length < 20) {
          report.issues.push(`❌ SNAPSHOT TOO SHORT: ${report.snapshot_length || 0} chars`);
        }
        if (!report.semantic_similarity || report.semantic_similarity < 0.30) {
          report.issues.push(`❌ LOW SIMILARITY: ${report.semantic_similarity?.toFixed(2) || 'NULL'}`);
        }
        
        // Check for thread markers
        const content = row.content || '';
        const threadPatterns = [
          { pattern: /\b\d+\/\d+\b/, name: 'X/Y pattern' },
          { pattern: /\bTIP:/i, name: 'TIP:' },
          { pattern: /\bPROTOCOL:/i, name: 'PROTOCOL:' },
          { pattern: /🧵/, name: 'Thread emoji' },
          { pattern: /\bthread\b/i, name: '"thread" word' }
        ];
        
        for (const { pattern, name } of threadPatterns) {
          if (pattern.test(content)) {
            report.issues.push(`❌ THREAD MARKER: ${name}`);
          }
        }
      }
    } else {
      console.log(`❌ Not found in content_generation_metadata_comprehensive`);
      report.issues.push('❌ NOT FOUND IN MAIN DB TABLE');
      
      // Search in posting_attempts
      const { rows: attemptRows } = await pool.query(`
        SELECT * FROM posting_attempts WHERE tweet_id = $1 LIMIT 1
      `, [tweetId]);
      
      if (attemptRows.length > 0) {
        console.log(`📋 Found in posting_attempts:`, attemptRows[0]);
        report.issues.push('⚠️ Found in posting_attempts but not in main table');
      }
    }
    
    // Print report
    console.log('📋 TRACE REPORT');
    console.log('─'.repeat(40));
    console.log(`  tweet_id:            ${report.tweet_id}`);
    console.log(`  found_in_db:         ${report.found_in_db}`);
    console.log(`  decision_id:         ${report.decision_id || '(null)'}`);
    console.log(`  decision_type:       ${report.decision_type || '(null)'}`);
    console.log(`  generator:           ${report.generator || '(null)'}`);
    console.log(`  target_tweet_id:     ${report.target_tweet_id || '(null)'}`);
    console.log(`  root_tweet_id:       ${report.root_tweet_id || '(null)'}`);
    console.log(`  root==target:        ${report.root_equals_target}`);
    console.log(`  snapshot_length:     ${report.snapshot_length || 0}`);
    console.log(`  semantic_similarity: ${report.semantic_similarity?.toFixed(3) || '(null)'}`);
    console.log(`  status:              ${report.status || '(null)'}`);
    console.log(`  skip_reason:         ${report.skip_reason || '(null)'}`);
    console.log(`  created_at:          ${report.created_at || '(null)'}`);
    console.log(`  posted_at:           ${report.posted_at || '(null)'}`);
    
    if (report.snapshot_preview) {
      console.log(`  snapshot:            "${report.snapshot_preview}..."`);
    }
    if (report.content_preview) {
      console.log(`  content:             "${report.content_preview}..."`);
    }
    
    console.log('\n🔎 ISSUES DETECTED');
    console.log('─'.repeat(40));
    if (report.issues.length === 0) {
      console.log('  ✅ No obvious issues detected');
    } else {
      report.issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    }
    
    console.log('\n' + '═'.repeat(80) + '\n');
    
  } catch (error: any) {
    console.error('❌ Trace error:', error.message);
    report.issues.push(`ERROR: ${error.message}`);
  }
  
  return report;
}

async function findRecentThreadLikeReplies(): Promise<void> {
  console.log('\n' + '═'.repeat(80));
  console.log('🔍 SEARCHING FOR THREAD-LIKE REPLIES IN LAST 24 HOURS');
  console.log('═'.repeat(80) + '\n');
  
  try {
    const { rows } = await pool.query(`
      SELECT 
        tweet_id,
        decision_id,
        LEFT(content, 150) as content,
        target_tweet_id,
        root_tweet_id,
        semantic_similarity,
        status,
        posted_at
      FROM content_generation_metadata_comprehensive
      WHERE decision_type = 'reply'
        AND created_at >= NOW() - INTERVAL '24 hours'
        AND (
          content ~ '\\d+/\\d+' 
          OR content ILIKE '%TIP:%'
          OR content ILIKE '%PROTOCOL:%'
          OR content LIKE '%🧵%'
          OR content ILIKE '%thread%'
        )
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    if (rows.length === 0) {
      console.log('✅ No thread-like replies found in last 24 hours');
    } else {
      console.log(`⚠️ Found ${rows.length} thread-like replies:\n`);
      rows.forEach((row, i) => {
        console.log(`${i + 1}. tweet_id=${row.tweet_id || '(null)'}`);
        console.log(`   decision_id=${row.decision_id}`);
        console.log(`   content="${row.content}..."`);
        console.log(`   status=${row.status}`);
        console.log('');
      });
    }
  } catch (error: any) {
    console.error('Error searching for thread-like replies:', error.message);
  }
}

async function main() {
  const tweetIds = process.argv.slice(2);
  
  if (tweetIds.length === 0) {
    console.log('Usage: tsx scripts/trace-bot-tweet.ts <tweet_id1> [tweet_id2] ...');
    console.log('\nExample: tsx scripts/trace-bot-tweet.ts 2007394704745476527');
    console.log('\nOr: tsx scripts/trace-bot-tweet.ts --find-thread-like');
    process.exit(1);
  }
  
  if (tweetIds.includes('--find-thread-like')) {
    await findRecentThreadLikeReplies();
  } else {
    for (const tweetId of tweetIds) {
      await traceBotTweet(tweetId);
    }
  }
  
  await pool.end();
}

main().catch(console.error);

