/**
 * 🔧 DEFERRAL HEALER
 * 
 * Auto-heals stuck deferrals to prevent posting stalls:
 * - Expires old deferrals (TTL: 30min cert / 2h normal)
 * - Auto-heals: if decision queued >10min AND permit APPROVED → clear deferral
 * - Logs instrumentation events
 */

import { getSupabaseClient } from '../db/index';

const CERT_MODE_TTL_MINUTES = 30;
const NORMAL_TTL_MINUTES = 120; // 2 hours
const AUTOHEAL_THRESHOLD_MINUTES = 10;

interface DeferralHealResult {
  expired: number;
  autohealed: number;
  events_logged: number;
}

/**
 * Run deferral healing cycle
 */
export async function healDeferrals(certMode: boolean = false): Promise<DeferralHealResult> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const ttlMinutes = certMode ? CERT_MODE_TTL_MINUTES : NORMAL_TTL_MINUTES;
  const ttlAgo = new Date(now.getTime() - ttlMinutes * 60 * 1000);
  const autohealAgo = new Date(now.getTime() - AUTOHEAL_THRESHOLD_MINUTES * 60 * 1000);
  
  const railway_service_name = process.env.RAILWAY_SERVICE_NAME || 'xBOT';
  const git_sha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  
  let expired = 0;
  let autohealed = 0;
  let events_logged = 0;
  
  // 1) EXPIRE OLD DEFERRALS (TTL)
  const { data: expiredDecisions } = await supabase
    .from('content_metadata')
    .select('decision_id, features, scheduled_at, pipeline_source')
    .eq('status', 'queued')
    .lt('scheduled_at', ttlAgo.toISOString())
    .not('features->retry_count', 'is', null);
  
  for (const decision of expiredDecisions || []) {
    const features = (decision.features || {}) as any;
    const retryCount = Number(features?.retry_count || 0);
    
    if (retryCount > 0) {
      // Clear deferral
      const ageMinutes = Math.round((now.getTime() - new Date(decision.scheduled_at).getTime()) / (1000 * 60));
      
      await supabase
        .from('content_metadata')
        .update({
          scheduled_at: now.toISOString(),
          features: {
            ...features,
            retry_count: 0,
            deferral_expired_at: now.toISOString(),
            deferral_age_minutes: ageMinutes,
          }
        })
        .eq('decision_id', decision.decision_id);
      
      // Log event
      await supabase.from('system_events').insert({
        event_type: 'posting_retry_deferred',
        severity: 'info',
        message: `Deferral expired (TTL ${ttlMinutes}min): decision_id=${decision.decision_id}`,
        event_data: {
          decision_id: decision.decision_id,
          permit_id: null, // Will be fetched if needed
          age_minutes: ageMinutes,
          reason: 'ttl_expired',
          cert_mode: certMode,
          service_role: railway_service_name,
          git_sha,
          ttl_minutes: ttlMinutes,
        },
        created_at: now.toISOString(),
      });
      
      expired++;
      events_logged++;
    }
  }
  
  // 2) AUTO-HEAL: Decision queued >10min AND permit APPROVED
  const { data: stuckDecisions } = await supabase
    .from('content_metadata')
    .select('decision_id, features, scheduled_at, pipeline_source, updated_at')
    .eq('status', 'queued')
    .lt('updated_at', autohealAgo.toISOString())
    .not('features->retry_count', 'is', null);
  
  for (const decision of stuckDecisions || []) {
    const features = (decision.features || {}) as any;
    const retryCount = Number(features?.retry_count || 0);
    
    if (retryCount > 0) {
      // Check if permit exists and is APPROVED
      const { data: permit } = await supabase
        .from('post_attempts')
        .select('permit_id, status')
        .eq('decision_id', decision.decision_id)
        .eq('status', 'APPROVED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (permit) {
        // Auto-heal: clear deferral
        const ageMinutes = Math.round((now.getTime() - new Date(decision.updated_at).getTime()) / (1000 * 60));
        
        await supabase
          .from('content_metadata')
          .update({
            scheduled_at: now.toISOString(),
            features: {
              ...features,
              retry_count: 0,
              autohealed_at: now.toISOString(),
              autoheal_age_minutes: ageMinutes,
            }
          })
          .eq('decision_id', decision.decision_id);
        
        // Log event
        await supabase.from('system_events').insert({
          event_type: 'posting_retry_cleared',
          severity: 'info',
          message: `Auto-healed deferral: decision_id=${decision.decision_id} permit_id=${permit.permit_id}`,
          event_data: {
            decision_id: decision.decision_id,
            permit_id: permit.permit_id,
            age_minutes: ageMinutes,
            reason: 'autoheal_permit_approved',
            cert_mode: certMode,
            service_role: railway_service_name,
            git_sha,
          },
          created_at: now.toISOString(),
        });
        
        // Log force run event
        await supabase.from('system_events').insert({
          event_type: 'posting_retry_force_run',
          severity: 'info',
          message: `Force re-enqueued after auto-heal: decision_id=${decision.decision_id}`,
          event_data: {
            decision_id: decision.decision_id,
            permit_id: permit.permit_id,
            age_minutes: ageMinutes,
            reason: 'autoheal_force_run',
            cert_mode: certMode,
            service_role: railway_service_name,
            git_sha,
          },
          created_at: now.toISOString(),
        });
        
        autohealed++;
        events_logged += 2;
      }
    }
  }
  
  if (expired > 0 || autohealed > 0) {
    console.log(`[DEFERRAL_HEALER] ✅ Healed ${expired} expired + ${autohealed} auto-healed deferrals (${events_logged} events)`);
  }
  
  return { expired, autohealed, events_logged };
}

/**
 * Check deferral age and log if deferred
 */
export async function logDeferral(decisionId: string, permitId: string | null, reason: string, certMode: boolean = false): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: decision } = await supabase
    .from('content_metadata')
    .select('features, scheduled_at, updated_at')
    .eq('decision_id', decisionId)
    .maybeSingle();
  
  if (!decision) return;
  
  const features = (decision.features || {}) as any;
  const retryCount = Number(features?.retry_count || 0);
  const scheduledTs = new Date(decision.scheduled_at).getTime();
  const nowTs = Date.now();
  const ageMinutes = retryCount > 0 && scheduledTs > nowTs 
    ? Math.round((scheduledTs - nowTs) / (1000 * 60))
    : 0;
  
  const railway_service_name = process.env.RAILWAY_SERVICE_NAME || 'xBOT';
  const git_sha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  
  await supabase.from('system_events').insert({
    event_type: 'posting_retry_deferred',
    severity: 'info',
    message: `Deferral created: decision_id=${decisionId} reason=${reason}`,
    event_data: {
      decision_id: decisionId,
      permit_id: permitId,
      age_minutes: ageMinutes,
      reason,
      cert_mode: certMode,
      service_role: railway_service_name,
      git_sha,
      retry_count: retryCount,
    },
    created_at: new Date().toISOString(),
  });
}

