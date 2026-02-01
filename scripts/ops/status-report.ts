#!/usr/bin/env tsx
/**
 * Status Report Generator
 * Computes % complete from TRACKER.md and live DB metrics
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface TrackerTask {
  status: 'PLANNED' | 'BUILT' | 'PROVEN' | 'BROKEN';
  description: string;
  proof?: string;
}

async function main() {
  const supabase = getSupabaseClient();
  const dbUrl = process.env.DATABASE_URL!;
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  await client.connect();
  
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📊 xBOT Status Report');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  // 1. Read TRACKER.md and compute %
  const trackerPath = path.join(__dirname, '../../docs/TRACKER.md');
  let trackerContent = '';
  if (fs.existsSync(trackerPath)) {
    trackerContent = fs.readFileSync(trackerPath, 'utf8');
  }
  
  const provenMatches = trackerContent.match(/\[x\]\s+\*\*PROVEN\*\*/g) || [];
  const builtMatches = trackerContent.match(/\[ \]\s+\*\*BUILT\*\*/g) || [];
  const plannedMatches = trackerContent.match(/\[ \]\s+\*\*PLANNED\*\*/g) || [];
  const brokenMatches = trackerContent.match(/\[ \]\s+\*\*BROKEN\*\*/g) || [];
  
  const totalTasks = provenMatches.length + builtMatches.length + plannedMatches.length + brokenMatches.length;
  const provenCount = provenMatches.length;
  const overallPercent = totalTasks > 0 ? Math.round((provenCount / totalTasks) * 100) : 0;
  
  console.log('📈 Tracker Progress:');
  console.log(`   PROVEN: ${provenCount}`);
  console.log(`   BUILT: ${builtMatches.length}`);
  console.log(`   PLANNED: ${plannedMatches.length}`);
  console.log(`   BROKEN: ${brokenMatches.length}`);
  console.log(`   Overall: ${overallPercent}%\n`);
  
  // 2. Live DB metrics
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Public candidates
  const { rows: publicCandidates } = await client.query(`
    SELECT COUNT(*) as count
    FROM reply_opportunities
    WHERE discovery_source LIKE 'public_search_%'
    AND replied_to = false
    AND created_at >= $1;
  `, [twentyFourHoursAgo]);
  
  // Total opportunities
  const { rows: totalOpps } = await client.query(`
    SELECT COUNT(*) as count
    FROM reply_opportunities
    WHERE replied_to = false
    AND created_at >= $1;
  `, [twentyFourHoursAgo]);
  
  // Forbidden authors
  const { rows: forbiddenAuthors } = await client.query(`
    SELECT COUNT(*) as count FROM forbidden_authors;
  `);
  
  // Queue size
  const { rows: queueSize } = await client.query(`
    SELECT COUNT(*) as count
    FROM reply_candidate_queue
    WHERE status = 'queued'
    AND expires_at > NOW();
  `);
  
  // Decisions created
  const { rows: decisionsCreated } = await client.query(`
    SELECT COUNT(*) as count
    FROM content_generation_metadata_comprehensive
    WHERE decision_type = 'reply'
    AND created_at >= $1;
  `, [twentyFourHoursAgo]);
  
  // Decisions posted
  const { rows: decisionsPosted } = await client.query(`
    SELECT COUNT(*) as count
    FROM content_generation_metadata_comprehensive
    WHERE decision_type = 'reply'
    AND posted_tweet_id IS NOT NULL
    AND posted_at >= $1;
  `, [twentyFourHoursAgo]);
  
  // Last auth check
  const { rows: lastAuth } = await client.query(`
    SELECT event_type, message, created_at
    FROM system_events
    WHERE event_type IN ('auth_freshness_ok', 'auth_freshness_failed', 'HARVESTER_AUTH_VERIFIED', 'HARVESTER_AUTH_INVALID')
    ORDER BY created_at DESC
    LIMIT 1;
  `);
  
  console.log('📊 Live Metrics (Last 24h):');
  console.log(`   Public Candidates: ${publicCandidates[0]?.count || 0}`);
  console.log(`   Total Opportunities: ${totalOpps[0]?.count || 0}`);
  console.log(`   Forbidden Authors: ${forbiddenAuthors[0]?.count || 0}`);
  console.log(`   Candidates Queued: ${queueSize[0]?.count || 0}`);
  console.log(`   Decisions Created: ${decisionsCreated[0]?.count || 0}`);
  console.log(`   Decisions Posted: ${decisionsPosted[0]?.count || 0}`);
  if (lastAuth.length > 0) {
    console.log(`   Last Auth: ${lastAuth[0].event_type} at ${lastAuth[0].created_at}`);
  }
  
  // 3. Write daily snapshot
  const today = new Date().toISOString().split('T')[0];
  const snapshotDir = path.join(__dirname, '../../docs/status/daily');
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }
  
  const snapshotPath = path.join(snapshotDir, `${today}.md`);
  const snapshot = `# Status Snapshot - ${today}

Generated: ${new Date().toISOString()}

## Tracker Progress
- PROVEN: ${provenCount}
- BUILT: ${builtMatches.length}
- PLANNED: ${plannedMatches.length}
- BROKEN: ${brokenMatches.length}
- Overall: ${overallPercent}%

## Live Metrics (Last 24h)
- Public Candidates: ${publicCandidates[0]?.count || 0}
- Total Opportunities: ${totalOpps[0]?.count || 0}
- Forbidden Authors: ${forbiddenAuthors[0]?.count || 0}
- Candidates Queued: ${queueSize[0]?.count || 0}
- Decisions Created: ${decisionsCreated[0]?.count || 0}
- Decisions Posted: ${decisionsPosted[0]?.count || 0}
- Last Auth: ${lastAuth.length > 0 ? `${lastAuth[0].event_type} at ${lastAuth[0].created_at}` : 'unknown'}
`;
  
  fs.writeFileSync(snapshotPath, snapshot);
  console.log(`\n💾 Snapshot saved: ${snapshotPath}`);
  
  await client.end();
}

main().catch(console.error);
