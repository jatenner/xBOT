/**
 * 🔍 QUICK DATABASE STATUS CHECK
 * Uses Supabase client (handles SSL properly)
 */

import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env first
dotenv.config({ path: path.join(__dirname, '../.env') });

// Get Supabase client directly (bypass config validation)
function getSupabaseClientDirect() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Get config values directly from env (bypass validation)
function getConfigDirect() {
  return {
    MAX_POSTS_PER_HOUR: process.env.MAX_POSTS_PER_HOUR ? parseFloat(process.env.MAX_POSTS_PER_HOUR) : 2,
    REPLIES_PER_HOUR: process.env.REPLIES_PER_HOUR ? parseInt(process.env.REPLIES_PER_HOUR) : 4,
  };
}

function getModeFlagsDirect() {
  const mode = process.env.MODE || 'live';
  return {
    postingDisabled: mode === 'shadow' || process.env.POSTING_DISABLED === 'true' || process.env.DRY_RUN === 'true'
  };
}

async function quickStatus() {
  console.log('🔍 QUICK SYSTEM STATUS CHECK\n');
  console.log('='.repeat(70));
  
  const supabase = getSupabaseClientDirect();
  const config = getConfigDirect();
  const flags = getModeFlagsDirect();
  
  // Config check
  console.log('1️⃣ CONFIGURATION:');
  console.log(`   Posting enabled: ${!flags.postingDisabled} ${flags.postingDisabled ? '❌' : '✅'}`);
  console.log(`   MAX_POSTS_PER_HOUR: ${config.MAX_POSTS_PER_HOUR ?? 2} ${(config.MAX_POSTS_PER_HOUR ?? 2) >= 2 ? '✅' : '⚠️'}`);
  console.log(`   REPLIES_PER_HOUR: ${config.REPLIES_PER_HOUR ?? 4} ✅`);
  
  // Recent activity (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count: contentLastHour } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo);
  
  const { count: repliesLastHour } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo);
  
  console.log('\n2️⃣ LAST HOUR ACTIVITY:');
  console.log(`   Content posts: ${contentLastHour || 0}/${config.MAX_POSTS_PER_HOUR ?? 2} ${(contentLastHour || 0) >= (config.MAX_POSTS_PER_HOUR ?? 2) ? '⛔ LIMIT' : '✅'}`);
  console.log(`   Replies: ${repliesLastHour || 0}/${config.REPLIES_PER_HOUR ?? 4} ${(repliesLastHour || 0) >= (config.REPLIES_PER_HOUR ?? 4) ? '⛔ LIMIT' : '✅'}`);
  
  // Queue status
  const { count: queuedContent } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread']);
  
  const { count: queuedReplies } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .eq('decision_type', 'reply');
  
  console.log('\n3️⃣ QUEUE STATUS:');
  console.log(`   Queued content: ${queuedContent || 0} ${(queuedContent || 0) > 0 ? '✅' : '⚠️'}`);
  console.log(`   Queued replies: ${queuedReplies || 0} ${(queuedReplies || 0) > 0 ? '✅' : '⚠️'}`);
  
  // Stuck posts
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count: stuckPosts } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posting')
    .lt('created_at', fifteenMinAgo);
  
  console.log('\n4️⃣ SYSTEM HEALTH:');
  console.log(`   Stuck posts: ${stuckPosts || 0} ${(stuckPosts || 0) === 0 ? '✅' : '🚨'}`);
  
  // Last 24h summary
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: content24h } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneDayAgo);
  
  const { count: replies24h } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', oneDayAgo);
  
  console.log('\n5️⃣ LAST 24 HOURS:');
  console.log(`   Content posts: ${content24h || 0}`);
  console.log(`   Replies: ${replies24h || 0}`);
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Status check complete');
}

quickStatus().catch(console.error);

