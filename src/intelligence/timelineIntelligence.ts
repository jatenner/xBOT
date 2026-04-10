/**
 * 🧠 TIMELINE INTELLIGENCE — Phase 1
 *
 * Evaluates the account's timeline composition and produces strategic recommendations.
 * Answers: "What kind of account are we building, and is the current mix optimal?"
 *
 * Dimensions:
 *   - Posting mix (reply/single/thread ratios)
 *   - Theme distribution (topics covered)
 *   - Post role classification (authority/practical/contrarian/relatable)
 *   - Timeline health (repetition, gaps, balance)
 *   - Strategy mode detection
 *
 * Consumes: content_generation_metadata_comprehensive, outcomes, growthIntelligence
 * Produces: TimelineReport with recommendations for next 24h
 */

import { getSupabaseClient } from '../db/index';

// ─── Post Roles ───

export type PostRole =
  | 'authority_builder'     // Demonstrates expertise/credibility
  | 'practical_tip'         // Actionable advice someone can use today
  | 'reframe_contrarian'    // Challenges conventional thinking
  | 'relatable_observation' // Human/emotional connection
  | 'deep_dive'             // Thread/long-form education
  | 'engagement_bait'       // Designed purely to drive replies/likes
  | 'reply_growth';         // Reply to another account for visibility

// ─── Strategy Modes ───

export type StrategyMode =
  | 'discovery'       // Maximize reach: reply-heavy, find new audiences
  | 'conversion'      // Turn viewers into followers: authority + practical tips
  | 'authority'       // Establish expertise: deep content, fewer but higher-quality posts
  | 'experimentation'; // Test new formats/topics/archetypes

// ─── Types ───

export interface TimelineReport {
  computed_at: string;
  window_days: number;

  // Current state
  total_posts: number;
  mix: { replies: number; singles: number; threads: number };
  mix_pct: { replies: number; singles: number; threads: number };

  // Theme analysis
  themes: Array<{ theme: string; count: number; pct: number }>;
  theme_diversity: number; // 0-1, higher = more diverse
  dominant_theme: string | null;

  // Role analysis
  roles: Array<{ role: PostRole; count: number; pct: number }>;
  role_balance_score: number; // 0-1, higher = better balanced

  // Timeline health
  health: {
    repetition_risk: boolean;    // Same theme/role >50% of recent posts
    gap_risk: boolean;           // No posts in >6h during active hours
    thread_overweight: boolean;  // Threads >10% of mix (data says they underperform)
    reply_underweight: boolean;  // Replies <50% of mix (replies drive growth)
    missing_authority: boolean;  // No authority-builder posts in last 7 days
    missing_practical: boolean;  // No practical tips in last 7 days
  };
  health_score: number; // 0-100

  // Strategy
  detected_mode: StrategyMode;
  recommended_mode: StrategyMode;

  // Recommendations for next 24h
  recommendations: {
    target_mix: { replies: number; singles: number; threads: number }; // percentage
    preferred_themes: string[];
    avoid_themes: string[];
    preferred_roles: PostRole[];
    avoid_roles: PostRole[];
    notes: string[];
  };
}

// ─── Role Classification ───

function classifyPostRole(post: {
  decision_type: string;
  content?: string;
  topic_cluster?: string;
  angle?: string;
  generator_name?: string;
  features?: any;
}): PostRole {
  if (post.decision_type === 'reply') return 'reply_growth';
  if (post.decision_type === 'thread') return 'deep_dive';

  const content = (post.content || '').toLowerCase();
  const angle = (post.angle || '').toLowerCase();
  const generator = (post.generator_name || '').toLowerCase();

  // Practical tip indicators
  if (content.includes('try ') || content.includes('tip:') || content.includes('hack') ||
      content.includes('step') || angle.includes('practical') || angle.includes('actionable')) {
    return 'practical_tip';
  }

  // Contrarian/reframe indicators
  if (content.includes('actually') || content.includes('myth') || content.includes('wrong') ||
      content.includes('contrary') || angle.includes('contrarian') || angle.includes('reframe')) {
    return 'reframe_contrarian';
  }

  // Relatable indicators
  if (content.includes('i ') || content.includes('my ') || content.includes('we all') ||
      content.includes('anyone else') || angle.includes('relatable')) {
    return 'relatable_observation';
  }

  // Default for singles: authority builder
  return 'authority_builder';
}

