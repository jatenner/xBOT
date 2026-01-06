/**
 * PHASE A: DB Forensics - Find NULL/dev build_sha posts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 PHASE A: DB FORENSICS\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Query 1: Build SHA timeline last 48h
  console.log('1) Build SHA timeline last 48h:\n');
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  
  const { data: timelineData, error: err1 } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('build_sha, posted_at')
    .eq('status', 'posted')
    .gte('posted_at', fortyEightHoursAgo);
  
  if (err1) {
    console.error(`❌ Error: ${err1.message}`);
  } else if (timelineData) {
    const grouped: Record<string, { count: number; first: Date; last: Date }> = {};
    
    for (const row of timelineData) {
      const sha = row.build_sha || 'NULL';
      if (!grouped[sha]) {
        grouped[sha] = { count: 0, first: new Date(row.posted_at), last: new Date(row.posted_at) };
      }
      grouped[sha].count++;
      const postedAt = new Date(row.posted_at);
      if (postedAt < grouped[sha].first) grouped[sha].first = postedAt;
      if (postedAt > grouped[sha].last) grouped[sha].last = postedAt;
    }
    
    console.log('build_sha | cnt | first_seen | last_seen');
    console.log('----------------------------------------');
    for (const [sha, stats] of Object.entries(grouped).sort((a, b) => 
      b[1].last.getTime() - a[1].last.getTime()
    )) {
      console.log(`${sha.padEnd(20)} | ${stats.count.toString().padStart(3)} | ${stats.first.toISOString()} | ${stats.last.toISOString()}`);
    }
  }
  
  console.log('\n');
  
  // Query 2: Fingerprint dev/NULL writers
  console.log('2) Fingerprint dev/NULL writers:\n');
  const { data: fingerprintData, error: err2 } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('build_sha, pipeline_source, job_run_id, posted_at')
    .eq('status', 'posted')
    .gte('posted_at', fortyEightHoursAgo);
  
  if (err2) {
    console.error(`❌ Error: ${err2.message}`);
  } else if (fingerprintData) {
    const filtered = fingerprintData.filter(r => !r.build_sha || r.build_sha === 'dev');
    const grouped: Record<string, Record<string, { count: number; last: Date; jobRunIds: Set<string> }>> = {};
    
    for (const row of filtered) {
      const sha = row.build_sha || 'NULL';
      const source = row.pipeline_source || 'NULL';
      const key = `${sha}|${source}`;
      
      if (!grouped[sha]) grouped[sha] = {};
      if (!grouped[sha][source]) {
        grouped[sha][source] = { count: 0, last: new Date(row.posted_at), jobRunIds: new Set() };
      }
      
      grouped[sha][source].count++;
      const postedAt = new Date(row.posted_at);
      if (postedAt > grouped[sha][source].last) grouped[sha][source].last = postedAt;
      if (row.job_run_id) grouped[sha][source].jobRunIds.add(row.job_run_id);
    }
    
    console.log('build_sha | pipeline_source | cnt | last_seen | job_run_ids');
    console.log('-----------------------------------------------------------');
    for (const [sha, sources] of Object.entries(grouped)) {
      for (const [source, stats] of Object.entries(sources)) {
        const jobIds = Array.from(stats.jobRunIds).slice(0, 5).join(', ');
        console.log(`${sha.padEnd(20)} | ${source.padEnd(30)} | ${stats.count.toString().padStart(3)} | ${stats.last.toISOString()} | ${jobIds || 'NULL'}`);
      }
    }
  }
  
  console.log('\n');
  
  // Query 3: Last 20 posts for NULL/dev with full metadata
  console.log('3) Last 20 posts for NULL/dev with full metadata:\n');
  const { data: recentPosts, error: err3 } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, tweet_id, status, decision_type, pipeline_source, build_sha, job_run_id, posted_at, content')
    .eq('status', 'posted')
    .gte('posted_at', fortyEightHoursAgo)
    .order('posted_at', { ascending: false })
    .limit(100);
  
  if (err3) {
    console.error(`❌ Error: ${err3.message}`);
  } else if (recentPosts) {
    const filtered = recentPosts.filter(r => !r.build_sha || r.build_sha === 'dev').slice(0, 20);
    
    console.log('decision_id | tweet_id | type | pipeline_source | build_sha | job_run_id | posted_at | content_preview');
    console.log('---------------------------------------------------------------------------------------------------');
    for (const row of filtered) {
      const contentPreview = (row.content || '').substring(0, 50).replace(/\n/g, ' ');
      console.log(`${row.decision_id?.substring(0, 8)}... | ${row.tweet_id || 'NULL'} | ${row.decision_type || 'NULL'} | ${(row.pipeline_source || 'NULL').padEnd(30)} | ${row.build_sha || 'NULL'} | ${row.job_run_id || 'NULL'} | ${row.posted_at || 'NULL'} | ${contentPreview}`);
    }
    
    if (filtered.length === 0) {
      console.log('✅ No NULL/dev posts in last 48h');
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════\n');
  
  process.exit(0);
}

main().catch(console.error);

