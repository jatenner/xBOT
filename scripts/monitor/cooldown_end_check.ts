#!/usr/bin/env tsx
/**
 * 🧊 COOLDOWN END CHECK
 * 
 * Checks exit criteria at cooldown end and either restores or extends cooldown
 */

import 'dotenv/config';
import { Client } from 'pg';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function checkCooldownEnd() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           🧊 COOLDOWN END CHECK');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Get cooldown status
    const { rows: cooldown } = await client.query(`
      SELECT event_data, created_at
      FROM system_events
      WHERE event_type = 'COOLDOWN_MODE_ACTIVE'
      ORDER BY created_at DESC
      LIMIT 1;
    `);

    if (cooldown.length === 0) {
      console.log('❌ No active cooldown found');
      await client.end();
      process.exit(1);
    }

    const cooldownData = cooldown[0].event_data;
    const cooldownEnd = new Date(cooldownData.end_time);
    const now = new Date();

    if (now < cooldownEnd) {
      const remaining = Math.floor((cooldownEnd.getTime() - now.getTime()) / (60 * 60 * 1000));
      console.log(`⏳ Cooldown still active (${remaining}h remaining)`);
      console.log(`   End time: ${cooldownEnd.toISOString()}`);
      await client.end();
      process.exit(0);
    }

    console.log('✅ Cooldown period ended. Checking exit criteria...\n');

    // Exit criteria checks
    const { rows: consentWall } = await client.query(`
      SELECT COUNT(*) as count
      FROM system_events
      WHERE event_type = 'CONSENT_WALL'
        AND created_at >= NOW() - INTERVAL '12 hours';
    `);

    const { rows: challenge } = await client.query(`
      SELECT COUNT(*) as count
      FROM system_events
      WHERE event_type = 'CHALLENGE'
        AND created_at >= NOW() - INTERVAL '12 hours';
    `);

    const { rows: postFail } = await client.query(`
      SELECT COUNT(*) as count
      FROM system_events
      WHERE event_type = 'POST_FAILED'
        AND event_data->>'pipeline_error_reason' LIKE 'POSTING_FAILED%'
        AND event_data->>'pipeline_error_reason' NOT LIKE '%SAFETY_GATE%'
        AND created_at >= NOW() - INTERVAL '12 hours';
    `);

    const consentWallCount = parseInt(consentWall[0].count, 10);
    const challengeCount = parseInt(challenge[0].count, 10);
    const actualFailures = parseInt(postFail[0].count, 10);

    console.log('Exit Criteria:');
    console.log(`   CONSENT_WALL < 5: ${consentWallCount} ${consentWallCount < 5 ? '✅' : '❌'}`);
    console.log(`   CHALLENGE = 0: ${challengeCount} ${challengeCount === 0 ? '✅' : '❌'}`);
    console.log(`   Actual Failures <= 1: ${actualFailures} ${actualFailures <= 1 ? '✅' : '❌'}`);
    console.log('');

    const allPass = consentWallCount < 5 && challengeCount === 0 && actualFailures <= 1;

    if (allPass) {
      console.log('✅ All exit criteria PASSED - Restoring previous caps...\n');

      // Restore previous caps
      const previousCaps = cooldownData.previous_caps;
      const restoreMaxReplies = previousCaps.max_replies_per_hour || 6;

      try {
        execSync(`railway variables --set "MAX_REPLIES_PER_HOUR=${restoreMaxReplies}"`, { stdio: 'pipe' });
        console.log(`✅ Restored MAX_REPLIES_PER_HOUR=${restoreMaxReplies}`);
        execSync('railway redeploy', { stdio: 'pipe', timeout: 30000 });
        console.log('✅ Redeploy triggered');
      } catch (err: any) {
        console.warn(`⚠️  Railway CLI failed: ${err.message}`);
      }

      // Log COOLDOWN_MODE_ENDED
      await client.query(`
        INSERT INTO system_events (event_type, severity, message, event_data, created_at)
        VALUES ('COOLDOWN_MODE_ENDED', 'info', 'Cooldown ended - criteria passed', $1, $2)
      `, [JSON.stringify({
        end_time: now.toISOString(),
        exit_criteria: {
          consent_wall: consentWallCount,
          challenge: challengeCount,
          actual_failures: actualFailures
        },
        all_criteria_passed: true,
        restored_caps: {
          max_replies_per_hour: restoreMaxReplies
        }
      }), now.toISOString()]);

      console.log('✅ Cooldown ended and caps restored');

      // Update incident doc
      try {
        execSync('pnpm run cooldown:update-doc', { stdio: 'pipe', timeout: 30000 });
        console.log('✅ Incident doc updated');
      } catch (err: any) {
        console.warn(`⚠️  Failed to update incident doc: ${err.message}`);
      }

    } else {
      console.log('❌ Exit criteria FAILED - Extending cooldown 12 more hours...\n');

      const newEndTime = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      const newMaxReplies = consentWallCount >= 5 ? 2 : 3; // Reduce further if CONSENT_WALL persists

      try {
        execSync(`railway variables --set "MAX_REPLIES_PER_HOUR=${newMaxReplies}"`, { stdio: 'pipe' });
        console.log(`✅ Set MAX_REPLIES_PER_HOUR=${newMaxReplies}`);
        execSync('railway redeploy', { stdio: 'pipe', timeout: 30000 });
        console.log('✅ Redeploy triggered');
      } catch (err: any) {
        console.warn(`⚠️  Railway CLI failed: ${err.message}`);
      }

      // Log extended cooldown
      await client.query(`
        INSERT INTO system_events (event_type, severity, message, event_data, created_at)
        VALUES ('COOLDOWN_MODE_EXTENDED', 'warning', 'Cooldown extended - criteria not met', $1, $2)
      `, [JSON.stringify({
        original_end_time: cooldownEnd.toISOString(),
        new_end_time: newEndTime.toISOString(),
        extension_hours: 12,
        exit_criteria: {
          consent_wall: consentWallCount,
          challenge: challengeCount,
          actual_failures: actualFailures
        },
        all_criteria_passed: false,
        new_caps: {
          max_replies_per_hour: newMaxReplies
        },
        reason: `CONSENT_WALL=${consentWallCount} (need <5), CHALLENGE=${challengeCount} (need 0), Failures=${actualFailures} (need <=1)`
      }), now.toISOString()]);

      // Update cooldown active record
      await client.query(`
        UPDATE system_events
        SET event_data = jsonb_set(
          event_data,
          '{end_time}',
          to_jsonb($1::text)
        )
        WHERE event_type = 'COOLDOWN_MODE_ACTIVE'
          AND created_at = (SELECT MAX(created_at) FROM system_events WHERE event_type = 'COOLDOWN_MODE_ACTIVE');
      `, [newEndTime.toISOString()]);

      console.log(`✅ Cooldown extended to ${newEndTime.toISOString()}`);
      console.log(`   New caps: MAX_REPLIES_PER_HOUR=${newMaxReplies}`);

      // Update incident doc
      try {
        execSync('pnpm run cooldown:update-doc', { stdio: 'pipe', timeout: 30000 });
        console.log('✅ Incident doc updated');
      } catch (err: any) {
        console.warn(`⚠️  Failed to update incident doc: ${err.message}`);
      }
    }

    await client.end();
    process.exit(0);

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    await client.end().catch(() => {});
    process.exit(1);
  }
}

checkCooldownEnd();
