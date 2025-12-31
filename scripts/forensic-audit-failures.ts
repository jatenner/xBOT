#!/usr/bin/env tsx
/**
 * 🔍 FORENSIC AUDIT - Check Recent Failed Posts
 */

import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 FORENSIC AUDIT - RECENT FAILED POSTS (Last 24h)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: failed } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, created_at, updated_at, last_error, status')
    .eq('status', 'failed')
    .gte('created_at', twentyFourHoursAgo)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (failed && failed.length > 0) {
    console.log(`Found ${failed.length} failed decisions:`);
    failed.forEach((f, i) => {
      console.log(`\n${i + 1}. ${f.decision_type} - ${f.decision_id}`);
      console.log(`   Created: ${f.created_at}`);
      console.log(`   Updated: ${f.updated_at}`);
      console.log(`   Error: ${f.last_error || 'no error message'}`);
    });
  } else {
    console.log('No failed decisions in last 24h');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);

