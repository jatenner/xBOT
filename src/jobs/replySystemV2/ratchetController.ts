/**
 * 📈 RATCHET CONTROLLER
 * 
 * Weekly ratchet: increase threshold by 10% if success_rate >= 60%
 */

import { getSupabaseClient } from '../../db/index';

const SUCCESS_RATE_THRESHOLD = 60; // 60% success rate required
const RATCHET_PERCENTAGE = 10; // 10% increase

/**
 * Run weekly ratchet analysis and apply if needed
 */
export async function runWeeklyRatchet(): Promise<{
  current_threshold: number;
  new_threshold: number | null;
  success_rate: number;
  ratchet_applied: boolean;
}> {
  console.log('[RATCHET] 📈 Running weekly ratchet analysis...');
  
  const supabase = getSupabaseClient();
  const now = new Date();
  const weekStart = getWeekStart(now);
  
  // Get or create ratchet record for this week
  let { data: ratchet } = await supabase
    .from('reply_ratchet_controller')
    .select('*')
    .eq('week_start_date', weekStart.toISOString().split('T')[0])
    .single();
  
  if (!ratchet) {
    // Get last week's threshold
    const { data: lastWeek } = await supabase
      .from('reply_ratchet_controller')
      .select('current_24h_views_threshold')
      .order('week_start_date', { ascending: false })
      .limit(1)
      .single();
    
    const currentThreshold = lastWeek?.current_24h_views_threshold || 1000;
    
    const { data: newRatchet } = await supabase
      .from('reply_ratchet_controller')
      .insert({
        week_start_date: weekStart.toISOString().split('T')[0],
        current_24h_views_threshold: currentThreshold,
      })
      .select()
      .single();
    
    ratchet = newRatchet;
  }
  
  if (!ratchet) {
    throw new Error('Failed to create/get ratchet record');
  }
  
  // Calculate success rate for this week
  const weekStartTime = new Date(weekStart);
  const weekEndTime = new Date(weekStartTime.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const { data: metrics } = await supabase
    .from('reply_performance_metrics')
    .select('passed_target')
    .gte('posted_at', weekStartTime.toISOString())
    .lt('posted_at', weekEndTime.toISOString())
    .not('views_24h', 'is', null); // Only completed metrics
  
  const totalReplies = metrics?.length || 0;
  const passedThreshold = metrics?.filter(m => m.passed_target === true).length || 0;
  const successRate = totalReplies > 0 ? (passedThreshold / totalReplies) * 100 : 0;
  
  // Update ratchet record
  await supabase
    .from('reply_ratchet_controller')
    .update({
      total_replies: totalReplies,
      passed_threshold: passedThreshold,
      success_rate: successRate,
    })
    .eq('id', ratchet.id);
  
  // Apply ratchet if success rate >= threshold
  let newThreshold: number | null = null;
  let ratchetApplied = false;
  
  if (successRate >= SUCCESS_RATE_THRESHOLD && totalReplies >= 10) {
    // Minimum 10 replies before ratcheting
    newThreshold = Math.round(ratchet.current_24h_views_threshold * (1 + RATCHET_PERCENTAGE / 100));
    
    await supabase
      .from('reply_ratchet_controller')
      .update({
        ratchet_applied: true,
        new_threshold: newThreshold,
        ratchet_reason: `Success rate ${successRate.toFixed(1)}% >= ${SUCCESS_RATE_THRESHOLD}%`,
      })
      .eq('id', ratchet.id);
    
    ratchetApplied = true;
    console.log(`[RATCHET] ✅ Ratchet applied: ${ratchet.current_24h_views_threshold} → ${newThreshold}`);
  } else {
    console.log(`[RATCHET] ⏸️ Ratchet not applied: success_rate=${successRate.toFixed(1)}% (need >=${SUCCESS_RATE_THRESHOLD}%)`);
  }
  
  return {
    current_threshold: ratchet.current_24h_views_threshold,
    new_threshold: newThreshold,
    success_rate: successRate,
    ratchet_applied: ratchetApplied,
  };
}

/**
 * Get start of current week (Monday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  return new Date(d.setDate(diff));
}

