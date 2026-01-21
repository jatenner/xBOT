#!/usr/bin/env tsx
/**
 * Update GO_LIVE_RESISTANCE_INCIDENT.md with cooldown outcome
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function updateIncidentDoc() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Get cooldown status
    const { rows: cooldownActive } = await client.query(`
      SELECT event_data, created_at
      FROM system_events
      WHERE event_type = 'COOLDOWN_MODE_ACTIVE'
      ORDER BY created_at DESC
      LIMIT 1;
    `);

    const { rows: cooldownEnded } = await client.query(`
      SELECT event_data, created_at
      FROM system_events
      WHERE event_type = 'COOLDOWN_MODE_ENDED'
      ORDER BY created_at DESC
      LIMIT 1;
    `);

    const { rows: cooldownExtended } = await client.query(`
      SELECT event_data, created_at
      FROM system_events
      WHERE event_type = 'COOLDOWN_MODE_EXTENDED'
      ORDER BY created_at DESC
      LIMIT 1;
    `);

    // Get final resistance counts
    const { rows: finalResistance } = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE event_type = 'CONSENT_WALL') as consent_wall,
        COUNT(*) FILTER (WHERE event_type = 'CHALLENGE') as challenge,
        COUNT(*) FILTER (WHERE event_type = 'POST_FAILED' AND event_data->>'pipeline_error_reason' LIKE 'POSTING_FAILED%' AND event_data->>'pipeline_error_reason' NOT LIKE '%SAFETY_GATE%') as actual_failures
      FROM system_events
      WHERE event_type IN ('CONSENT_WALL', 'CHALLENGE', 'POST_FAILED')
        AND created_at >= (SELECT created_at FROM system_events WHERE event_type = 'COOLDOWN_MODE_ACTIVE' ORDER BY created_at DESC LIMIT 1);
    `);

    const docPath = path.join(process.cwd(), 'docs', 'GO_LIVE_RESISTANCE_INCIDENT.md');
    let doc = fs.readFileSync(docPath, 'utf-8');

    // Add cooldown outcome section
    const outcomeSection = `\n---\n\n## 🧊 Cooldown Outcome\n\n**Status:** ${cooldownEnded.length > 0 ? '✅ ENDED - Criteria Passed' : cooldownExtended.length > 0 ? '⚠️  EXTENDED - Criteria Not Met' : '⏳ ACTIVE'}\n\n${cooldownEnded.length > 0 ? `**Ended:** ${cooldownEnded[0].created_at}\n\n**Exit Criteria Results:**\n- CONSENT_WALL: ${cooldownEnded[0].event_data.exit_criteria.consent_wall} (need <5) ${cooldownEnded[0].event_data.exit_criteria.consent_wall < 5 ? '✅' : '❌'}\n- CHALLENGE: ${cooldownEnded[0].event_data.exit_criteria.challenge} (need 0) ${cooldownEnded[0].event_data.exit_criteria.challenge === 0 ? '✅' : '❌'}\n- Actual Failures: ${cooldownEnded[0].event_data.exit_criteria.actual_failures} (need <=1) ${cooldownEnded[0].event_data.exit_criteria.actual_failures <= 1 ? '✅' : '❌'}\n\n**Action Taken:** Restored MAX_REPLIES_PER_HOUR to ${cooldownEnded[0].event_data.restored_caps.max_replies_per_hour}` : cooldownExtended.length > 0 ? `**Extended:** ${cooldownExtended[0].created_at}\n\n**New End Time:** ${cooldownExtended[0].event_data.new_end_time}\n\n**Exit Criteria Results:**\n- CONSENT_WALL: ${cooldownExtended[0].event_data.exit_criteria.consent_wall} (need <5) ${cooldownExtended[0].event_data.exit_criteria.consent_wall < 5 ? '✅' : '❌'}\n- CHALLENGE: ${cooldownExtended[0].event_data.exit_criteria.challenge} (need 0) ${cooldownExtended[0].event_data.exit_criteria.challenge === 0 ? '✅' : '❌'}\n- Actual Failures: ${cooldownExtended[0].event_data.exit_criteria.actual_failures} (need <=1) ${cooldownExtended[0].event_data.exit_criteria.actual_failures <= 1 ? '✅' : '❌'}\n\n**Action Taken:** Extended cooldown 12h, set MAX_REPLIES_PER_HOUR to ${cooldownExtended[0].event_data.new_caps.max_replies_per_hour}\n\n**Reason:** ${cooldownExtended[0].event_data.reason}` : `**Active:** Cooldown still in progress\n\n**Final Resistance Counts (since cooldown start):**\n- CONSENT_WALL: ${finalResistance[0]?.consent_wall || 0}\n- CHALLENGE: ${finalResistance[0]?.challenge || 0}\n- Actual Failures: ${finalResistance[0]?.actual_failures || 0}`}\n\n**Updated:** ${new Date().toISOString()}\n`;

    // Append or update outcome section
    if (doc.includes('## 🧊 Cooldown Outcome')) {
      // Replace existing section
      const startIdx = doc.indexOf('## 🧊 Cooldown Outcome');
      const nextSectionIdx = doc.indexOf('\n## ', startIdx + 1);
      if (nextSectionIdx > 0) {
        doc = doc.substring(0, startIdx) + outcomeSection + doc.substring(nextSectionIdx);
      } else {
        doc = doc.substring(0, startIdx) + outcomeSection;
      }
    } else {
      // Append new section
      doc += outcomeSection;
    }

    fs.writeFileSync(docPath, doc, 'utf-8');
    console.log('✅ Incident doc updated:', docPath);

    await client.end();
    process.exit(0);

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

updateIncidentDoc();
