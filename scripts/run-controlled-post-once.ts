/**
 * One-shot controlled post runner with lease management
 * Acquires lease, attempts post, handles 429 retries, finalizes/releases lease
 */

import 'dotenv/config';
import { processPostingQueue } from '../src/jobs/postingQueue';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔍 CONTROLLED POST ONE-SHOT RUNNER');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  const controlledDecisionId = process.env.CONTROLLED_DECISION_ID;
  const controlledToken = process.env.CONTROLLED_POST_TOKEN;
  
  if (!controlledDecisionId || !controlledToken) {
    console.error('❌ Missing required env vars:');
    console.error(`   CONTROLLED_DECISION_ID: ${controlledDecisionId || 'NOT SET'}`);
    console.error(`   CONTROLLED_POST_TOKEN: ${controlledToken ? 'SET' : 'NOT SET'}`);
    process.exit(1);
  }
  
  console.log('📋 Environment:');
  console.log(`   Decision ID: ${controlledDecisionId}`);
  console.log(`   Token: ${controlledToken.substring(0, 16)}...`);
  console.log(`   POSTING_ENABLED: ${process.env.POSTING_ENABLED || 'NOT SET'}`);
  console.log(`   DRAIN_QUEUE: ${process.env.DRAIN_QUEUE || 'NOT SET'}`);
  console.log('');
  
  // Generate unique owner ID
  const leaseOwner = `controlled_post_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`🔒 Lease Owner: ${leaseOwner}`);
  console.log('');
  
  // Set lease owner in env so postingQueue can reuse it
  process.env.CONTROLLED_POST_TOKEN_LEASE_OWNER = leaseOwner;
  
  const supabase = getSupabaseClient();
  
  // Acquire lease
  console.log('🔒 STEP 1: Acquiring lease...');
  const { data: leaseAcquired, error: leaseError } = await supabase
    .rpc('acquire_controlled_token', {
      token_value: controlledToken,
      owner_id: leaseOwner,
      ttl_seconds: 600 // 10 minutes
    });
  
  if (leaseError) {
    console.error(`❌ Lease acquisition failed: ${leaseError.message}`);
    process.exit(1);
  }
  
  if (!leaseAcquired) {
    console.error(`❌ Lease unavailable (already held or expired)`);
    process.exit(1);
  }
  
  console.log(`✅ Lease acquired successfully`);
  console.log('');
  
  // Run posting queue
  console.log('🚀 STEP 2: Running postingQueue...');
  let postingSuccess = false;
  let retryCount = 0;
  let finalError: any = null;
  let tweetId: string | null = null;
  
  try {
    await processPostingQueue();
    
    // Check if decision was actually posted
    const { data: decision } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('tweet_id, status')
      .eq('decision_id', controlledDecisionId)
      .single();
    
    if (decision?.status === 'posted' && decision?.tweet_id) {
      postingSuccess = true;
      tweetId = decision.tweet_id;
      console.log(`✅ Posting completed - tweet_id: ${tweetId}`);
    } else {
      console.log(`⚠️  PostingQueue completed but decision not posted (status: ${decision?.status || 'unknown'})`);
      postingSuccess = false;
    }
  } catch (error: any) {
    finalError = error;
    const is429 = error?.message?.includes('HTTP-429') || 
                  error?.message?.includes('code 88') ||
                  error?.message?.includes('rate limit');
    
    console.error(`❌ Posting failed: ${error.message}`);
    console.log(`   Is 429 retryable: ${is429}`);
    
    if (is429) {
      console.log(`   ⚠️  429 error - lease kept for retry`);
      retryCount = 1;
    } else {
      console.log(`   ⚠️  Non-retryable error - releasing lease`);
    }
  }
  
  console.log('');
  
  // Finalize or release lease
  if (postingSuccess) {
    console.log('🔒 STEP 3: Finalizing lease (post succeeded)...');
    const { data: finalized, error: finalizeError } = await supabase
      .rpc('finalize_controlled_token', {
        token_value: controlledToken,
        owner_id: leaseOwner
      });
    
    if (finalizeError || !finalized) {
      console.error(`⚠️  Lease finalization failed: ${finalizeError?.message || 'unknown'}`);
    } else {
      console.log(`✅ Lease finalized`);
    }
  } else if (finalError && !finalError.message?.includes('HTTP-429')) {
    console.log('🔒 STEP 3: Releasing lease (post failed, non-retryable)...');
    const { data: released, error: releaseError } = await supabase
      .rpc('release_controlled_token', {
        token_value: controlledToken,
        owner_id: leaseOwner
      });
    
    if (releaseError || !released) {
      console.error(`⚠️  Lease release failed: ${releaseError?.message || 'unknown'}`);
    } else {
      console.log(`✅ Lease released`);
    }
  } else {
    console.log('🔒 STEP 3: Keeping lease (429 retryable error)...');
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY:');
  console.log(`   Lease acquired: ✅`);
  console.log(`   Posting success: ${postingSuccess ? '✅' : '❌'}`);
  console.log(`   Tweet ID: ${tweetId || 'N/A'}`);
  console.log(`   Retries: ${retryCount}`);
  console.log(`   Final error: ${finalError ? finalError.message : 'None'}`);
  console.log(`   Lease status: ${postingSuccess ? 'Finalized' : (finalError?.message?.includes('HTTP-429') ? 'Kept for retry' : 'Released')}`);
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  process.exit(postingSuccess ? 0 : 1);
}

main().catch(console.error);

