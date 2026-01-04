#!/usr/bin/env tsx
/**
 * 🔍 DATA INTEGRITY AUDIT
 * Finds gaps in tweet_ids, engagement data, and learning writes
 * 
 * Run: pnpm tsx scripts/integrity-audit.ts
 */

import { pgPool } from '../src/db/pg';

interface AuditResult {
  category: string;
  issue: string;
  count: number;
  examples: string[];
}

async function runAudit(): Promise<AuditResult[]> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 DATA INTEGRITY AUDIT - Starting');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const results: AuditResult[] = [];
  
  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT 1: Posted decisions with NULL tweet_id
  // ═══════════════════════════════════════════════════════════════════════
  console.log('📋 AUDIT 1: Posted decisions with NULL tweet_id');
  try {
    const { rows: nullTweetIds } = await pgPool.query(`
      SELECT decision_id, decision_type, content, posted_at
      FROM content_generation_metadata_comprehensive
      WHERE status = 'posted'
      AND tweet_id IS NULL
      ORDER BY posted_at DESC
      LIMIT 20
    `);
    
    results.push({
      category: 'MISSING_TWEET_ID',
      issue: 'Decisions marked as posted but have NULL tweet_id',
      count: nullTweetIds.length,
      examples: nullTweetIds.slice(0, 5).map(r => 
        `${r.decision_id} (${r.decision_type}) - ${r.content?.substring(0, 50)}...`
      )
    });
    
    console.log(`   Found: ${nullTweetIds.length} rows with NULL tweet_id`);
    if (nullTweetIds.length > 0) {
      console.log(`   Examples: ${nullTweetIds.slice(0, 3).map(r => r.decision_id).join(', ')}`);
    }
  } catch (e: any) {
    console.error(`   ❌ Error: ${e.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT 2: Reply decisions missing root_tweet_id
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📋 AUDIT 2: Reply decisions missing root_tweet_id');
  try {
    const { rows: missingRoot } = await pgPool.query(`
      SELECT decision_id, target_tweet_id, resolved_via_root, posted_at
      FROM content_generation_metadata_comprehensive
      WHERE decision_type = 'reply'
      AND status = 'posted'
      AND root_tweet_id IS NULL
      ORDER BY posted_at DESC
      LIMIT 20
    `);
    
    results.push({
      category: 'MISSING_ROOT_TWEET_ID',
      issue: 'Posted replies without root_tweet_id (traceability gap)',
      count: missingRoot.length,
      examples: missingRoot.slice(0, 5).map(r => 
        `${r.decision_id} → target=${r.target_tweet_id}`
      )
    });
    
    console.log(`   Found: ${missingRoot.length} replies without root_tweet_id`);
  } catch (e: any) {
    console.error(`   ❌ Error: ${e.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT 3: Thread-like content in reply decisions
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📋 AUDIT 3: Thread-like content in posted replies');
  try {
    const { rows: threadLike } = await pgPool.query(`
      SELECT decision_id, tweet_id, LEFT(content, 100) as content_preview, posted_at
      FROM content_generation_metadata_comprehensive
      WHERE decision_type = 'reply'
      AND status = 'posted'
      AND (
        content ~ '\\d+/\\d+' 
        OR content ~* 'thread' 
        OR content ~* '\\(1\\)'
        OR content ~* 'TIP \\d+'
        OR content ~* 'PROTOCOL:'
      )
      ORDER BY posted_at DESC
      LIMIT 20
    `);
    
    results.push({
      category: 'THREAD_LIKE_REPLIES',
      issue: 'Replies with thread markers (should never happen)',
      count: threadLike.length,
      examples: threadLike.slice(0, 5).map(r => 
        `${r.tweet_id}: "${r.content_preview}"`
      )
    });
    
    console.log(`   Found: ${threadLike.length} thread-like replies`);
    if (threadLike.length > 0) {
      console.log(`   ⚠️  WARNING: These should NOT have been posted!`);
      threadLike.slice(0, 3).forEach(r => {
        console.log(`      - ${r.tweet_id}: "${r.content_preview?.substring(0, 60)}..."`);
      });
    }
  } catch (e: any) {
    console.error(`   ❌ Error: ${e.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT 4: Posted tweets missing from outcomes table
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📋 AUDIT 4: Posted tweets missing engagement data (outcomes)');
  try {
    const { rows: missingOutcomes } = await pgPool.query(`
      SELECT c.decision_id, c.tweet_id, c.posted_at
      FROM content_generation_metadata_comprehensive c
      LEFT JOIN outcomes o ON c.decision_id::uuid = o.decision_id
      WHERE c.status = 'posted'
      AND c.tweet_id IS NOT NULL
      AND c.posted_at < NOW() - INTERVAL '1 hour'
      AND o.decision_id IS NULL
      ORDER BY c.posted_at DESC
      LIMIT 20
    `);
    
    results.push({
      category: 'MISSING_OUTCOMES',
      issue: 'Posted tweets with no engagement data in outcomes table',
      count: missingOutcomes.length,
      examples: missingOutcomes.slice(0, 5).map(r => 
        `${r.tweet_id} (posted ${r.posted_at})`
      )
    });
    
    console.log(`   Found: ${missingOutcomes.length} tweets missing outcomes`);
  } catch (e: any) {
    console.error(`   ❌ Error: ${e.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT 5: Posting attempts with success but no DB update
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📋 AUDIT 5: Posting attempts with success but no matching DB row');
  try {
    const { rows: orphanedAttempts } = await pgPool.query(`
      SELECT pa.id, pa.decision_id, pa.tweet_id, pa.created_at
      FROM posting_attempts pa
      LEFT JOIN content_generation_metadata_comprehensive c 
        ON pa.decision_id = c.decision_id
      WHERE pa.status = 'success'
      AND pa.tweet_id IS NOT NULL
      AND (c.tweet_id IS NULL OR c.tweet_id != pa.tweet_id)
      ORDER BY pa.created_at DESC
      LIMIT 20
    `);
    
    results.push({
      category: 'ORPHANED_POSTING_ATTEMPTS',
      issue: 'Successful posts not reflected in content_metadata',
      count: orphanedAttempts.length,
      examples: orphanedAttempts.slice(0, 5).map(r => 
        `attempt=${r.id} decision=${r.decision_id} tweet=${r.tweet_id}`
      )
    });
    
    console.log(`   Found: ${orphanedAttempts.length} orphaned posting attempts`);
  } catch (e: any) {
    console.error(`   ❌ Error: ${e.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT 6: Reply opportunities that were replied but not marked
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📋 AUDIT 6: Reply opportunities not properly marked after reply');
  try {
    const { rows: unmarkedOpps } = await pgPool.query(`
      SELECT ro.id, ro.target_tweet_id, ro.replied_to
      FROM reply_opportunities ro
      INNER JOIN content_generation_metadata_comprehensive c 
        ON ro.target_tweet_id = c.target_tweet_id
      WHERE c.decision_type = 'reply'
      AND c.status = 'posted'
      AND c.tweet_id IS NOT NULL
      AND ro.replied_to = false
      LIMIT 20
    `);
    
    results.push({
      category: 'UNMARKED_OPPORTUNITIES',
      issue: 'Opportunities not marked as replied after successful reply',
      count: unmarkedOpps.length,
      examples: unmarkedOpps.slice(0, 5).map(r => 
        `opp_id=${r.id} target=${r.target_tweet_id}`
      )
    });
    
    console.log(`   Found: ${unmarkedOpps.length} unmarked opportunities`);
  } catch (e: any) {
    console.error(`   ❌ Error: ${e.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 AUDIT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  
  let totalIssues = 0;
  for (const result of results) {
    const status = result.count === 0 ? '✅' : '⚠️';
    console.log(`${status} ${result.category}: ${result.count} issues`);
    totalIssues += result.count;
  }
  
  console.log('───────────────────────────────────────────────────────────');
  console.log(`Total issues found: ${totalIssues}`);
  
  if (totalIssues === 0) {
    console.log('🎉 All integrity checks passed!');
  } else {
    console.log('⚠️  Data integrity issues detected - review examples above');
  }
  
  return results;
}

// Run if executed directly
runAudit()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  });

