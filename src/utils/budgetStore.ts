/**
 * 📊 BUDGET STORE - Daily Navigation and Search Budget Tracking
 * 
 * Tracks daily budgets for navigation and search operations to prevent
 * exceeding quotas and hitting rate limits.
 */

import { getSupabaseClient } from '../db/index';

const DEFAULT_NAV_BUDGET = parseInt(process.env.DAILY_NAV_BUDGET || '20', 10);
const DEFAULT_SEARCH_BUDGET = parseInt(process.env.DAILY_SEARCH_BUDGET || '1', 10);

/**
 * Get today's date key (YYYY-MM-DD)
 */
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current budget counters for today
 */
export async function getBudgets(): Promise<{ navRemaining: number; searchRemaining: number; navUsed: number; searchUsed: number }> {
  const supabase = getSupabaseClient();
  const today = getTodayKey();
  
  const { data, error } = await supabase
    .from('bot_run_counters')
    .select('nav_count, search_count')
    .eq('date', today)
    .single();
  
  if (error) {
    // Table doesn't exist yet - return defaults
    if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
      console.warn(`[BUDGET_STORE] Table bot_run_counters does not exist yet - using defaults. Apply migration: supabase/migrations/20260203_rate_limit_backoff_tables.sql`);
      return { navRemaining: DEFAULT_NAV_BUDGET, searchRemaining: DEFAULT_SEARCH_BUDGET, navUsed: 0, searchUsed: 0 };
    }
    console.error(`[BUDGET_STORE] Failed to get budgets: ${error.message}`);
    return { navRemaining: DEFAULT_NAV_BUDGET, searchRemaining: DEFAULT_SEARCH_BUDGET, navUsed: 0, searchUsed: 0 };
  }
  
  const navUsed = data?.nav_count || 0;
  const searchUsed = data?.search_count || 0;
  
  return {
    navRemaining: Math.max(0, DEFAULT_NAV_BUDGET - navUsed),
    searchRemaining: Math.max(0, DEFAULT_SEARCH_BUDGET - searchUsed),
    navUsed,
    searchUsed,
  };
}

/**
 * Decrement navigation budget (returns true if successful, false if insufficient)
 */
export async function useNavBudget(amount: number = 1): Promise<boolean> {
  const supabase = getSupabaseClient();
  const today = getTodayKey();
  const now = new Date().toISOString();
  
  // Get current count
  const budgets = await getBudgets();
  
  if (budgets.navRemaining < amount) {
    console.log(`[BUDGET_STORE] Insufficient nav budget: ${budgets.navRemaining} < ${amount} (used: ${budgets.navUsed}/${DEFAULT_NAV_BUDGET})`);
    return false;
  }
  
  // Increment counter
  let error: any = null;
  try {
    const rpcResult = await supabase.rpc('increment_budget_counter', {
      p_date: today,
      p_nav_amount: amount,
      p_search_amount: 0,
    });
    error = rpcResult.error;
  } catch (rpcError) {
    // If RPC doesn't exist, use upsert
    const { data: existing } = await supabase
      .from('bot_run_counters')
      .select('nav_count')
      .eq('date', today)
      .single();
    
    const newNavCount = (existing?.nav_count || 0) + amount;
    
    const upsertResult = await supabase
      .from('bot_run_counters')
      .upsert({
        date: today,
        nav_count: newNavCount,
        search_count: existing?.search_count || 0,
        updated_at: now,
      }, {
        onConflict: 'date',
      });
    error = upsertResult.error;
  }
  
  if (error) {
    // Table doesn't exist yet - allow operation but warn
    if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
      console.warn(`[BUDGET_STORE] Table bot_run_counters does not exist - allowing operation. Apply migration: supabase/migrations/20260203_rate_limit_backoff_tables.sql`);
      return true; // Allow operation if table doesn't exist
    }
    console.error(`[BUDGET_STORE] Failed to use nav budget: ${error.message}`);
    return false;
  }
  
  console.log(`[BUDGET_STORE] Used ${amount} nav budget (remaining: ${budgets.navRemaining - amount}/${DEFAULT_NAV_BUDGET})`);
  return true;
}

/**
 * Decrement search budget (returns true if successful, false if insufficient)
 */
export async function useSearchBudget(amount: number = 1): Promise<boolean> {
  const supabase = getSupabaseClient();
  const today = getTodayKey();
  const now = new Date().toISOString();
  
  // Get current count
  const budgets = await getBudgets();
  
  if (budgets.searchRemaining < amount) {
    console.log(`[BUDGET_STORE] Insufficient search budget: ${budgets.searchRemaining} < ${amount} (used: ${budgets.searchUsed}/${DEFAULT_SEARCH_BUDGET})`);
    return false;
  }
  
  // Increment counter
  let error: any = null;
  try {
    const rpcResult = await supabase.rpc('increment_budget_counter', {
      p_date: today,
      p_nav_amount: 0,
      p_search_amount: amount,
    });
    error = rpcResult.error;
  } catch (rpcError) {
    // If RPC doesn't exist, use upsert
    const { data: existing } = await supabase
      .from('bot_run_counters')
      .select('search_count')
      .eq('date', today)
      .single();
    
    const newSearchCount = (existing?.search_count || 0) + amount;
    
    const upsertResult = await supabase
      .from('bot_run_counters')
      .upsert({
        date: today,
        nav_count: existing?.nav_count || 0,
        search_count: newSearchCount,
        updated_at: now,
      }, {
        onConflict: 'date',
      });
    error = upsertResult.error;
  }
  
  if (error) {
    // Table doesn't exist yet - allow operation but warn
    if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
      console.warn(`[BUDGET_STORE] Table bot_run_counters does not exist - allowing operation. Apply migration: supabase/migrations/20260203_rate_limit_backoff_tables.sql`);
      return true; // Allow operation if table doesn't exist
    }
    console.error(`[BUDGET_STORE] Failed to use search budget: ${error.message}`);
    return false;
  }
  
  console.log(`[BUDGET_STORE] Used ${amount} search budget (remaining: ${budgets.searchRemaining - amount}/${DEFAULT_SEARCH_BUDGET})`);
  return true;
}
