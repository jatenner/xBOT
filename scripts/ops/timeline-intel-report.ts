#!/usr/bin/env tsx
/**
 * 📊 TIMELINE INTELLIGENCE REPORT
 *
 * Shows account strategy health, posting mix, theme distribution, and recommendations.
 *
 * Usage: pnpm tsx scripts/ops/timeline-intel-report.ts
 */

import 'dotenv/config';
import { runTimelineIntelligence } from '../../src/intelligence/timelineIntelligence';

async function main() {
  const report = await runTimelineIntelligence();

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              TIMELINE INTELLIGENCE REPORT                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  console.log(`\n📊 Window: ${report.window_days} days | Posts: ${report.total_posts}`);
  console.log(`🎯 Strategy: ${report.detected_mode} → recommended: ${report.recommended_mode}`);
  console.log(`❤️  Health: ${report.health_score}/100`);

  // Mix
  console.log('\n📈 POSTING MIX:');
  console.log('─'.repeat(50));
  const mixBar = (pct: number, label: string) => {
    const bar = '█'.repeat(Math.round(pct / 3));
    return `  ${label.padEnd(10)} ${String(pct).padStart(3)}% ${bar}`;
  };
  console.log(mixBar(report.mix_pct.replies, 'Replies'));
  console.log(mixBar(report.mix_pct.singles, 'Singles'));
  console.log(mixBar(report.mix_pct.threads, 'Threads'));

  // Target mix
  const target = report.recommendations.target_mix;
  console.log(`\n  Target:    R:${target.replies}% S:${target.singles}% T:${target.threads}%`);

  // Roles
  if (report.roles.length > 0) {
    console.log('\n🎭 POST ROLES:');
    console.log('─'.repeat(50));
    for (const r of report.roles) {
      const bar = '█'.repeat(Math.round(r.pct / 3));
      console.log(`  ${r.role.padEnd(22)} ${String(r.pct).padStart(3)}% (${r.count}) ${bar}`);
    }
    console.log(`  Balance: ${(report.role_balance_score * 100).toFixed(0)}%`);
  }

  // Themes
  if (report.themes.length > 0) {
    console.log('\n📚 THEMES:');
    console.log('─'.repeat(50));
    for (const t of report.themes.slice(0, 6)) {
      const bar = '█'.repeat(Math.round(t.pct / 3));
      console.log(`  ${t.theme.padEnd(20)} ${String(t.pct).padStart(3)}% (${t.count}) ${bar}`);
    }
    console.log(`  Diversity: ${(report.theme_diversity * 100).toFixed(0)}%`);
  }

  // Health
  console.log('\n🏥 HEALTH CHECK:');
  console.log('─'.repeat(50));
  const h = report.health;
  console.log(`  Repetition risk:     ${h.repetition_risk ? '⚠️  YES' : '✅ No'}`);
  console.log(`  Thread overweight:   ${h.thread_overweight ? '⚠️  YES (' + report.mix_pct.threads + '%)' : '✅ No'}`);
  console.log(`  Reply underweight:   ${h.reply_underweight ? '⚠️  YES (' + report.mix_pct.replies + '%)' : '✅ No'}`);
  console.log(`  Missing authority:   ${h.missing_authority ? '⚠️  YES' : '✅ Present'}`);
  console.log(`  Missing practical:   ${h.missing_practical ? '⚠️  YES' : '✅ Present'}`);

  // Recommendations
  if (report.recommendations.notes.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('─'.repeat(50));
    for (const note of report.recommendations.notes) {
      console.log(`  → ${note}`);
    }
  }

  if (report.recommendations.preferred_roles.length > 0) {
    console.log(`\n  Preferred roles: ${report.recommendations.preferred_roles.join(', ')}`);
  }
  if (report.recommendations.avoid_roles.length > 0) {
    console.log(`  Avoid roles: ${report.recommendations.avoid_roles.join(', ')}`);
  }
  if (report.recommendations.preferred_themes.length > 0) {
    console.log(`  Preferred themes: ${report.recommendations.preferred_themes.join(', ')}`);
  }
  if (report.recommendations.avoid_themes.length > 0) {
    console.log(`  Avoid themes: ${report.recommendations.avoid_themes.join(', ')}`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
