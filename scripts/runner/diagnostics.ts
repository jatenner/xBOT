#!/usr/bin/env tsx
/**
 * 📊 RUNNER DIAGNOSTICS
 * 
 * Prints diagnostic info about opportunities, skip reasons, and candidate queue
 */

import fs from 'fs';
import path from 'path';

// Load .env.local first (preferred), then .env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

async function main() {
  const { getSupabaseClient } = await import('../../src/db');
  const supabase = getSupabaseClient();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 RUNNER DIAGNOSTICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  // 1. Opportunities inserted last 2h
  const { count: oppsLast2h } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', twoHoursAgo);
  
  console.log(`📋 Opportunities inserted last 2h: ${oppsLast2h || 0}\n`);
  
  // 2. Top skip reasons (from system_events if available, or from reply_opportunities if they track it)
  // Note: Skip reasons are currently in harvest output, not in DB
  // For now, check recent opportunities and their status
  const { data: recentOpps } = await supabase
    .from('reply_opportunities')
    .select('status, discovery_method')
    .gte('created_at', twoHoursAgo)
    .limit(100);
  
  const statusCounts: Record<string, number> = {};
  recentOpps?.forEach(opp => {
    const key = opp.status || 'unknown';
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  });
  
  if (Object.keys(statusCounts).length > 0) {
    console.log('📊 Recent opportunities by status:');
    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    console.log('');
  }
  
  // 3. Candidate queue counts last 2h (join with evaluations for metadata)
  const { data: queueItems } = await supabase
    .from('reply_candidate_queue')
    .select('candidate_tweet_id, evaluation_id, created_at')
    .gte('created_at', twoHoursAgo);
  
  let syntheticCount = 0;
  let missingMetadataCount = 0;
  const missingMetadataFields: Record<string, number> = {};
  let validCount = 0;
  
  // Get evaluation IDs to fetch metadata
  const evaluationIds = queueItems?.map(q => q.evaluation_id).filter(Boolean) || [];
  
  if (evaluationIds.length > 0) {
    const { data: evaluations } = await supabase
      .from('candidate_evaluations')
      .select('id, candidate_tweet_id, candidate_author_username, candidate_content')
      .in('id', evaluationIds);
    
    const evalMap = new Map(evaluations?.map(e => [e.id, e]) || []);
    
    queueItems?.forEach(queueItem => {
      const tweetId = queueItem.candidate_tweet_id || '';
      const evaluation = queueItem.evaluation_id ? evalMap.get(queueItem.evaluation_id) : null;
      const authorUsername = evaluation?.candidate_author_username || null;
      const content = evaluation?.candidate_content || null;
      
      // Check for synthetic tweet ID
      if (/^2000000000000000\d{3}$/.test(tweetId)) {
        syntheticCount++;
        return;
      }
      
      // Check for missing metadata
      if (!tweetId || !authorUsername || !content) {
        missingMetadataCount++;
        if (!tweetId) missingMetadataFields['candidate_tweet_id'] = (missingMetadataFields['candidate_tweet_id'] || 0) + 1;
        if (!authorUsername) missingMetadataFields['candidate_author_username'] = (missingMetadataFields['candidate_author_username'] || 0) + 1;
        if (!content) missingMetadataFields['candidate_content'] = (missingMetadataFields['candidate_content'] || 0) + 1;
        return;
      }
      
      validCount++;
    });
  } else {
    validCount = queueItems?.length || 0;
  }
  
  console.log('📋 Candidate queue (last 2h):');
  console.log(`   Total: ${queueItems?.length || 0}`);
  console.log(`   Synthetic: ${syntheticCount}`);
  console.log(`   Missing metadata: ${missingMetadataCount}`);
  if (Object.keys(missingMetadataFields).length > 0) {
    console.log('   Missing fields:');
    Object.entries(missingMetadataFields).forEach(([field, count]) => {
      console.log(`      ${field}: ${count}`);
    });
  }
  console.log(`   Valid: ${validCount}\n`);
  
  // 4. Candidate evaluations counts
  const { count: evalCount } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', twoHoursAgo);
  
  console.log(`📊 Candidate evaluations created last 2h: ${evalCount || 0}\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Diagnostics failed:', error);
  process.exit(1);
});
