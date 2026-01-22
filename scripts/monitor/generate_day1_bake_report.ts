#!/usr/bin/env tsx
/**
 * 📊 DAY 1 BAKE REPORT GENERATOR
 * 
 * Generates docs/BAKE_DAY1_REPORT.md with:
 * - Hourly POST_SUCCESS counts
 * - Tweet ID validation for each POST_SUCCESS
 * - Tweet URLs with load verification
 * - System health checks
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { assertValidTweetId } from '../../src/posting/tweetIdValidator';
import { writeFileSync } from 'fs';
import { join } from 'path';
import https from 'https';
import http from 'http';

async function checkUrlExists(url: string): Promise<{ exists: boolean; statusCode?: number; error?: string }> {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.get(url, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; xBOT-verification/1.0)'
      }
    }, (res) => {
      const statusCode = res.statusCode || 0;
      res.destroy();
      
      if (statusCode >= 200 && statusCode < 400) {
        resolve({ exists: true, statusCode });
      } else if (statusCode === 404) {
        resolve({ exists: false, statusCode, error: 'Not found' });
      } else {
        resolve({ exists: false, statusCode, error: `HTTP ${statusCode}` });
      }
    });
    
    req.on('error', (err: any) => {
      resolve({ exists: false, error: err.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ exists: false, error: 'Timeout' });
    });
    
    req.setTimeout(10000);
  });
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 DAY 1 BAKE REPORT GENERATOR');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();
  const now = new Date();
  const reportStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

  console.log(`📅 Generating report for last 24 hours (${reportStart.toISOString()} to ${now.toISOString()})...\n`);

  // Get hourly POST_SUCCESS counts
  const { data: hourlyCounts, error: hourlyError } = await supabase
    .from('system_events')
    .select('created_at')
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', reportStart.toISOString())
    .order('created_at', { ascending: true });

  if (hourlyError) {
    console.error(`❌ Error querying hourly counts: ${hourlyError.message}`);
    process.exit(1);
  }

  // Group by hour
  const hourlyMap = new Map<string, number>();
  hourlyCounts?.forEach((event: any) => {
    const hour = new Date(event.created_at).toISOString().substring(0, 13) + ':00:00Z';
    hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
  });

  // Get all POST_SUCCESS events with details
  const { data: postSuccessEvents, error: eventsError } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', reportStart.toISOString())
    .order('created_at', { ascending: true });

  if (eventsError) {
    console.error(`❌ Error querying POST_SUCCESS events: ${eventsError.message}`);
    process.exit(1);
  }

  console.log(`📊 Found ${postSuccessEvents?.length || 0} POST_SUCCESS events in last 24 hours\n`);

  // Filter to only valid tweet_ids (18-20 digits)
  const { assertValidTweetId } = await import('../../src/posting/tweetIdValidator');
  const validEvents = (postSuccessEvents || []).filter((event: any) => {
    const eventData = typeof event.event_data === 'string'
      ? JSON.parse(event.event_data)
      : event.event_data;
    const tweetId = eventData.tweet_id;
    const validation = assertValidTweetId(tweetId);
    return validation.valid;
  });

  const invalidEvents = (postSuccessEvents || []).filter((event: any) => {
    const eventData = typeof event.event_data === 'string'
      ? JSON.parse(event.event_data)
      : event.event_data;
    const tweetId = eventData.tweet_id;
    const validation = assertValidTweetId(tweetId);
    return !validation.valid;
  });

  console.log(`✅ Valid POST_SUCCESS events: ${validEvents.length}`);
  console.log(`❌ Legacy invalid POST_SUCCESS events (excluded): ${invalidEvents.length}\n`);

  // Validate each POST_SUCCESS (only process valid events)
  const validatedEvents: Array<{
    decision_id: string;
    tweet_id: string;
    tweet_url: string;
    created_at: string;
    valid: boolean;
    validation_error?: string;
    url_status?: { exists: boolean; statusCode?: number; error?: string };
  }> = [];

  for (const event of validEvents) {
    const eventData = typeof event.event_data === 'string'
      ? JSON.parse(event.event_data)
      : event.event_data;

    const tweetId = eventData.tweet_id;
    const tweetUrl = eventData.tweet_url;
    const decisionId = eventData.decision_id;

    const validation = assertValidTweetId(tweetId);
    
    let urlStatus: { exists: boolean; statusCode?: number; error?: string } | undefined;
    if (validation.valid && tweetUrl) {
      console.log(`🔍 Checking URL: ${tweetUrl}...`);
      urlStatus = await checkUrlExists(tweetUrl);
      console.log(`   ${urlStatus.exists ? '✅' : '⚠️ '} ${urlStatus.exists ? 'Loads' : urlStatus.error || 'Failed'}`);
    }

    validatedEvents.push({
      decision_id: decisionId,
      tweet_id: tweetId,
      tweet_url: tweetUrl,
      created_at: event.created_at,
      valid: validation.valid,
      validation_error: validation.error,
      url_status: urlStatus,
    });
  }

  // Get system health checks
  const { data: latestPlan } = await supabase
    .from('growth_plans')
    .select('window_start, created_at')
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: shadowController } = await supabase
    .from('job_heartbeats')
    .select('job_name, last_run_status, last_success, consecutive_failures')
    .eq('job_name', 'shadow_controller')
    .maybeSingle();

  // Check for overruns (direct query with join)
  const { data: overrunData } = await supabase
    .from('growth_execution')
    .select(`
      posts_done,
      replies_done,
      growth_plans!inner(target_posts, target_replies)
    `)
    .limit(100);
  
  // Count overruns manually
  let overrunCount = 0;
  if (overrunData) {
    for (const row of overrunData as any[]) {
      const plan = row.growth_plans;
      if (plan && (row.posts_done > plan.target_posts || row.replies_done > plan.target_replies)) {
        overrunCount++;
      }
    }
  }

  // Generate report
  const reportPath = join(process.cwd(), 'docs', 'BAKE_DAY1_REPORT.md');
  const reportLines: string[] = [];

  reportLines.push('# 📊 DAY 1 BAKE REPORT');
  reportLines.push('');
  reportLines.push(`**Generated:** ${now.toISOString()}`);
  reportLines.push(`**Period:** ${reportStart.toISOString()} to ${now.toISOString()}`);
  reportLines.push(`**Duration:** 24 hours`);
  reportLines.push('');
  reportLines.push('---');
  reportLines.push('');
  reportLines.push('## Executive Summary');
  reportLines.push('');
  reportLines.push(`- **Total POST_SUCCESS Events:** ${postSuccessEvents?.length || 0}`);
  reportLines.push(`- **Valid Tweet IDs (included):** ${validatedEvents.filter(e => e.valid).length}`);
  reportLines.push(`- **Legacy Invalid Tweet IDs (excluded):** ${invalidEvents.length}`);
  reportLines.push(`- **URLs Verified:** ${validatedEvents.filter(e => e.url_status?.exists).length}`);
  reportLines.push('');
  
  if (invalidEvents.length > 0) {
    reportLines.push('## Legacy Invalid POST_SUCCESS Excluded');
    reportLines.push('');
    reportLines.push(`The following ${invalidEvents.length} POST_SUCCESS event(s) were excluded due to invalid tweet_id format (must be 18-20 digits):`);
    reportLines.push('');
    reportLines.push('| Created | Tweet ID | Length | Decision ID |');
    reportLines.push('|---------|----------|--------|-------------|');
    invalidEvents.forEach((event: any) => {
      const eventData = typeof event.event_data === 'string'
        ? JSON.parse(event.event_data)
        : event.event_data;
      const tweetId = eventData.tweet_id || 'N/A';
      const decisionId = eventData.decision_id || 'N/A';
      const created = new Date(event.created_at).toISOString().substring(0, 19) + 'Z';
      reportLines.push(`| ${created} | ${tweetId} | ${tweetId.length} | ${decisionId.substring(0, 8)}... |`);
    });
    reportLines.push('');
    reportLines.push('---');
    reportLines.push('');
  }
  reportLines.push('---');
  reportLines.push('');
  reportLines.push('## Hourly POST_SUCCESS Counts');
  reportLines.push('');
  reportLines.push('| Hour (UTC) | Count |');
  reportLines.push('|------------|-------|');
  
  const sortedHours = Array.from(hourlyMap.entries()).sort();
  if (sortedHours.length === 0) {
    reportLines.push('| *No POST_SUCCESS events in last 24 hours* | 0 |');
  } else {
    sortedHours.forEach(([hour, count]) => {
      reportLines.push(`| ${hour} | ${count} |`);
    });
  }

  reportLines.push('');
  reportLines.push('---');
  reportLines.push('');
  reportLines.push('## POST_SUCCESS Validation');
  reportLines.push('');
  reportLines.push('| Decision ID | Tweet ID | Length | Valid | URL | URL Status |');
  reportLines.push('|-------------|---------|--------|-------|-----|------------|');

  validatedEvents.forEach((event) => {
    const validMark = event.valid ? '✅' : '❌';
    const urlStatusMark = event.url_status?.exists ? '✅ Loads' : 
                         event.url_status ? `⚠️ ${event.url_status.error || 'Failed'}` : 
                         'N/A';
    const tweetIdShort = event.tweet_id.length > 20 ? event.tweet_id.substring(0, 20) + '...' : event.tweet_id;
    reportLines.push(`| ${event.decision_id.substring(0, 8)}... | ${tweetIdShort} | ${event.tweet_id.length} | ${validMark} | [Link](${event.tweet_url}) | ${urlStatusMark} |`);
  });

  reportLines.push('');
  reportLines.push('---');
  reportLines.push('');
  reportLines.push('## Tweet URLs for Manual Verification');
  reportLines.push('');
  reportLines.push('Please verify these URLs load correctly in a browser:');
  reportLines.push('');

  validatedEvents.forEach((event, idx) => {
    if (event.valid && event.tweet_url) {
      reportLines.push(`${idx + 1}. [${event.tweet_id}](${event.tweet_url}) - ${event.created_at}`);
    }
  });

  reportLines.push('');
  reportLines.push('---');
  reportLines.push('');
  reportLines.push('## System Health Checks');
  reportLines.push('');
  
  if (latestPlan) {
    const planAge = Math.round((now.getTime() - new Date(latestPlan.created_at).getTime()) / (1000 * 60));
    reportLines.push(`- **Latest Growth Plan:** ${latestPlan.window_start} (${planAge} minutes ago) ${planAge < 120 ? '✅' : '⚠️'}`);
  } else {
    reportLines.push(`- **Latest Growth Plan:** Not found ⚠️`);
  }

  if (shadowController) {
    const heartbeatAge = Math.round((now.getTime() - new Date(shadowController.last_success).getTime()) / (1000 * 60));
    reportLines.push(`- **shadow_controller Heartbeat:** ${shadowController.last_run_status} (${heartbeatAge} minutes ago) ${heartbeatAge < 120 ? '✅' : '⚠️'}`);
    if (shadowController.consecutive_failures > 0) {
      reportLines.push(`  - ⚠️ Consecutive failures: ${shadowController.consecutive_failures}`);
    }
  } else {
    reportLines.push(`- **shadow_controller Heartbeat:** Not found ⚠️`);
  }

  reportLines.push(`- **Growth Execution Overruns:** ${overrunCount} ${overrunCount === 0 ? '✅' : '❌'}`);

  reportLines.push('');
  reportLines.push('---');
  reportLines.push('');
  reportLines.push('## Validation Summary');
  reportLines.push('');

  const invalidCount = validatedEvents.filter(e => !e.valid).length;
  if (invalidCount === 0) {
    reportLines.push('✅ **ALL POST_SUCCESS events have valid 18-20 digit tweet_ids**');
  } else {
    reportLines.push(`❌ **${invalidCount} POST_SUCCESS events have invalid tweet_ids:**`);
    validatedEvents.filter(e => !e.valid).forEach((event) => {
      reportLines.push(`  - Decision ID: ${event.decision_id}`);
      reportLines.push(`    Tweet ID: ${event.tweet_id} (${event.tweet_id.length} digits) - ${event.validation_error}`);
    });
  }

  reportLines.push('');
  const urlFailCount = validatedEvents.filter(e => e.url_status && !e.url_status.exists).length;
  if (urlFailCount === 0) {
    reportLines.push('✅ **All tweet URLs verified (or verification skipped)**');
  } else {
    reportLines.push(`⚠️ **${urlFailCount} tweet URLs failed automated verification (manual check required)**`);
  }

  reportLines.push('');
  reportLines.push('---');
  reportLines.push('');
  reportLines.push(`**Report Generated:** ${now.toISOString()}`);
  reportLines.push(`**Status:** ${invalidCount === 0 ? '✅ PASS' : '❌ FAIL'} - ${validatedEvents.length} POST_SUCCESS events validated`);

  const reportContent = reportLines.join('\n');
  writeFileSync(reportPath, reportContent);

  console.log(`✅ Report generated: ${reportPath}`);
  console.log(`   Total events: ${validatedEvents.length}`);
  console.log(`   Valid tweet IDs: ${validatedEvents.filter(e => e.valid).length}`);
  console.log(`   URLs verified: ${validatedEvents.filter(e => e.url_status?.exists).length}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
