/**
 * 📊 ENHANCED ERROR TRACKER
 * Centralized error tracking and analysis for system improvements
 */

import { getSupabaseClient } from '../db/index';

export interface ErrorEvent {
  component: string;
  errorType: string;
  errorMessage: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class ErrorTracker {
  private static instance: ErrorTracker;
  private errorCounts: Map<string, number> = new Map();
  private recentErrors: ErrorEvent[] = [];

  private constructor() {}

  public static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  /**
   * Track error to system_events table
   */
  async trackError(event: ErrorEvent): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      // Track error frequency
      const errorKey = `${event.component}:${event.errorType}`;
      const currentCount = this.errorCounts.get(errorKey) || 0;
      this.errorCounts.set(errorKey, currentCount + 1);
      
      // Store recent errors (last 100)
      this.recentErrors.push(event);
      if (this.recentErrors.length > 100) {
        this.recentErrors.shift();
      }
      
      // Log to system_events table
      const { error } = await supabase.from('system_events').insert({
        event_type: `error_${event.errorType}`,
        severity: event.severity,
        event_data: {
          component: event.component,
          error_type: event.errorType,
          error_message: event.errorMessage,
          context: event.context || {},
          metadata: event.metadata || {},
          frequency: currentCount + 1
        },
        created_at: new Date().toISOString()
      });
      
      if (error) {
        console.error(`[ERROR_TRACKER] Failed to log error: ${error.message}`);
      } else {
        console.log(`[ERROR_TRACKER] ✅ Error tracked: ${event.component}/${event.errorType}`);
      }
      
      // Alert on critical errors
      if (event.severity === 'critical') {
        await this.alertCriticalError(event);
      }
      
      // Alert on error spikes
      if (currentCount + 1 >= 5 && (currentCount + 1) % 5 === 0) {
        await this.alertErrorSpike(errorKey, currentCount + 1);
      }
      
    } catch (error: any) {
      console.error(`[ERROR_TRACKER] Failed to track error: ${error.message}`);
    }
  }

  /**
   * Get error frequency statistics
   */
  async getErrorFrequency(hours: number = 24): Promise<Array<{ errorKey: string; count: number; severity: string }>> {
    try {
      const supabase = getSupabaseClient();
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('system_events')
        .select('event_type, severity, event_data')
        .gte('created_at', since)
        .like('event_type', 'error_%');
      
      if (error) {
        console.error(`[ERROR_TRACKER] Failed to get error frequency: ${error.message}`);
        return [];
      }
      
      // Aggregate by component:errorType
      const frequencyMap = new Map<string, { count: number; severity: string }>();
      
      (data || []).forEach((event: any) => {
        const component = event.event_data?.component || 'unknown';
        const errorType = event.event_data?.error_type || 'unknown';
        const errorKey = `${component}:${errorType}`;
        const severity = event.severity || 'error';
        
        const current = frequencyMap.get(errorKey) || { count: 0, severity };
        frequencyMap.set(errorKey, {
          count: current.count + 1,
          severity: severity === 'critical' ? severity : current.severity
        });
      });
      
      return Array.from(frequencyMap.entries()).map(([errorKey, data]) => ({
        errorKey,
        count: data.count,
        severity: data.severity
      })).sort((a, b) => b.count - a.count);
      
    } catch (error: any) {
      console.error(`[ERROR_TRACKER] Failed to get error frequency: ${error.message}`);
      return [];
    }
  }

  /**
   * Get most common errors
   */
  getMostCommonErrors(limit: number = 10): Array<{ errorKey: string; count: number }> {
    return Array.from(this.errorCounts.entries())
      .map(([errorKey, count]) => ({ errorKey, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Alert on critical errors
   */
  private async alertCriticalError(event: ErrorEvent): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      await supabase.from('system_events').insert({
        event_type: 'critical_error_alert',
        severity: 'critical',
        event_data: {
          component: event.component,
          error_type: event.errorType,
          error_message: event.errorMessage,
          alert_time: new Date().toISOString(),
          requires_attention: true
        },
        created_at: new Date().toISOString()
      });
      
      console.error(`[ERROR_TRACKER] 🚨 CRITICAL ERROR ALERT: ${event.component}/${event.errorType}`);
      console.error(`[ERROR_TRACKER] Message: ${event.errorMessage}`);
      
    } catch (error: any) {
      console.error(`[ERROR_TRACKER] Failed to alert critical error: ${error.message}`);
    }
  }

  /**
   * Alert on error spikes
   */
  private async alertErrorSpike(errorKey: string, count: number): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      await supabase.from('system_events').insert({
        event_type: 'error_spike_alert',
        severity: 'warning',
        event_data: {
          error_key: errorKey,
          error_count: count,
          alert_time: new Date().toISOString(),
          requires_investigation: true
        },
        created_at: new Date().toISOString()
      });
      
      console.warn(`[ERROR_TRACKER] ⚠️ ERROR SPIKE: ${errorKey} has occurred ${count} times`);
      
    } catch (error: any) {
      console.error(`[ERROR_TRACKER] Failed to alert error spike: ${error.message}`);
    }
  }

  /**
   * Get error recovery metrics
   */
  async getRecoveryMetrics(): Promise<{
    totalErrors: number;
    recoveredErrors: number;
    recoveryRate: number;
    averageRecoveryTime: number;
  }> {
    try {
      const supabase = getSupabaseClient();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data } = await supabase
        .from('system_events')
        .select('event_type, event_data, created_at')
        .gte('created_at', oneDayAgo)
        .like('event_type', 'error_%');
      
      const totalErrors = (data || []).length;
      const recoveredErrors = (data || []).filter((e: any) => 
        e.event_data?.recovered === true
      ).length;
      
      const recoveryRate = totalErrors > 0 ? (recoveredErrors / totalErrors) * 100 : 100;
      
      // Calculate average recovery time (if available in event_data)
      const recoveryTimes = (data || [])
        .filter((e: any) => e.event_data?.recovery_time_ms)
        .map((e: any) => e.event_data.recovery_time_ms);
      
      const averageRecoveryTime = recoveryTimes.length > 0
        ? recoveryTimes.reduce((a: number, b: number) => a + b, 0) / recoveryTimes.length
        : 0;
      
      return {
        totalErrors,
        recoveredErrors,
        recoveryRate,
        averageRecoveryTime
      };
      
    } catch (error: any) {
      console.error(`[ERROR_TRACKER] Failed to get recovery metrics: ${error.message}`);
      return {
        totalErrors: 0,
        recoveredErrors: 0,
        recoveryRate: 0,
        averageRecoveryTime: 0
      };
    }
  }
}

/**
 * Helper function to track errors easily
 */
export async function trackError(
  component: string,
  errorType: string,
  errorMessage: string,
  severity: 'critical' | 'error' | 'warning' | 'info' = 'error',
  context?: Record<string, any>
): Promise<void> {
  const tracker = ErrorTracker.getInstance();
  await tracker.trackError({
    component,
    errorType,
    errorMessage,
    severity,
    context
  });
}



