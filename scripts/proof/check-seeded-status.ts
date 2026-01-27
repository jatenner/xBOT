#!/usr/bin/env tsx
/**
 * Check status of seeded decisions for Phase 5A.4 proof
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

const SEEDED_DECISION_IDS = [
  'd7c1e975-7807-4e83-bdc7-497d190d67bb', // post 1
  'bfa218c2-4227-4d27-b363-f38272f65d2a', // post 2
  '31c76781-c373-4386-b6f4-f6a364c80456', // reply
];

async function main(): Promise<void> {
  const supabase = getSupabaseClient();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   🔍 Checking Seeded Decision Statuses');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const transitions: Array<{
    decision_id: string;
    decision_type: string;
    initial_status: string;
    current_status: string;
    created_at: string;
    updated_at: string;
    proof_tag?: string;
  }> = [];
  
  for (const decisionId of SEEDED_DECISION_IDS) {
    const { data, error } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, status, created_at, updated_at, features')
      .eq('decision_id', decisionId)
      .maybeSingle();
    
    if (error) {
      console.error(`❌ Error querying ${decisionId}: ${error.message}`);
      continue;
    }
    
    if (!data) {
      console.warn(`⚠️  Decision not found: ${decisionId}`);
      continue;
    }
    
    const features = typeof data.features === 'string' ? JSON.parse(data.features) : data.features;
    const proofTag = features?.proof_tag || 'N/A';
    
    const hasTransitioned = data.status !== 'queued';
    
    console.log(`📋 Decision: ${decisionId}`);
    console.log(`   Type: ${data.decision_type}`);
    console.log(`   Status: ${data.status} ${hasTransitioned ? '✅ TRANSITIONED' : '⏳ QUEUED'}`);
    console.log(`   Proof Tag: ${proofTag}`);
    console.log(`   Created: ${data.created_at}`);
    console.log(`   Updated: ${data.updated_at}`);
    console.log('');
    
    transitions.push({
      decision_id: decisionId,
      decision_type: data.decision_type,
      initial_status: 'queued',
      current_status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
      proof_tag: proofTag,
    });
  }
  
  const transitionedCount = transitions.filter(t => t.current_status !== 'queued').length;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Summary: ${transitionedCount}/${transitions.length} decisions transitioned`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (transitionedCount > 0) {
    console.log('✅ TRANSITIONS DETECTED:');
    transitions
      .filter(t => t.current_status !== 'queued')
      .forEach(t => {
        console.log(`   ${t.decision_id} (${t.decision_type}): ${t.initial_status} → ${t.current_status}`);
        console.log(`      Updated: ${t.updated_at}`);
      });
  } else {
    console.log('⏳ No transitions yet - all decisions still queued');
  }
  
  process.exit(transitionedCount > 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
