/**
 * ⏰ HOURLY TICK JOB
 * 
 * Main entry point for hourly rate controller tick
 */

import { executeHourlyTick } from '../rateController/hourlyTick';

export async function hourlyTickJob(): Promise<void> {
  console.log('[HOURLY_TICK_JOB] 🕐 Starting hourly tick job...');
  
  try {
    await executeHourlyTick();
    console.log('[HOURLY_TICK_JOB] ✅ Hourly tick job complete');
  } catch (error: any) {
    console.error(`[HOURLY_TICK_JOB] ❌ Failed: ${error.message}`);
    throw error;
  }
}
