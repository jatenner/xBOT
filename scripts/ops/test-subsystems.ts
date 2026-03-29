#!/usr/bin/env tsx
/**
 * Test all subsystems before going live.
 * Verifies each component works without actually posting.
 */
import './load-env';

async function main() {
  console.log('\n  ====  SUBSYSTEM TESTS  ====\n');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<string>) {
    try {
      const result = await fn();
      console.log(`  PASS  ${name}`);
      console.log(`         ${result}`);
      passed++;
    } catch (e: any) {
      console.log(`  FAIL  ${name}`);
      console.log(`         ${e.message}`);
      failed++;
    }
  }

  // 1. Feature extractor
  await test('Content Feature Extractor', async () => {
    const { extractContentFeatures } = await import('../../src/utils/contentFeatureExtractor');
    const f = extractContentFeatures('Most people don\'t know magnesium glycinate crosses the blood-brain barrier 3x faster than oxide.');
    if (!f.word_count) throw new Error('empty features');
    return `words=${f.word_count} numbers=${f.has_numbers} readability=${f.readability}`;
  });

  // 2. Tick advisor
  await test('Tick Advisor', async () => {
    const { getTickAdvice } = await import('../../src/intelligence/tickAdvisor');
    const advice = await getTickAdvice();
    return `confidence=${advice.confidence.toFixed(2)} preferred_angles=[${advice.reply_preferences.preferred_angles.join(',')}] stage=${(advice as any).our_stage || 'unknown'}`;
  });

  // 3. Output enforcer — short reply (should pass)
  await test('Output Enforcer (short reply → approve)', async () => {
    const { enforceReplyConstraints } = await import('../../src/intelligence/outputEnforcer');
    const result = await enforceReplyConstraints('Magnesium glycinate crosses the BBB 3x faster. That\'s the real sleep hack.', null);
    if (!result.approved) throw new Error('should approve: ' + result.violations.join(', '));
    return `approved=true violations=0`;
  });

  // 4. Output enforcer — long reply (should flag)
  await test('Output Enforcer (200 chars → flag)', async () => {
    const { enforceReplyConstraints } = await import('../../src/intelligence/outputEnforcer');
    const longReply = 'A'.repeat(200);
    const result = await enforceReplyConstraints(longReply, { reply_preferences: { ideal_length_range: [60, 100] }, confidence: 0.5 });
    if (result.approved) throw new Error('should flag long reply');
    return `approved=false violations=${result.violations.length} (${result.violations[0]?.substring(0, 60)})`;
  });

  // 5. Content experiment engine
  await test('Content Experiment Engine', async () => {
    const { recommendNextStrategy } = await import('../../src/intelligence/contentExperimentEngine');
    const strategy = await recommendNextStrategy();
    return `${strategy.is_exploration ? 'EXPLORE' : 'EXPLOIT'} angle=${strategy.recommended_angle} tone=${strategy.recommended_tone} format=${strategy.recommended_format}`;
  });

  // 6. Gradual ramp
  await test('Gradual Ramp', async () => {
    const { checkGradualRamp } = await import('../../src/safety/gradualRamp');
    const ramp = await checkGradualRamp();
    return `day=${ramp.dayNumber} actions=${ramp.actionsToday}/${ramp.maxActions} canAct=${ramp.canAct}`;
  });

  // 7. Strategy state
  await test('Strategy State', async () => {
    const { getStrategy } = await import('../../src/strategy/adaptiveStrategy');
    const s = await getStrategy();
    return `gen=${s.generation} replies=${s.target_replies_per_day}/day singles=${s.target_singles_per_day}/day pacing=${s.reply_pacing_minutes}m`;
  });

  // 8. Growth knowledge (seeded)
  await test('Growth Knowledge (seeded)', async () => {
    const { getSupabaseClient } = await import('../../src/db/index');
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('growth_knowledge').select('question, confidence').order('confidence', { ascending: false }).limit(3);
    if (!data || data.length === 0) throw new Error('no knowledge seeded');
    return `${data.length} answers loaded. Top: "${data[0].question}" [${data[0].confidence}]`;
  });

  // 9. External patterns (seeded)
  await test('External Patterns (seeded)', async () => {
    const { getSupabaseClient } = await import('../../src/db/index');
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('external_patterns').select('combo_key, direction, combined_score').eq('direction', 'do_more').order('combined_score', { ascending: false }).limit(3);
    if (!data || data.length === 0) throw new Error('no patterns seeded');
    return `${data.length} "do_more" patterns. Top: ${data[0].combo_key} (score=${data[0].combined_score})`;
  });

  // 10. Stealth modules
  await test('Stealth (fingerprint + humanType)', async () => {
    const { generateSessionFingerprint } = await import('../../src/infra/playwright/stealthConfig');
    const { humanTypeIntoFocused } = await import('../../src/infra/playwright/stealth');
    const fp = generateSessionFingerprint();
    if (typeof humanTypeIntoFocused !== 'function') throw new Error('humanTypeIntoFocused not a function');
    return `Chrome/${fp.chromeVersion} viewport=${fp.viewport.width}x${fp.viewport.height} humanType=ready`;
  });

  // 11. Session cookies
  await test('Session Cookies', async () => {
    const fs = await import('fs');
    const raw = fs.readFileSync('.runner-profile/twitter_session.json', 'utf-8');
    const session = JSON.parse(raw);
    const hasAuth = session.cookies?.some((c: any) => c.name === 'auth_token');
    const hasCt0 = session.cookies?.some((c: any) => c.name === 'ct0');
    if (!hasAuth || !hasCt0) throw new Error('missing critical cookies');
    const stats = fs.statSync('.runner-profile/twitter_session.json');
    const ageMin = Math.round((Date.now() - stats.mtimeMs) / 60000);
    return `${session.cookies.length} cookies, auth_token=YES, ct0=YES, age=${ageMin}m`;
  });

  // 12. Shadow mode off
  await test('Shadow Mode', async () => {
    const { isShadowMode } = await import('../../src/safety/shadowMode');
    if (isShadowMode()) throw new Error('SHADOW MODE IS ON — posting blocked');
    return 'off (live mode)';
  });

  // Summary
  console.log(`\n  ────────────────────────────────────────────────────────`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log(`\n  ALL SUBSYSTEMS OPERATIONAL. Ready to go live.\n`);
  else console.log(`\n  FIX ${failed} failure(s) before going live.\n`);
}

main().catch(err => { console.error('Test crashed:', err); process.exit(1); });
