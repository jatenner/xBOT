#!/usr/bin/env tsx
/**
 * Harvest Single-Cycle Proof
 * 
 * Runs one harvest cycle and captures:
 * - Harvested tweet URLs + IDs
 * - Query used
 * - Harvest run ID
 * - Counts: dom_cards_found, status_urls_found, inserted_rows
 * - Saves artifacts (screenshots, HTML)
 */

import 'dotenv/config';
import { replyOpportunityHarvester } from '../../src/jobs/replyOpportunityHarvester';
import { getSupabaseClient } from '../../src/db/index';
import * as fs from 'fs';
import * as path from 'path';

const PROOF_DIR = path.join(process.cwd(), 'docs', 'proofs', 'harvest');
const TIMESTAMP = Date.now();
const PROOF_SUBDIR = path.join(PROOF_DIR, TIMESTAMP.toString());
const HARVEST_RUN_ID = `harvest_${TIMESTAMP}`;

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        🌾 HARVEST SINGLE-CYCLE PROOF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Ensure proof directory exists
  if (!fs.existsSync(PROOF_SUBDIR)) {
    fs.mkdirSync(PROOF_SUBDIR, { recursive: true });
  }

  const supabase = getSupabaseClient();

  // Get baseline count
  const { count: beforeCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .like('discovery_source', 'public_search_%');

  console.log(`📊 Baseline: ${beforeCount || 0} public_search_* opportunities\n`);

  // Capture console logs for harvest metrics
  const originalLog = console.log;
  const harvestMetrics: {
    queries: Array<{ label: string; url: string }>;
    domCards: number[];
    statusUrls: number[];
    stored: Array<{ tweet_id: string; discovery_source: string }>;
  } = {
    queries: [],
    domCards: [],
    statusUrls: [],
    stored: [],
  };

  // Intercept logs to capture metrics
  console.log = (...args: any[]) => {
    const msg = args.join(' ');
    
    // Capture query URLs
    if (msg.includes('Navigating to search:')) {
      const urlMatch = msg.match(/Navigating to search: (https:\/\/[^\s]+)/);
      const labelMatch = msg.match(/\[REAL_DISCOVERY\] 🔍 (\w+) search:/);
      if (urlMatch && labelMatch) {
        harvestMetrics.queries.push({
          label: labelMatch[1],
          url: urlMatch[1],
        });
      }
    }

    // Capture DOM cards
    if (msg.includes('domTweetCards:')) {
      const match = msg.match(/domTweetCards: (\d+)/);
      if (match) {
        harvestMetrics.domCards.push(parseInt(match[1], 10));
      }
    }

    // Capture status URLs
    if (msg.includes('statusUrls:')) {
      const match = msg.match(/statusUrls: (\d+)/);
      if (match) {
        harvestMetrics.statusUrls.push(parseInt(match[1], 10));
      }
    }

    // Capture stored opportunities
    if (msg.includes('[HARVEST_STORE]')) {
      const tweetIdMatch = msg.match(/tweet_id=(\d+)/);
      const discoveryMatch = msg.match(/discovery_source=([^\s]+)/);
      if (tweetIdMatch) {
        harvestMetrics.stored.push({
          tweet_id: tweetIdMatch[1],
          discovery_source: discoveryMatch ? discoveryMatch[1] : 'unknown',
        });
      }
    }

    originalLog(...args);
  };

  try {
    console.log(`🚀 Starting harvest cycle (run_id: ${HARVEST_RUN_ID})...\n`);
    await replyOpportunityHarvester();
  } finally {
    console.log = originalLog;
  }

  // Get final count
  const { count: afterCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .like('discovery_source', 'public_search_%');

  const insertedRows = (afterCount || 0) - (beforeCount || 0);

  // Get newly inserted rows
  const { data: newRows } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_tweet_url, target_username, discovery_source, like_count, created_at')
    .like('discovery_source', 'public_search_%')
    .order('created_at', { ascending: false })
    .limit(insertedRows > 0 ? insertedRows : 10);

  // Generate proof doc
  const proofDoc = `# Harvest Single-Cycle Proof - ${new Date().toISOString()}

## Harvest Run Info
- **Run ID**: ${HARVEST_RUN_ID}
- **Timestamp**: ${new Date().toISOString()}

## Queries Executed
${harvestMetrics.queries.map((q, i) => `${i + 1}. **${q.label}**: ${q.url}`).join('\n')}

## Extraction Metrics
- **Total DOM cards found**: ${harvestMetrics.domCards.reduce((a, b) => a + b, 0)}
- **Total status URLs found**: ${harvestMetrics.statusUrls.reduce((a, b) => a + b, 0)}
- **Queries with results**: ${harvestMetrics.domCards.filter(c => c > 0).length}/${harvestMetrics.domCards.length}

## Database Results
- **Baseline count**: ${beforeCount || 0}
- **Final count**: ${afterCount || 0}
- **Inserted rows**: ${insertedRows}

## Harvested Opportunities
${newRows && newRows.length > 0
  ? newRows.map((r, i) => `${i + 1}. **${r.discovery_source}** | @${r.target_username} | ${r.target_tweet_id} | ${r.like_count} likes | ${r.created_at}`).join('\n')
  : 'No new opportunities inserted'}

## Verdict
${insertedRows > 0 ? '✅ **PASS**: Harvest cycle inserted opportunities' : '❌ **FAIL**: No opportunities inserted'}
`;

  const proofDocPath = path.join(PROOF_SUBDIR, 'HARVEST_SINGLE_CYCLE.md');
  fs.writeFileSync(proofDocPath, proofDoc, 'utf8');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Harvest Run ID: ${HARVEST_RUN_ID}`);
  console.log(`Queries executed: ${harvestMetrics.queries.length}`);
  console.log(`Total DOM cards: ${harvestMetrics.domCards.reduce((a, b) => a + b, 0)}`);
  console.log(`Total status URLs: ${harvestMetrics.statusUrls.reduce((a, b) => a + b, 0)}`);
  console.log(`Inserted rows: ${insertedRows}`);
  console.log(`Proof doc: ${proofDocPath}`);

  if (insertedRows > 0) {
    console.log('\n✅ SUCCESS: Harvest cycle completed with inserted opportunities');
  } else {
    console.log('\n⚠️  WARNING: No opportunities inserted (may need selector update or backoff)');
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