// ─── Strategy Mode Detection ───

function detectStrategyMode(mix_pct: { replies: number; singles: number; threads: number }): StrategyMode {
  if (mix_pct.replies >= 60) return 'discovery';
  if (mix_pct.threads >= 20) return 'authority';
  if (mix_pct.singles >= 50) return 'conversion';
  return 'experimentation';
}

function recommendStrategyMode(
  followerCount: number,
  avgViews: number,
  currentMode: StrategyMode
): StrategyMode {
  // Early stage (<100 followers): maximize discovery via replies
  if (followerCount < 100) return 'discovery';
  // Growth stage (100-500): mix of discovery + conversion
  if (followerCount < 500) return avgViews > 200 ? 'conversion' : 'discovery';
  // Established (500+): authority building
  return 'authority';
}

// ─── Main Computation ───

export async function computeTimelineReport(windowDays: number = 7): Promise<TimelineReport> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // Fetch posted content
  const { data: posts } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, content, topic_cluster, angle, generator_name, features, posted_at')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('created_at', since)
    .order('posted_at', { ascending: false });

  const allPosts = posts || [];
  const total = allPosts.length;

  // Mix
  const replies = allPosts.filter(p => p.decision_type === 'reply').length;
  const singles = allPosts.filter(p => p.decision_type === 'single').length;
  const threads = allPosts.filter(p => p.decision_type === 'thread').length;
  const mix_pct = {
    replies: total > 0 ? Math.round((replies / total) * 100) : 0,
    singles: total > 0 ? Math.round((singles / total) * 100) : 0,
    threads: total > 0 ? Math.round((threads / total) * 100) : 0,
  };

  // Themes
  const themeCounts: Record<string, number> = {};
  for (const p of allPosts) {
    const theme = p.topic_cluster || (p.features as any)?.topic || 'untagged';
    themeCounts[theme] = (themeCounts[theme] || 0) + 1;
  }
  const themes = Object.entries(themeCounts)
    .map(([theme, count]) => ({ theme, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
  const uniqueThemes = themes.filter(t => t.theme !== 'untagged').length;
  const theme_diversity = total > 0 ? Math.min(1, uniqueThemes / Math.max(5, total * 0.3)) : 0;

  // Roles
  const roleCounts: Record<PostRole, number> = {
    authority_builder: 0, practical_tip: 0, reframe_contrarian: 0,
    relatable_observation: 0, deep_dive: 0, engagement_bait: 0, reply_growth: 0,
  };
  for (const p of allPosts) {
    const role = classifyPostRole(p);
    roleCounts[role]++;
  }
  const roles = (Object.entries(roleCounts) as [PostRole, number][])
    .map(([role, count]) => ({ role, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count);

  // Role balance: ideal is spread across 3+ roles
  const activeRoles = roles.filter(r => r.pct >= 10).length;
  const role_balance_score = Math.min(1, activeRoles / 4);

  // Health checks
  const dominantTheme = themes[0];
  const health = {
    repetition_risk: dominantTheme ? dominantTheme.pct > 50 : false,
    gap_risk: false, // Would need hourly analysis
    thread_overweight: mix_pct.threads > 10,
    reply_underweight: mix_pct.replies < 50 && total >= 5,
    missing_authority: !roles.find(r => r.role === 'authority_builder' && r.count > 0),
    missing_practical: !roles.find(r => r.role === 'practical_tip' && r.count > 0),
  };

  const healthIssues = Object.values(health).filter(Boolean).length;
  const health_score = Math.max(0, 100 - healthIssues * 15);

  // Strategy
  const detected_mode = detectStrategyMode(mix_pct);
  // Get follower count (approximate from recent data)
  let followerCount = 1; // Default
  const { data: followerData } = await supabase
    .from('follower_snapshots')
    .select('follower_count')
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (followerData?.follower_count) followerCount = followerData.follower_count;

  // Get avg views from GI
  let avgViews = 36; // Default from GI data
  try {
    const { getLatestGrowthSnapshot } = await import('./growthIntelligence');
    const gi = await getLatestGrowthSnapshot();
    if (gi) {
      const singlePerf = gi.by_action_type.find(d => d.value === 'single');
      if (singlePerf) avgViews = singlePerf.avg_views;
    }
  } catch { /* non-blocking */ }

  const recommended_mode = recommendStrategyMode(followerCount, avgViews, detected_mode);

  // Recommendations
  const notes: string[] = [];
  const preferredRoles: PostRole[] = ['reply_growth'];
  const avoidRoles: PostRole[] = [];

  if (recommended_mode === 'discovery') {
    notes.push('Discovery mode: maximize reply volume to find audience. 70%+ replies.');
    preferredRoles.push('practical_tip');
  } else if (recommended_mode === 'conversion') {
    notes.push('Conversion mode: mix authority + practical tips to convert viewers to followers.');
    preferredRoles.push('authority_builder', 'practical_tip');
  }

  if (health.thread_overweight) {
    notes.push('Threads overweight (' + mix_pct.threads + '%). Data shows threads get 23 avg views vs 771 for replies. Reduce threads.');
    avoidRoles.push('deep_dive');
  }
  if (health.reply_underweight) {
    notes.push('Replies underweight (' + mix_pct.replies + '%). Replies drive 21x more views than singles. Increase replies.');
  }
  if (health.repetition_risk) {
    notes.push('Repetition risk: "' + dominantTheme?.theme + '" is ' + dominantTheme?.pct + '% of posts. Diversify topics.');
  }
  if (health.missing_authority && total >= 10) {
    notes.push('No authority-builder posts detected. Add occasional expert takes to build credibility.');
  }
  if (health.missing_practical && total >= 10) {
    notes.push('No practical tip posts detected. Actionable advice converts followers.');
  }

  // Avoid overrepresented themes
  const avoidThemes = themes.filter(t => t.pct > 40 && t.theme !== 'untagged').map(t => t.theme);
  // Prefer underrepresented themes that have performed well
  const preferredThemes = ['health', 'sleep', 'nutrition', 'performance'].filter(t => !avoidThemes.includes(t));

  return {
    computed_at: new Date().toISOString(),
    window_days: windowDays,
    total_posts: total,
    mix: { replies, singles, threads },
    mix_pct,
    themes,
    theme_diversity,
    dominant_theme: dominantTheme?.theme || null,
    roles,
    role_balance_score,
    health,
    health_score,
    detected_mode,
    recommended_mode,
    recommendations: {
      target_mix: recommended_mode === 'discovery'
        ? { replies: 70, singles: 25, threads: 5 }
        : recommended_mode === 'conversion'
        ? { replies: 50, singles: 40, threads: 10 }
        : { replies: 40, singles: 35, threads: 25 },
      preferred_themes: preferredThemes,
      avoid_themes: avoidThemes,
      preferred_roles: preferredRoles,
      avoid_roles: avoidRoles,
      notes,
    },
  };
}

/**
 * Run timeline intelligence and persist + log results.
 */
export async function runTimelineIntelligence(): Promise<TimelineReport> {
  const report = await computeTimelineReport(7);

  console.log(`[TIMELINE_INTEL] ─── Timeline Intelligence Report ───`);
  console.log(`[TIMELINE_INTEL] Posts: ${report.total_posts} | Mix: R:${report.mix_pct.replies}% S:${report.mix_pct.singles}% T:${report.mix_pct.threads}%`);
  console.log(`[TIMELINE_INTEL] Health: ${report.health_score}/100 | Mode: ${report.detected_mode} → recommended: ${report.recommended_mode}`);
  console.log(`[TIMELINE_INTEL] Roles: ${report.roles.map(r => r.role + ':' + r.pct + '%').join(', ')}`);
  console.log(`[TIMELINE_INTEL] Themes: ${report.themes.slice(0, 4).map(t => t.theme + ':' + t.pct + '%').join(', ')} diversity=${report.theme_diversity.toFixed(2)}`);

  if (report.recommendations.notes.length > 0) {
    console.log(`[TIMELINE_INTEL] Recommendations:`);
    for (const note of report.recommendations.notes) {
      console.log(`[TIMELINE_INTEL]   → ${note}`);
    }
  }

  // Persist to system_events
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'TIMELINE_INTELLIGENCE_REPORT',
      severity: 'info',
      message: `Timeline: health=${report.health_score} mode=${report.detected_mode}→${report.recommended_mode} mix=R:${report.mix_pct.replies}/S:${report.mix_pct.singles}/T:${report.mix_pct.threads}`,
      event_data: report,
      created_at: report.computed_at,
    });
  } catch { /* non-blocking */ }

  return report;
}
