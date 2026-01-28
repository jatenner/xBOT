#!/usr/bin/env tsx
/**
 * 🔍 E2E RUN: Single PLAN_ONLY Reply Validation
 * 
 * Fetches 1 queued reply_v2_planner decision and validates generation + grounding.
 * Use --commit to actually update the decision.
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local first (same as daemon)
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

import { getSupabaseClient } from '../../src/db/index';
import { ensureReplyContentGeneratedForPlanOnlyDecision } from '../../src/jobs/replySystemV2/planOnlyContentGenerator';

async function main(): Promise<void> {
  const commit = process.argv.includes('--commit');
  const dryRun = !commit;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🔍 E2E RUN: Single PLAN_ONLY Reply Validation');
  console.log(`     Mode: ${dryRun ? 'DRY RUN' : 'COMMIT'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();

  // Fetch most recent queued planner decision
  const { data: decisions, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('pipeline_source', 'reply_v2_planner')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error(`❌ Failed to fetch decisions: ${error.message}`);
    process.exit(1);
  }

  if (!decisions || decisions.length === 0) {
    console.log('⚠️  No queued reply_v2_planner decisions found');
    process.exit(0);
  }

  const decision = decisions[0];
  const decisionId = decision.decision_id;
  const decisionFeatures = (decision.features || {}) as Record<string, any>;

  console.log(`📋 Decision ID: ${decisionId}`);
  console.log(`📅 Created: ${decision.created_at}`);
  console.log(`🎯 Strategy: ${decisionFeatures.strategy_id || 'unknown'}`);
  console.log(`📝 Target Content Snapshot:\n   "${(decisionFeatures.target_tweet_content_snapshot || '').substring(0, 200)}..."`);
  console.log(`📏 Snapshot Length: ${(decisionFeatures.target_tweet_content_snapshot || '').length} chars\n`);

  // Run generation (dry-run: don't persist)
  console.log('🔄 Running generation...\n');
  
  try {
    const generationResult = await ensureReplyContentGeneratedForPlanOnlyDecision(decision);

    if (!generationResult.success) {
      console.error(`❌ Generation failed: ${generationResult.error}`);
      process.exit(1);
    }

    if (!generationResult.content) {
      console.error(`❌ Generated content is empty`);
      process.exit(1);
    }

    const generatedContent = generationResult.content;
    console.log(`✅ Generated content (${generatedContent.length} chars):`);
    console.log(`   "${generatedContent}"\n`);

    // Check grounding: extract terms from snapshot and check overlap
    const snapshot = decisionFeatures.target_tweet_content_snapshot || '';
    const snapshotLower = snapshot.toLowerCase();
    const replyLower = generatedContent.toLowerCase();
    
    // Extract key terms (length > 4, non-stopwords)
    const stopwords = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'were', 'what', 'when', 'where', 'which', 'their', 'there', 'these', 'those']);
    const snapshotTerms = snapshotLower
      .split(/\s+/)
      .filter(w => w.length > 4 && !stopwords.has(w))
      .slice(0, 10);
    
    const matchedTerms = snapshotTerms.filter(term => replyLower.includes(term));
    const groundingScore = matchedTerms.length / Math.max(snapshotTerms.length, 1);

    console.log(`🔍 Grounding Analysis:`);
    console.log(`   Snapshot terms: ${snapshotTerms.slice(0, 5).join(', ')}`);
    console.log(`   Matched terms: ${matchedTerms.slice(0, 5).join(', ')}`);
    console.log(`   Grounding score: ${(groundingScore * 100).toFixed(1)}% (${matchedTerms.length}/${snapshotTerms.length})\n`);

    const passesGrounding = groundingScore >= 0.2 || matchedTerms.length >= 2; // At least 20% overlap or 2+ terms

    if (passesGrounding) {
      console.log(`✅ PASS: Reply is grounded (score: ${(groundingScore * 100).toFixed(1)}%)`);
    } else {
      console.log(`⚠️  WARN: Low grounding score (${(groundingScore * 100).toFixed(1)}%), but content generated`);
    }

    if (dryRun) {
      console.log('\n💡 DRY RUN: Use --commit to update decision in database');
    } else {
      console.log('\n💾 COMMIT MODE: Updating decision...');
      
      const { error: updateError } = await supabase
        .from('content_generation_metadata_comprehensive')
        .update({
          content: generatedContent,
          features: {
            ...decisionFeatures,
            generated_by: 'mac_runner',
            generated_at: new Date().toISOString(),
            grounding_score: groundingScore,
            grounding_matched_terms: matchedTerms,
          },
        })
        .eq('decision_id', decisionId);

      if (updateError) {
        console.error(`❌ Failed to update decision: ${updateError.message}`);
        process.exit(1);
      }

      console.log(`✅ Decision updated: ${decisionId}`);
    }

    process.exit(0);
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
