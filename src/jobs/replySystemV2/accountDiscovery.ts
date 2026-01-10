/**
 * 🔍 ACCOUNT DISCOVERY
 * 
 * Discovers new accounts from:
 * 1. Authors of high-performing candidates
 * 2. People frequently replying to curated accounts
 * 
 * Stores in discovered_accounts with performance stats
 */

import { getSupabaseClient } from '../../db/index';

/**
 * Discover accounts from high-performing candidates
 * Called periodically to expand account pool
 */
export async function discoverAccountsFromHighPerformers(): Promise<{
  discovered: number;
  updated: number;
}> {
  const supabase = getSupabaseClient();
  console.log('[ACCOUNT_DISCOVERY] 🔍 Discovering accounts from high-performing candidates...');
  
  let discovered = 0;
  let updated = 0;
  
  // Get high-performing candidates (tier 1-2, passed filters, high overall_score)
  const { data: highPerformers } = await supabase
    .from('candidate_evaluations')
    .select('candidate_author_username, overall_score, predicted_tier, candidate_posted_at')
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 2) // Tier 1-2 only
    .gte('overall_score', 70) // High score threshold
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
    .order('overall_score', { ascending: false })
    .limit(50);
  
  if (!highPerformers || highPerformers.length === 0) {
    console.log('[ACCOUNT_DISCOVERY] ⚠️ No high-performing candidates found');
    return { discovered: 0, updated: 0 };
  }
  
  // Group by author and calculate stats
  const authorStats = new Map<string, {
    count: number;
    avgScore: number;
    maxScore: number;
    latestPost: string;
  }>();
  
  for (const candidate of highPerformers) {
    const username = candidate.candidate_author_username;
    if (!username) continue;
    
    const existing = authorStats.get(username) || {
      count: 0,
      avgScore: 0,
      maxScore: 0,
      latestPost: candidate.candidate_posted_at || '',
    };
    
    existing.count++;
    existing.avgScore = (existing.avgScore * (existing.count - 1) + candidate.overall_score) / existing.count;
    existing.maxScore = Math.max(existing.maxScore, candidate.overall_score);
    if (candidate.candidate_posted_at && candidate.candidate_posted_at > existing.latestPost) {
      existing.latestPost = candidate.candidate_posted_at;
    }
    
    authorStats.set(username, existing);
  }
  
  // Upsert discovered accounts
  for (const [username, stats] of authorStats.entries()) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('discovered_accounts')
      .select('id, priority_score, total_replies_count')
      .eq('username', username)
      .single();
    
    if (existing) {
      // Update priority_score based on performance
      const newPriorityScore = Math.min(100, stats.avgScore); // Use avg score as priority
      const newTotalReplies = (existing.total_replies_count || 0) + stats.count;
      
      await supabase
        .from('discovered_accounts')
        .update({
          priority_score: newPriorityScore,
          total_replies_count: newTotalReplies,
          last_updated: new Date().toISOString(),
        })
        .eq('id', existing.id);
      
      updated++;
    } else {
      // Insert new account
      await supabase
        .from('discovered_accounts')
        .insert({
          username: username,
          priority_score: Math.min(100, stats.avgScore),
          total_replies_count: stats.count,
          discovery_method: 'high_performer',
          discovery_date: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        });
      
      discovered++;
    }
  }
  
  console.log(`[ACCOUNT_DISCOVERY] ✅ Discovered ${discovered} new accounts, updated ${updated} existing`);
  return { discovered, updated };
}

/**
 * Discover accounts from people frequently replying to curated accounts
 */
export async function discoverAccountsFromCuratedReplies(): Promise<{
  discovered: number;
  updated: number;
}> {
  const supabase = getSupabaseClient();
  console.log('[ACCOUNT_DISCOVERY] 🔍 Discovering accounts from curated account replies...');
  
  let discovered = 0;
  let updated = 0;
  
  // Get curated accounts
  const { data: curatedAccounts } = await supabase
    .from('curated_accounts')
    .select('username')
    .eq('enabled', true)
    .limit(20);
  
  if (!curatedAccounts || curatedAccounts.length === 0) {
    console.log('[ACCOUNT_DISCOVERY] ⚠️ No curated accounts found');
    return { discovered: 0, updated: 0 };
  }
  
  // Get recent candidates that are replies to curated accounts
  const curatedUsernames = curatedAccounts.map(a => a.username);
  const { data: curatedReplies } = await supabase
    .from('candidate_evaluations')
    .select('candidate_author_username, overall_score, candidate_content')
    .eq('passed_hard_filters', true)
    .gte('overall_score', 60) // Moderate threshold
    .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()) // Last 3 days
    .in('candidate_author_username', curatedUsernames)
    .limit(100);
  
  // This is a simplified version - in production, we'd need to:
  // 1. Scrape replies to curated account tweets
  // 2. Extract reply authors
  // 3. Score them based on reply quality
  
  // For now, we'll discover accounts that frequently appear in our candidate evaluations
  // as potential reply authors (people who engage with health content)
  const authorCounts = new Map<string, number>();
  
  // Get all recent candidates and count authors
  const { data: allRecentCandidates } = await supabase
    .from('candidate_evaluations')
    .select('candidate_author_username')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(500);
  
  for (const candidate of allRecentCandidates || []) {
    if (!candidate.candidate_author_username) continue;
    const count = authorCounts.get(candidate.candidate_author_username) || 0;
    authorCounts.set(candidate.candidate_author_username, count + 1);
  }
  
  // Discover accounts that appear frequently (potential active health accounts)
  for (const [username, count] of authorCounts.entries()) {
    if (count < 3) continue; // At least 3 appearances
    
    // Skip curated accounts (already known)
    if (curatedUsernames.includes(username)) continue;
    
    // Check if already exists
    const { data: existing } = await supabase
      .from('discovered_accounts')
      .select('id, priority_score')
      .eq('username', username)
      .single();
    
    if (existing) {
      // Update priority based on frequency
      const newPriorityScore = Math.min(100, (existing.priority_score || 0) + 5);
      await supabase
        .from('discovered_accounts')
        .update({
          priority_score: newPriorityScore,
          last_updated: new Date().toISOString(),
        })
        .eq('id', existing.id);
      updated++;
    } else {
      // Insert new account
      await supabase
        .from('discovered_accounts')
        .insert({
          username: username,
          priority_score: Math.min(50, count * 10), // Base priority on frequency
          discovery_method: 'curated_replies',
          discovery_date: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        });
      discovered++;
    }
  }
  
  console.log(`[ACCOUNT_DISCOVERY] ✅ Discovered ${discovered} new accounts from curated replies, updated ${updated} existing`);
  return { discovered, updated };
}

/**
 * Run account discovery (called periodically)
 */
export async function runAccountDiscovery(): Promise<{
  high_performers: { discovered: number; updated: number };
  curated_replies: { discovered: number; updated: number };
}> {
  console.log('[ACCOUNT_DISCOVERY] 🔍 Running account discovery...');
  
  const highPerformers = await discoverAccountsFromHighPerformers();
  const curatedReplies = await discoverAccountsFromCuratedReplies();
  
  return {
    high_performers: highPerformers,
    curated_replies: curatedReplies,
  };
}
