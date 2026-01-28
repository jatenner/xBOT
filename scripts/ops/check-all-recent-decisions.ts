#!/usr/bin/env tsx
/**
 * Check all recent decisions regardless of time
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  const { data: recentDecisions } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, features, created_at')
    .eq('decision_type', 'reply')
    .order('created_at', { ascending: false })
    .limit(20);
  
  console.log(`Found ${recentDecisions?.length || 0} recent reply decisions:\n`);
  
  const validStrategies = ['insight_punch', 'actionable_checklist', 'myth_correction', 'question_hook'];
  let hasValidStrategy = false;
  
  recentDecisions?.forEach(d => {
    const f = d.features as any || {};
    const strategyId = f.strategy_id || 'unknown';
    const isValid = validStrategies.includes(strategyId);
    if (isValid) hasValidStrategy = true;
    
    console.log(`${isValid ? '✅' : '⚠️ '} ${d.decision_id.substring(0,8)}... | ${d.created_at.substring(0,19)} | strategy=${strategyId} | mode=${f.selection_mode || 'unknown'} | reward=${f.reward !== undefined ? f.reward : 'N/A'}`);
  });
  
  console.log(`\nHas valid strategy: ${hasValidStrategy ? '✅' : '❌'}`);
}

main().catch(console.error);
