/**
 * LEARNING STATE LOGGER
 *
 * Fire-and-forget utility that records whether each learning system
 * is using real data or falling back to defaults.
 *
 * Written to learning_system_state table for dashboard visibility.
 * NEVER throws — all errors are caught and logged as warnings.
 */

import { getSupabaseClient } from '../db';

export async function logLearningState(
  systemName: string,
  mode: 'real_data' | 'fallback_defaults' | 'insufficient_data' | 'mock_data',
  sampleCount: number,
  minRequired: number,
  dataQuality?: Record<string, any>,
  notes?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('learning_system_state').insert({
      system_name: systemName,
      mode,
      sample_count: sampleCount,
      min_required: minRequired,
      qualified_count: sampleCount,
      data_quality: dataQuality || null,
      notes: notes || null,
    });
  } catch (err: any) {
    console.warn(`[LEARNING_STATE_LOG] Failed to log state for ${systemName} (non-fatal): ${err.message}`);
  }
}
