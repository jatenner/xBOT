#!/usr/bin/env tsx
/**
 * THROUGHPUT AUTOTUNE REPORT
 * 
 * Reads last 6h metrics and outputs recommended knob changes
 * based on which stage is bottlenecking.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { getFunnelMetrics } from './reply_funnel_dashboard';

interface KnobRecommendation {
  knob: string;
  current_value: string;
  recommended_value: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

function generateRecommendations(metrics: any): KnobRecommendation[] {
  const recommendations: KnobRecommendation[] = [];
  const rates = metrics.acceptance_rates;
  const bottleneck = metrics.bottleneck_stage;
  
  // Current throughput
  const repliesPerHour = metrics.reply_posted / 6;
  const targetThroughput = 4; // replies/hour
  
  // Analyze bottleneck stage
  if (bottleneck.includes('fetched→evaluated')) {
    // Low fetch completion rate
    if (rates.fetched_to_evaluated < 50) {
      recommendations.push({
        knob: 'REPLY_V2_MAX_EVAL_PER_TICK',
        current_value: 'default (unlimited)',
        recommended_value: 'Increase batch size or reduce timeout',
        reason: `Only ${rates.fetched_to_evaluated.toFixed(1)}% of fetched candidates are evaluated`,
        priority: 'high',
      });
    }
  }
  
  if (bottleneck.includes('evaluated→hardpass')) {
    // Low hard filter pass rate
    if (rates.evaluated_to_hardpass < 30) {
      recommendations.push({
        knob: 'Acceptance threshold',
        current_value: 'check control_plane_state',
        recommended_value: 'Consider lowering by 0.05-0.10',
        reason: `Only ${rates.evaluated_to_hardpass.toFixed(1)}% pass hard filters - may be too strict`,
        priority: 'high',
      });
      
      // Check top reject reasons
      const topReason = metrics.top_reject_reasons[0];
      if (topReason) {
        if (topReason.reason.includes('low_velocity')) {
          recommendations.push({
            knob: 'MIN_LIKES_PER_HOUR threshold',
            current_value: '2',
            recommended_value: '1.5',
            reason: `Top reject: ${topReason.reason} (${topReason.count} candidates)`,
            priority: 'medium',
          });
        } else if (topReason.reason.includes('low_conversation')) {
          recommendations.push({
            knob: 'MIN_REPLY_RATE threshold',
            current_value: '0.01',
            recommended_value: '0.005',
            reason: `Top reject: ${topReason.reason} (${topReason.count} candidates)`,
            priority: 'medium',
          });
        }
      }
    }
  }
  
  if (bottleneck.includes('hardpass→queued')) {
    // Low queue refresh rate
    if (rates.hardpass_to_queued < 50) {
      recommendations.push({
        knob: 'REPLY_V2_MAX_QUEUE_PER_TICK',
        current_value: '25',
        recommended_value: '35-40',
        reason: `Only ${rates.hardpass_to_queued.toFixed(1)}% of passed candidates are queued`,
        priority: 'high',
      });
    }
  }
  
  if (bottleneck.includes('queued→permit')) {
    // Low scheduler activity
    const schedulerTicksPerHour = metrics.scheduler_ticks / 6;
    if (schedulerTicksPerHour < 3) {
      recommendations.push({
        knob: 'REPLY_V2_TICK_SECONDS',
        current_value: '900 (15 min)',
        recommended_value: '600 (10 min)',
        reason: `Only ${schedulerTicksPerHour.toFixed(1)} scheduler ticks/hour - increase frequency`,
        priority: 'high',
      });
    }
  }
  
  if (bottleneck.includes('permit→used')) {
    // Low posting queue processing
    if (rates.permit_to_used < 80) {
      recommendations.push({
        knob: 'POSTING_QUEUE_MAX_ITEMS',
        current_value: 'check postingQueue.ts',
        recommended_value: 'Increase from default',
        reason: `Only ${rates.permit_to_used.toFixed(1)}% of permits are used - posting queue may be slow`,
        priority: 'high',
      });
    }
  }
  
  // General throughput recommendations
  if (repliesPerHour < targetThroughput * 0.5) {
    // Very low throughput - multiple knobs
    if (metrics.queue_size_avg < 10) {
      recommendations.push({
        knob: 'Feed weights (discovered_accounts)',
        current_value: '0.15',
        recommended_value: '0.20',
        reason: `Queue size ${metrics.queue_size_avg.toFixed(1)} < 10 - need more supply`,
        priority: 'high',
      });
    }
    
    if (metrics.scheduler_ticks < 20) {
      recommendations.push({
        knob: 'REPLY_V2_TICK_SECONDS',
        current_value: '900 (15 min)',
        recommended_value: '600 (10 min)',
        reason: `Only ${metrics.scheduler_ticks} scheduler ticks in 6h - increase frequency`,
        priority: 'high',
      });
    }
  }
  
  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

async function main() {
  console.log('=== THROUGHPUT AUTOTUNE REPORT ===\n');
  console.log('Analyzing last 6h metrics...\n');
  
  const metrics = await getFunnelMetrics(6);
  
  // Current state
  const repliesPerHour = metrics.reply_posted / 6;
  const targetThroughput = 4;
  
  console.log('=== CURRENT STATE (6h) ===\n');
  console.log(`Throughput: ${repliesPerHour.toFixed(2)} replies/hour (target: ${targetThroughput}/hour)`);
  console.log(`Bottleneck: ${metrics.bottleneck_stage}`);
  console.log(`Queue size: ${metrics.queue_size_avg.toFixed(1)} avg`);
  console.log(`Scheduler ticks: ${metrics.scheduler_ticks}`);
  console.log(`Permits used: ${metrics.permits_used}`);
  console.log(`Replies posted: ${metrics.reply_posted}`);
  
  // Generate recommendations
  const recommendations = generateRecommendations(metrics);
  
  console.log('\n=== RECOMMENDED KNOB CHANGES ===\n');
  
  if (recommendations.length === 0) {
    console.log('✅ No recommendations - system performing well');
  } else {
    console.log('| Priority | Knob | Current | Recommended | Reason |');
    console.log('|----------|------|---------|-------------|--------|');
    recommendations.forEach(rec => {
      const priorityEmoji = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`| ${priorityEmoji} ${rec.priority} | ${rec.knob} | ${rec.current_value} | ${rec.recommended_value} | ${rec.reason.substring(0, 60)} |`);
    });
    
    console.log('\n=== IMPLEMENTATION ===\n');
    console.log('Set environment variables in Railway:');
    recommendations.forEach(rec => {
      if (rec.knob.startsWith('REPLY_V2_') || rec.knob.startsWith('POSTING_QUEUE_')) {
        console.log(`  ${rec.knob}=${rec.recommended_value.match(/\d+/)?.[0] || 'value'}`);
      }
    });
    
    console.log('\nOr update control_plane_state for acceptance thresholds:');
    console.log('  UPDATE control_plane_state SET acceptance_threshold = 0.55 WHERE expires_at IS NULL;');
  }
  
  // Success criteria check
  console.log('\n=== SUCCESS CRITERIA CHECK ===\n');
  const checks = [
    { name: 'Throughput >= 2/hour', pass: repliesPerHour >= 2, value: `${repliesPerHour.toFixed(2)}/hour` },
    { name: '0 ghosts', pass: metrics.permits_used === metrics.reply_posted, value: `${metrics.permits_used} used = ${metrics.reply_posted} posted` },
    { name: 'Queue size >= 10', pass: metrics.queue_size_avg >= 10, value: `${metrics.queue_size_avg.toFixed(1)}` },
  ];
  
  checks.forEach(check => {
    console.log(`${check.pass ? '✅' : '❌'} ${check.name}: ${check.value}`);
  });
  
  process.exit(0);
}

main();
