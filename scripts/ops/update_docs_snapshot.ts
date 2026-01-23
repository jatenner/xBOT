#!/usr/bin/env tsx
/**
 * 📸 DOCS SNAPSHOT UPDATER
 * 
 * Queries current system state and appends to docs/STATUS.md
 * Run: pnpm run docs:snapshot
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const STATUS_FILE = path.join(process.cwd(), 'docs/STATUS.md');

async function main() {
  console.log('📸 Updating docs/STATUS.md snapshot...\n');

  // Get git SHA
  const gitSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  console.log(`✅ Git SHA: ${gitSha}`);

  // Get current date
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // Query database for current state
  let lastPlanAge = 'UNKNOWN';
  let lastPostSuccess = 'UNKNOWN';
  let lastPostFailed = 'UNKNOWN';
  let replyTicks = 'UNKNOWN';
  let replyBlocks = 'UNKNOWN';
  let postingTicks = 'UNKNOWN';
  let postingBlocks = 'UNKNOWN';

  try {
    const { getSupabaseClient } = await import('../../src/db/index');
    const supabase = getSupabaseClient();

    // Last plan age
    try {
      const { data: planData } = await supabase
        .from('content_metadata')
        .select('created_at')
        .eq('status', 'queued')
        .in('decision_type', ['single', 'thread'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (planData?.created_at) {
        const planTime = new Date(planData.created_at);
        const ageMs = now.getTime() - planTime.getTime();
        const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
        const ageMinutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));
        lastPlanAge = `${ageHours}h ${ageMinutes}m ago (${planData.created_at})`;
      } else {
        lastPlanAge = 'No queued decisions found';
      }
    } catch (e: any) {
      lastPlanAge = `ERROR: ${e.message}`;
    }

    // Last POST_SUCCESS
    try {
      const { data: successData } = await supabase
        .from('system_events')
        .select('created_at, event_data')
        .eq('event_type', 'POST_SUCCESS')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (successData?.created_at) {
        const eventData = typeof successData.event_data === 'string' 
          ? JSON.parse(successData.event_data) 
          : successData.event_data;
        const tweetId = eventData.tweet_id || 'N/A';
        lastPostSuccess = `${successData.created_at} (tweet_id: ${tweetId})`;
      } else {
        lastPostSuccess = 'No POST_SUCCESS events found';
      }
    } catch (e: any) {
      lastPostSuccess = `ERROR: ${e.message}`;
    }

    // Last POST_FAILED
    try {
      const { data: failedData } = await supabase
        .from('system_events')
        .select('created_at, event_data')
        .eq('event_type', 'POST_FAILED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (failedData?.created_at) {
        const eventData = typeof failedData.event_data === 'string' 
          ? JSON.parse(failedData.event_data) 
          : failedData.event_data;
        const reason = eventData.reason || eventData.deny_reason_code || 'unknown';
        lastPostFailed = `${failedData.created_at} (reason: ${reason})`;
      } else {
        lastPostFailed = 'No POST_FAILED events found';
      }
    } catch (e: any) {
      lastPostFailed = `ERROR: ${e.message}`;
    }

    // Reply queue ticks (last 30 min)
    try {
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { count: tickCount, data: tickData } = await supabase
        .from('system_events')
        .select('created_at', { count: 'exact' })
        .eq('event_type', 'REPLY_QUEUE_TICK')
        .gte('created_at', thirtyMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (tickCount && tickCount > 0 && tickData && tickData.length > 0) {
        replyTicks = `${tickCount} ticks, last: ${tickData[0].created_at}`;
      } else {
        replyTicks = '0 ticks in last 30 minutes';
      }
    } catch (e: any) {
      replyTicks = `ERROR: ${e.message}`;
    }

    // Reply queue blocks (last 30 min)
    try {
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { data: blockData } = await supabase
        .from('system_events')
        .select('event_data')
        .eq('event_type', 'REPLY_QUEUE_BLOCKED')
        .gte('created_at', thirtyMinutesAgo);
      
      if (blockData && blockData.length > 0) {
        const reasons: Record<string, number> = {};
        blockData.forEach(block => {
          const eventData = typeof block.event_data === 'string' 
            ? JSON.parse(block.event_data) 
            : block.event_data;
          const reason = eventData.reason || 'unknown';
          reasons[reason] = (reasons[reason] || 0) + 1;
        });
        const reasonStrs = Object.entries(reasons)
          .map(([reason, count]) => `${reason}: ${count}`)
          .join(', ');
        replyBlocks = `${blockData.length} blocks (${reasonStrs})`;
      } else {
        replyBlocks = '0 blocks in last 30 minutes';
      }
    } catch (e: any) {
      replyBlocks = `ERROR: ${e.message}`;
    }

    // Posting queue ticks (last 30 min)
    try {
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { count: tickCount, data: tickData } = await supabase
        .from('system_events')
        .select('created_at', { count: 'exact' })
        .eq('event_type', 'POSTING_QUEUE_TICK')
        .gte('created_at', thirtyMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (tickCount && tickCount > 0 && tickData && tickData.length > 0) {
        replyTicks = `${tickCount} ticks, last: ${tickData[0].created_at}`;
      } else {
        postingTicks = '0 ticks in last 30 minutes';
      }
    } catch (e: any) {
      postingTicks = `ERROR: ${e.message}`;
    }

    // Posting queue blocks (last 30 min)
    try {
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { data: blockData } = await supabase
        .from('system_events')
        .select('event_data')
        .eq('event_type', 'POSTING_QUEUE_BLOCKED')
        .gte('created_at', thirtyMinutesAgo);
      
      if (blockData && blockData.length > 0) {
        const reasons: Record<string, number> = {};
        blockData.forEach(block => {
          const eventData = typeof block.event_data === 'string' 
            ? JSON.parse(block.event_data) 
            : block.event_data;
          const reason = eventData.reason || 'unknown';
          reasons[reason] = (reasons[reason] || 0) + 1;
        });
        const reasonStrs = Object.entries(reasons)
          .map(([reason, count]) => `${reason}: ${count}`)
          .join(', ');
        postingBlocks = `${blockData.length} blocks (${reasonStrs})`;
      } else {
        postingBlocks = '0 blocks in last 30 minutes';
      }
    } catch (e: any) {
      postingBlocks = `ERROR: ${e.message}`;
    }

  } catch (dbError: any) {
    console.error(`❌ Database error: ${dbError.message}`);
  }

  // Read existing STATUS.md
  let statusContent = '';
  if (fs.existsSync(STATUS_FILE)) {
    statusContent = fs.readFileSync(STATUS_FILE, 'utf-8');
  }

  // Generate new snapshot section
  const snapshotSection = `
## ${dateStr} - Snapshot

### Git SHA

- **Local HEAD:** \`${gitSha}\`
- **xBOT Service:** UNKNOWN (verify via \`railway logs --service xBOT | grep BOOT\`)
- **serene-cat Service:** UNKNOWN (verify via \`railway logs --service serene-cat | grep BOOT\`)

### Last Plan Age

${lastPlanAge}

### Last POST_SUCCESS

${lastPostSuccess}

### Last POST_FAILED

${lastPostFailed}

### Reply Queue Status

**Ticks (last 30 min):** ${replyTicks}  
**Blocks (last 30 min):** ${replyBlocks}

### Posting Queue Status

**Ticks (last 30 min):** ${postingTicks}  
**Blocks (last 30 min):** ${postingBlocks}

### Known Blockers

- None documented yet

---

`;

  // Append to STATUS.md (before the "How to Update" section if it exists)
  const updateSectionIndex = statusContent.indexOf('## How to Update');
  if (updateSectionIndex > 0) {
    const beforeUpdate = statusContent.substring(0, updateSectionIndex);
    const afterUpdate = statusContent.substring(updateSectionIndex);
    statusContent = beforeUpdate + snapshotSection + afterUpdate;
  } else {
    statusContent = statusContent + snapshotSection;
  }

  // Write updated content
  fs.writeFileSync(STATUS_FILE, statusContent, 'utf-8');

  console.log(`\n✅ Snapshot appended to docs/STATUS.md`);
  console.log(`   Date: ${dateStr}`);
  console.log(`   SHA: ${gitSha}`);
}

main().catch(err => {
  console.error('❌ Snapshot update failed:', err);
  process.exit(1);
});
