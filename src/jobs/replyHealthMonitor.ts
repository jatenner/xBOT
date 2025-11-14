import { getSupabaseClient } from '../db';

type Severity = 'info' | 'warning' | 'error' | 'critical';

interface OpportunityRow {
  tier?: string | null;
  status?: string | null;
  replied_to?: boolean | null;
  expires_at?: string | null;
  created_at?: string | null;
}

interface ReplyRow {
  status?: string | null;
  created_at?: string | null;
  posted_at?: string | null;
  scheduled_at?: string | null;
}

const MIN_POOL_WARNING = parseInt(process.env.REPLY_POOL_WARNING ?? '40', 10);
const MIN_POOL_CRITICAL = parseInt(process.env.REPLY_POOL_CRITICAL ?? '20', 10);
const STALE_POOL_MINUTES = parseInt(process.env.REPLY_POOL_STALE_MINUTES ?? '120', 10);

const REPLY_SLO_WINDOW_HOURS = parseInt(process.env.REPLY_SLO_WINDOW_HOURS ?? '6', 10);
const REPLY_TARGET_PER_HOUR = parseFloat(process.env.REPLY_TARGET_PER_HOUR ?? '4');
const REPLY_MIN_PER_HOUR = parseFloat(process.env.REPLY_MIN_PER_HOUR ?? '2.5');

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

async function logSystemEvent(
  supabase: ReturnType<typeof getSupabaseClient>,
  event_type: string,
  severity: Severity,
  event_data: Record<string, any>
): Promise<void> {
  const { error } = await supabase.from('system_events').insert({
    event_type,
    severity,
    event_data,
    created_at: new Date().toISOString()
  });

  if (error) {
    console.warn(`[REPLY_HEALTH] ⚠️ Failed to log system event ${event_type}: ${error.message}`);
  }
}

export async function runReplyHealthMonitor(): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date();
  console.log('[REPLY_HEALTH] 🔍 Running reply health monitor...');

  const { data: opportunities, error: poolError } = await supabase
    .from('reply_opportunities')
    .select('tier,status,replied_to,expires_at,created_at');

  if (poolError) {
    console.error('[REPLY_HEALTH] ❌ Failed to fetch reply opportunities:', poolError.message);
    await logSystemEvent(supabase, 'reply_health_error', 'error', {
      issue: 'pool_fetch_failed',
      message: poolError.message
    });
    return;
  }

  const activeOpportunities: OpportunityRow[] = (opportunities ?? []).filter((row) => {
    if (row.replied_to) return false;
    if (row.status && row.status.toLowerCase() === 'replied') return false;
    const expiresAt = parseDate(row.expires_at);
    return !expiresAt || expiresAt.getTime() > now.getTime();
  });

  const poolCount = activeOpportunities.length;
  const staleCutoff = new Date(now.getTime() - STALE_POOL_MINUTES * 60 * 1000);
  const staleCount = activeOpportunities.filter((row) => {
    const created = parseDate(row.created_at);
    return created !== null && created < staleCutoff;
  }).length;

  const tierBreakdown = activeOpportunities.reduce<Record<string, number>>((acc, row) => {
    const key = (row.tier || 'unknown').toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log(
    `[REPLY_HEALTH] 📊 Pool size: ${poolCount} (warning < ${MIN_POOL_WARNING}, critical < ${MIN_POOL_CRITICAL})`
  );
  console.log(`[REPLY_HEALTH] 🧭 Tier breakdown:`, tierBreakdown);
  if (staleCount > 0) {
    console.log(`[REPLY_HEALTH] 🕒 Stale opportunities (> ${STALE_POOL_MINUTES} min): ${staleCount}`);
  }

  if (poolCount < MIN_POOL_CRITICAL) {
    await logSystemEvent(supabase, 'reply_opportunity_pool_low', 'critical', {
      poolCount,
      tierBreakdown,
      staleCount,
      threshold: MIN_POOL_CRITICAL
    });
  } else if (poolCount < MIN_POOL_WARNING) {
    await logSystemEvent(supabase, 'reply_opportunity_pool_low', 'warning', {
      poolCount,
      tierBreakdown,
      staleCount,
      threshold: MIN_POOL_WARNING
    });
  }

  if (staleCount > 0) {
    await logSystemEvent(supabase, 'reply_opportunity_stale', 'warning', {
      staleCount,
      staleMinutes: STALE_POOL_MINUTES,
      poolCount
    });
  }

  const windowStart = new Date(now.getTime() - REPLY_SLO_WINDOW_HOURS * 60 * 60 * 1000);
  const { data: replies, error: repliesError } = await supabase
    .from('content_metadata')
    .select('status,created_at,posted_at,scheduled_at')
    .eq('decision_type', 'reply')
    .gte('created_at', windowStart.toISOString());

  if (repliesError) {
    console.error('[REPLY_HEALTH] ❌ Failed to fetch reply metadata:', repliesError.message);
    await logSystemEvent(supabase, 'reply_health_error', 'error', {
      issue: 'reply_fetch_failed',
      message: repliesError.message
    });
    return;
  }

  const postedReplies = (replies ?? []).filter((row: ReplyRow) => row.status === 'posted');
  const queuedReplies = (replies ?? []).filter((row: ReplyRow) => row.status === 'queued');
  const totalPlanned = postedReplies.length + queuedReplies.length;
  const ratePostedPerHour = postedReplies.length / REPLY_SLO_WINDOW_HOURS;
  const ratePlannedPerHour = totalPlanned / REPLY_SLO_WINDOW_HOURS;

  console.log(
    `[REPLY_HEALTH] 📈 Reply throughput (last ${REPLY_SLO_WINDOW_HOURS}h): ` +
      `${postedReplies.length} posted (${ratePostedPerHour.toFixed(2)}/h), ` +
      `${totalPlanned} queued+posted (${ratePlannedPerHour.toFixed(2)}/h).`
  );

  if (ratePostedPerHour < REPLY_MIN_PER_HOUR) {
    await logSystemEvent(supabase, 'reply_slo_violation', 'critical', {
      windowHours: REPLY_SLO_WINDOW_HOURS,
      postedReplies: postedReplies.length,
      queuedReplies: queuedReplies.length,
      ratePostedPerHour,
      ratePlannedPerHour,
      targetPerHour: REPLY_TARGET_PER_HOUR,
      minimumPerHour: REPLY_MIN_PER_HOUR
    });
  } else if (ratePostedPerHour < REPLY_TARGET_PER_HOUR) {
    await logSystemEvent(supabase, 'reply_slo_warning', 'warning', {
      windowHours: REPLY_SLO_WINDOW_HOURS,
      postedReplies: postedReplies.length,
      queuedReplies: queuedReplies.length,
      ratePostedPerHour,
      ratePlannedPerHour,
      targetPerHour: REPLY_TARGET_PER_HOUR
    });
  }

  const lastReplyPosted = postedReplies
    .map((row) => parseDate(row.posted_at ?? row.created_at ?? row.scheduled_at ?? null))
    .filter((date): date is Date => !!date)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  if (lastReplyPosted) {
    const hoursSince = hoursBetween(lastReplyPosted, now);
    if (hoursSince > 2) {
      await logSystemEvent(supabase, 'reply_gap_detected', 'warning', {
        hoursSinceLastReply: hoursSince,
        lastReplyPostedAt: lastReplyPosted.toISOString()
      });
      console.warn(`[REPLY_HEALTH] ⚠️ No replies posted in ${hoursSince.toFixed(2)} hours.`);
    }
  }

  console.log('[REPLY_HEALTH] ✅ Reply health monitor complete.');
}

export default runReplyHealthMonitor;

