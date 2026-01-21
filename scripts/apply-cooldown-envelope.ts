#!/usr/bin/env tsx
/**
 * Apply 12-hour cooldown envelope to reduce posting cadence
 * Sets conservative limits in Railway and logs to system_events
 */

import 'dotenv/config';
import { Client } from 'pg';
import { execSync } from 'child_process';

const COOLDOWN_DURATION_HOURS = 12;

async function applyCooldown() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + COOLDOWN_DURATION_HOURS * 60 * 60 * 1000);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           🧊 APPLYING COOLDOWN ENVELOPE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Get current values
    const currentMaxPosts = parseInt(process.env.MAX_POSTS_PER_HOUR || '2', 10);
    const currentMaxReplies = parseInt(process.env.MAX_REPLIES_PER_HOUR || '6', 10);

    // Cooldown caps
    const cooldownMaxPosts = 2; // Keep at 2 (already conservative)
    const cooldownMaxReplies = 3; // Reduce from 6 to 3
    const cooldownMaxStepPosts = 1; // Keep small
    const cooldownMaxStepReplies = 2; // Keep small

    console.log('Current Envelope:');
    console.log(`   MAX_POSTS_PER_HOUR: ${currentMaxPosts}`);
    console.log(`   MAX_REPLIES_PER_HOUR: ${currentMaxReplies}`);
    console.log('');

    console.log('Cooldown Envelope (12h):');
    console.log(`   MAX_POSTS_PER_HOUR: ${cooldownMaxPosts}`);
    console.log(`   MAX_REPLIES_PER_HOUR: ${cooldownMaxReplies}`);
    console.log(`   GROWTH_CONTROLLER_MAX_STEP_POSTS: ${cooldownMaxStepPosts}`);
    console.log(`   GROWTH_CONTROLLER_MAX_STEP_REPLIES: ${cooldownMaxStepReplies}`);
    console.log('');

    // Apply via Railway CLI
    console.log('📥 Setting Railway environment variables...');
    try {
      execSync(`railway variables --set "MAX_REPLIES_PER_HOUR=${cooldownMaxReplies}"`, { stdio: 'pipe' });
      console.log(`✅ Set MAX_REPLIES_PER_HOUR=${cooldownMaxReplies}`);
      
      execSync(`railway variables --set "GROWTH_CONTROLLER_MAX_STEP_POSTS=${cooldownMaxStepPosts}"`, { stdio: 'pipe' });
      console.log(`✅ Set GROWTH_CONTROLLER_MAX_STEP_POSTS=${cooldownMaxStepPosts}`);
      
      execSync(`railway variables --set "GROWTH_CONTROLLER_MAX_STEP_REPLIES=${cooldownMaxStepReplies}"`, { stdio: 'pipe' });
      console.log(`✅ Set GROWTH_CONTROLLER_MAX_STEP_REPLIES=${cooldownMaxStepReplies}`);
      
      console.log('🔄 Triggering Railway redeploy...');
      execSync('railway redeploy', { stdio: 'pipe', timeout: 30000 });
      console.log('✅ Redeploy triggered');
    } catch (err: any) {
      console.warn(`⚠️  Railway CLI failed: ${err.message}`);
      console.warn('   Manual step: Set variables in Railway Dashboard');
    }

    // Log to system_events
    const reason = 'Resistance signals detected: CONSENT_WALL=6, POST_FAILED=6. Applying 12h cooldown to reduce platform friction.';
    
    await client.query(`
      INSERT INTO system_events (event_type, severity, message, event_data, created_at)
      VALUES ('COOLDOWN_MODE_ACTIVE', 'warning', 'Cooldown envelope activated', $1, $2)
    `, [JSON.stringify({
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_hours: COOLDOWN_DURATION_HOURS,
      caps: {
        max_posts_per_hour: cooldownMaxPosts,
        max_replies_per_hour: cooldownMaxReplies,
        max_step_posts: cooldownMaxStepPosts,
        max_step_replies: cooldownMaxStepReplies
      },
      previous_caps: {
        max_posts_per_hour: currentMaxPosts,
        max_replies_per_hour: currentMaxReplies
      },
      reason
    }), startTime.toISOString()]);

    console.log('');
    console.log('✅ Cooldown envelope applied and logged');
    console.log(`   Start: ${startTime.toISOString()}`);
    console.log(`   End: ${endTime.toISOString()}`);
    console.log('');

    // Schedule automatic revert (create a scheduled event record)
    await client.query(`
      INSERT INTO system_events (event_type, severity, message, event_data, created_at)
      VALUES ('COOLDOWN_MODE_SCHEDULED_END', 'info', 'Cooldown end scheduled', $1, $2)
    `, [JSON.stringify({
      scheduled_end_time: endTime.toISOString(),
      restore_caps: {
        max_posts_per_hour: currentMaxPosts,
        max_replies_per_hour: currentMaxReplies
      }
    }), startTime.toISOString()]);

    console.log('📅 Cooldown end scheduled (will need manual revert or script at end time)');
    console.log('');

    await client.end();
    process.exit(0);

  } catch (err: any) {
    console.error('❌ Error applying cooldown:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    await client.end().catch(() => {});
    process.exit(1);
  }
}

applyCooldown();
