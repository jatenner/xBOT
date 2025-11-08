/**
 * 🗺️ REPLY SYSTEM MAP DASHBOARD
 * Visual flow diagram showing the entire reply system and health status
 */

import { getSupabaseClient } from '../db/index';

interface ComponentHealth {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  metrics?: Record<string, any>;
  fixSuggestion?: string;
  dependencies?: string[];
}

export async function generateReplySystemMap(): Promise<string> {
  try {
    const components = await checkReplySystemComponents();
    const overallStatus = determineOverallStatus(components);
    
    return generateHTML(components, overallStatus);
  } catch (error: any) {
    console.error('[REPLY_MAP] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

async function checkReplySystemComponents(): Promise<ComponentHealth[]> {
  const supabase = getSupabaseClient();
  const components: ComponentHealth[] = [];
  
  // ============================================================
  // STEP 1: HARVESTER (Find viral tweets to reply to)
  // ============================================================
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const { count: totalOpportunities } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('replied_to', false);
    
    const { count: last24h } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo.toISOString());
    
    const { count: last2h } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twoHoursAgo.toISOString());
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let message = '';
    let fixSuggestion = '';
    
    if (totalOpportunities === 0) {
      status = 'critical';
      message = `🚨 BROKEN: 0 opportunities available. Harvester finding nothing!`;
      fixSuggestion = `1. Run: npx tsx scripts/check-twitter-auth.ts\n2. Check if browser is authenticated\n3. May need to re-login to Twitter`;
    } else if (totalOpportunities < 50) {
      status = 'warning';
      message = `⚠️ LOW: Only ${totalOpportunities} opportunities (need 150-250 for healthy operation)`;
      fixSuggestion = `Harvester is working but finding few opportunities. Check:\n1. Twitter search selectors might be outdated\n2. AI health filter may be too strict`;
    } else if (last2h === 0) {
      status = 'warning';
      message = `⚠️ STALE: ${totalOpportunities} total, but 0 found in last 2 hours`;
      fixSuggestion = `Harvester hasn't run recently. Check:\n1. Job scheduler is running\n2. Browser pool has capacity\n3. Check Railway logs for errors`;
    } else {
      status = 'healthy';
      message = `✅ HEALTHY: ${totalOpportunities} opportunities available, ${last2h} found in last 2h`;
    }
    
    components.push({
      name: '1. Reply Harvester',
      status,
      message,
      fixSuggestion: status !== 'healthy' ? fixSuggestion : undefined,
      metrics: {
        'Available': totalOpportunities || 0,
        'Last 24h': last24h || 0,
        'Last 2h': last2h || 0,
        'Target': '150-250'
      },
      dependencies: ['Browser Auth', 'Twitter Search', 'AI Health Filter']
    });
  } catch (error: any) {
    components.push({
      name: '1. Reply Harvester',
      status: 'critical',
      message: `❌ ERROR: Cannot check status - ${error.message}`,
      fixSuggestion: 'Check database connection',
      dependencies: ['Database']
    });
  }
  
  // ============================================================
  // STEP 2: REPLY GENERATION (Generate reply content)
  // ============================================================
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const { count: repliesGenerated } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .gte('created_at', oneHourAgo.toISOString());
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let message = '';
    let fixSuggestion = '';
    
    if (repliesGenerated === 0) {
      // Check if there are opportunities to reply to
      const { count: availableOpps } = await supabase
        .from('reply_opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('replied_to', false);
      
      if (availableOpps === 0) {
        status = 'warning';
        message = `⚠️ IDLE: No replies generated (waiting for opportunities)`;
        fixSuggestion = 'Not broken - just waiting for harvester to find opportunities';
      } else {
        status = 'critical';
        message = `🚨 BROKEN: ${availableOpps} opportunities available but 0 replies generated in last hour`;
        fixSuggestion = `Reply generation job may be broken. Check:\n1. Reply job is running (every 30min)\n2. Check Railway logs for reply job errors\n3. OpenAI API may be down`;
      }
    } else {
      status = 'healthy';
      message = `✅ HEALTHY: ${repliesGenerated} replies generated in last hour`;
    }
    
    components.push({
      name: '2. Reply Generation',
      status,
      message,
      fixSuggestion: status !== 'healthy' ? fixSuggestion : undefined,
      metrics: {
        'Last hour': repliesGenerated || 0,
        'Expected': '4/hour'
      },
      dependencies: ['Reply Harvester', 'OpenAI API', 'Reply Job']
    });
  } catch (error: any) {
    components.push({
      name: '2. Reply Generation',
      status: 'critical',
      message: `❌ ERROR: ${error.message}`,
      fixSuggestion: 'Check database connection',
      dependencies: ['Database']
    });
  }
  
  // ============================================================
  // STEP 3: REPLY QUEUE (Queued replies waiting to post)
  // ============================================================
  try {
    const { count: queuedReplies } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'queued');
    
    const { data: nextReply } = await supabase
      .from('content_metadata')
      .select('scheduled_at, content')
      .eq('decision_type', 'reply')
      .eq('status', 'queued')
      .order('scheduled_at', { ascending: true })
      .limit(1);
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let message = '';
    
    if (queuedReplies === 0) {
      status = 'warning';
      message = `⚠️ EMPTY: No replies queued for posting`;
    } else {
      status = 'healthy';
      const nextScheduled = nextReply?.[0]?.scheduled_at 
        ? new Date(String(nextReply[0].scheduled_at))
        : null;
      const minutesUntilNext = nextScheduled
        ? Math.floor((nextScheduled.getTime() - Date.now()) / 60000)
        : null;
      
      message = `✅ HEALTHY: ${queuedReplies} replies queued${minutesUntilNext !== null ? `, next in ${minutesUntilNext}min` : ''}`;
    }
    
    components.push({
      name: '3. Reply Queue',
      status,
      message,
      metrics: {
        'Queued': queuedReplies || 0,
        'Next': nextReply?.[0] ? 'Ready' : 'None'
      },
      dependencies: ['Reply Generation']
    });
  } catch (error: any) {
    components.push({
      name: '3. Reply Queue',
      status: 'critical',
      message: `❌ ERROR: ${error.message}`,
      dependencies: ['Database']
    });
  }
  
  // ============================================================
  // STEP 4: POSTING (Actually post replies to Twitter)
  // ============================================================
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const { count: posted24h } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', twentyFourHoursAgo.toISOString());
    
    const { count: postedLastHour } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', oneHourAgo.toISOString());
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let message = '';
    let fixSuggestion = '';
    
    if (posted24h === 0) {
      status = 'critical';
      message = `🚨 BROKEN: 0 replies posted in 24 hours (expected: ~96)`;
      fixSuggestion = `Check entire pipeline:\n1. Are opportunities being harvested?\n2. Are replies being generated?\n3. Is posting queue running?\n4. Check browser authentication`;
    } else if (posted24h < 48) {
      status = 'warning';
      message = `⚠️ LOW: Only ${posted24h} replies in 24h (expected: 96)`;
      fixSuggestion = `System is slow. Check:\n1. Harvester finding enough opportunities?\n2. Rate limiting issues?\n3. Browser pool capacity`;
    } else {
      status = 'healthy';
      message = `✅ HEALTHY: ${posted24h} replies posted in 24h (${postedLastHour} in last hour)`;
    }
    
    components.push({
      name: '4. Reply Posting',
      status,
      message,
      fixSuggestion: status !== 'healthy' ? fixSuggestion : undefined,
      metrics: {
        'Last 24h': posted24h || 0,
        'Last hour': postedLastHour || 0,
        'Expected': '96/day'
      },
      dependencies: ['Reply Queue', 'Browser Pool', 'Posting Queue Job']
    });
  } catch (error: any) {
    components.push({
      name: '4. Reply Posting',
      status: 'critical',
      message: `❌ ERROR: ${error.message}`,
      dependencies: ['Database']
    });
  }
  
  // ============================================================
  // STEP 5: METRICS SCRAPING (Track reply performance)
  // ============================================================
  try {
    const { data: recentReplies } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, actual_likes')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(20);
    
    const repliesWithMetrics = recentReplies?.filter(r => 
      r.actual_likes !== null && r.actual_likes !== undefined
    ).length || 0;
    
    const coverage = recentReplies?.length 
      ? Math.round((repliesWithMetrics / recentReplies.length) * 100)
      : 0;
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let message = '';
    
    if (coverage < 30) {
      status = 'warning';
      message = `⚠️ LOW COVERAGE: Only ${coverage}% of recent replies have metrics`;
    } else {
      status = 'healthy';
      message = `✅ HEALTHY: ${coverage}% of recent replies have metrics (${repliesWithMetrics}/${recentReplies?.length || 0})`;
    }
    
    components.push({
      name: '5. Metrics Scraping',
      status,
      message,
      metrics: {
        'Coverage': `${coverage}%`,
        'Scraped': `${repliesWithMetrics}/${recentReplies?.length || 0}`
      },
      dependencies: ['Reply Posting', 'Metrics Scraper Job', 'Browser Pool']
    });
  } catch (error: any) {
    components.push({
      name: '5. Metrics Scraping',
      status: 'critical',
      message: `❌ ERROR: ${error.message}`,
      dependencies: ['Database']
    });
  }
  
  // ============================================================
  // SUPPORTING SYSTEMS
  // ============================================================
  
  // Browser Authentication
  const harvester = components.find(c => c.name === '1. Reply Harvester');
  if (harvester?.status === 'critical' && harvester.metrics?.['Available'] === 0) {
    components.push({
      name: 'Browser Authentication',
      status: 'critical',
      message: '🚨 LIKELY BROKEN: Harvester finding 0 tweets suggests auth failure',
      fixSuggestion: 'Run: npx tsx scripts/check-twitter-auth.ts',
      dependencies: []
    });
  } else {
    components.push({
      name: 'Browser Authentication',
      status: 'healthy',
      message: '✅ ASSUMED HEALTHY: Harvester is working',
      dependencies: []
    });
  }
  
  // Jobs Scheduler
  components.push({
    name: 'Job Scheduler',
    status: 'healthy',
    message: '✅ RUNNING: Jobs are scheduled (check Railway logs to verify)',
    metrics: {
      'Harvester': 'Every 2h',
      'Reply Gen': 'Every 30min',
      'Posting': 'Every 5min'
    },
    dependencies: []
  });
  
  return components;
}

function determineOverallStatus(components: ComponentHealth[]): 'healthy' | 'degraded' | 'critical' {
  const critical = components.filter(c => c.status === 'critical');
  const warnings = components.filter(c => c.status === 'warning');
  
  if (critical.length > 0) return 'critical';
  if (warnings.length > 1) return 'degraded';
  if (warnings.length === 1) return 'degraded';
  return 'healthy';
}

function generateHTML(components: ComponentHealth[], overallStatus: string): string {
  const statusColor = {
    healthy: '#22c55e',
    degraded: '#eab308',
    critical: '#ef4444'
  }[overallStatus];
  
  const statusEmoji = {
    healthy: '✅',
    degraded: '⚠️',
    critical: '🚨'
  }[overallStatus];
  
  const criticalComponents = components.filter(c => c.status === 'critical');
  const warningComponents = components.filter(c => c.status === 'warning');
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🗺️ Reply System Map - xBOT</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            padding: 20px;
        }
        .container { max-width: 1600px; margin: 0 auto; }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 40px;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border-radius: 20px;
            border: 3px solid ${statusColor};
            box-shadow: 0 0 30px ${statusColor}40;
        }
        
        .status-icon {
            font-size: 72px;
            margin-bottom: 15px;
            animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        .status-text {
            font-size: 32px;
            font-weight: bold;
            color: ${statusColor};
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        
        .status-subtitle {
            font-size: 18px;
            color: #94a3b8;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .summary-card {
            background: #1e293b;
            padding: 24px;
            border-radius: 12px;
            text-align: center;
            border: 2px solid #334155;
        }
        
        .summary-card.critical { border-color: #ef4444; background: #7f1d1d20; }
        .summary-card.warning { border-color: #eab308; background: #78350f20; }
        .summary-card.healthy { border-color: #22c55e; background: #14532d20; }
        
        .summary-number {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .summary-label {
            color: #94a3b8;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .flow-diagram {
            background: #1e293b;
            border-radius: 16px;
            padding: 40px;
            margin-bottom: 40px;
            border: 2px solid #334155;
        }
        
        .flow-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 30px;
            text-align: center;
            color: #3b82f6;
        }
        
        .flow-step {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding: 20px;
            background: #0f172a;
            border-radius: 12px;
            border-left: 6px solid #64748b;
            transition: all 0.3s;
        }
        
        .flow-step:hover {
            transform: translateX(5px);
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        
        .flow-step.healthy { border-left-color: #22c55e; }
        .flow-step.warning { border-left-color: #eab308; }
        .flow-step.critical { border-left-color: #ef4444; }
        
        .flow-number {
            font-size: 36px;
            font-weight: bold;
            color: #475569;
            min-width: 60px;
            text-align: center;
        }
        
        .flow-content {
            flex: 1;
            padding: 0 20px;
        }
        
        .flow-name {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        .flow-message {
            font-size: 16px;
            color: #cbd5e1;
            margin-bottom: 12px;
        }
        
        .flow-metrics {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            margin-top: 12px;
        }
        
        .metric {
            background: #1e293b;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 14px;
            border: 1px solid #334155;
        }
        
        .metric-label {
            color: #94a3b8;
            font-size: 12px;
        }
        
        .metric-value {
            color: #e2e8f0;
            font-weight: bold;
            margin-left: 4px;
        }
        
        .flow-status {
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: bold;
            font-size: 14px;
            text-transform: uppercase;
            white-space: nowrap;
        }
        
        .status-healthy { background: #22c55e; color: white; }
        .status-warning { background: #eab308; color: white; }
        .status-critical { background: #ef4444; color: white; }
        
        .fix-suggestion {
            background: #7f1d1d;
            border: 2px solid #ef4444;
            border-radius: 12px;
            padding: 20px;
            margin-top: 15px;
        }
        
        .fix-title {
            font-size: 16px;
            font-weight: bold;
            color: #fca5a5;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .fix-text {
            color: #fecaca;
            font-size: 14px;
            line-height: 1.6;
            white-space: pre-wrap;
            font-family: 'Courier New', monospace;
        }
        
        .dependencies {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #334155;
        }
        
        .dependencies-label {
            color: #64748b;
            font-size: 12px;
            margin-bottom: 8px;
            text-transform: uppercase;
        }
        
        .dependency-tags {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        
        .dependency-tag {
            background: #334155;
            color: #94a3b8;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
        }
        
        .arrow {
            text-align: center;
            font-size: 32px;
            color: #475569;
            margin: 10px 0;
        }
        
        .section-title {
            font-size: 28px;
            font-weight: bold;
            margin: 40px 0 20px 0;
            padding-bottom: 15px;
            border-bottom: 3px solid #334155;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .refresh-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #3b82f6;
            color: white;
            border: none;
            padding: 18px 28px;
            border-radius: 50px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 6px 25px rgba(59, 130, 246, 0.5);
            transition: all 0.3s;
            z-index: 1000;
        }
        
        .refresh-btn:hover {
            background: #2563eb;
            transform: scale(1.05);
            box-shadow: 0 8px 30px rgba(59, 130, 246, 0.6);
        }
        
        .timestamp {
            text-align: center;
            color: #64748b;
            font-size: 14px;
            margin: 40px 0;
            padding: 20px;
            background: #1e293b;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="status-icon">${statusEmoji}</div>
            <div class="status-text">Reply System: ${overallStatus}</div>
            <div class="status-subtitle">
                ${criticalComponents.length} Critical Issues • ${warningComponents.length} Warnings • ${components.length} Total Components
            </div>
        </div>
        
        <div class="summary">
            <div class="summary-card critical">
                <div class="summary-number" style="color: #ef4444;">${criticalComponents.length}</div>
                <div class="summary-label">🚨 Critical</div>
            </div>
            <div class="summary-card warning">
                <div class="summary-number" style="color: #eab308;">${warningComponents.length}</div>
                <div class="summary-label">⚠️ Warnings</div>
            </div>
            <div class="summary-card healthy">
                <div class="summary-number" style="color: #22c55e;">${components.filter(c => c.status === 'healthy').length}</div>
                <div class="summary-label">✅ Healthy</div>
            </div>
        </div>
        
        <div class="flow-diagram">
            <div class="flow-title">📊 Reply System Flow (Start → Finish)</div>
            
            ${components.slice(0, 5).map((component, index) => `
                ${index > 0 ? '<div class="arrow">↓</div>' : ''}
                <div class="flow-step ${component.status}">
                    <div class="flow-number">${index + 1}</div>
                    <div class="flow-content">
                        <div class="flow-name">${component.name.replace(/^\d+\.\s*/, '')}</div>
                        <div class="flow-message">${component.message}</div>
                        
                        ${component.metrics ? `
                        <div class="flow-metrics">
                            ${Object.entries(component.metrics).map(([key, value]) => `
                                <div class="metric">
                                    <span class="metric-label">${key}:</span>
                                    <span class="metric-value">${value}</span>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                        
                        ${component.fixSuggestion ? `
                        <div class="fix-suggestion">
                            <div class="fix-title">
                                <span>🔧</span>
                                <span>HOW TO FIX:</span>
                            </div>
                            <div class="fix-text">${component.fixSuggestion}</div>
                        </div>
                        ` : ''}
                        
                        ${component.dependencies && component.dependencies.length > 0 ? `
                        <div class="dependencies">
                            <div class="dependencies-label">Depends on:</div>
                            <div class="dependency-tags">
                                ${component.dependencies.map(dep => `
                                    <span class="dependency-tag">${dep}</span>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    <div class="flow-status status-${component.status}">
                        ${component.status}
                    </div>
                </div>
            `).join('')}
        </div>
        
        ${components.length > 5 ? `
        <div class="section-title">🔧 Supporting Systems</div>
        <div class="flow-diagram">
            ${components.slice(5).map(component => `
                <div class="flow-step ${component.status}">
                    <div class="flow-content">
                        <div class="flow-name">${component.name}</div>
                        <div class="flow-message">${component.message}</div>
                        
                        ${component.metrics ? `
                        <div class="flow-metrics">
                            ${Object.entries(component.metrics).map(([key, value]) => `
                                <div class="metric">
                                    <span class="metric-label">${key}:</span>
                                    <span class="metric-value">${value}</span>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                        
                        ${component.fixSuggestion ? `
                        <div class="fix-suggestion">
                            <div class="fix-title">
                                <span>🔧</span>
                                <span>HOW TO FIX:</span>
                            </div>
                            <div class="fix-text">${component.fixSuggestion}</div>
                        </div>
                        ` : ''}
                    </div>
                    <div class="flow-status status-${component.status}">
                        ${component.status}
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="timestamp">
            🕐 Last updated: ${new Date().toLocaleString()}<br>
            Auto-refreshes every 60 seconds
        </div>
    </div>
    
    <button class="refresh-btn" onclick="location.reload()">
        🔄 Refresh
    </button>
    
    <script>
        // Auto-refresh every 60 seconds
        setTimeout(() => location.reload(), 60000);
    </script>
</body>
</html>
  `;
}

function generateErrorHTML(error: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Error - Reply System Map</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #0f172a;
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .error {
            text-align: center;
            padding: 40px;
            background: #1e293b;
            border-radius: 12px;
            max-width: 600px;
            border: 3px solid #ef4444;
        }
    </style>
</head>
<body>
    <div class="error">
        <h1>🚨 Dashboard Error</h1>
        <p>${error}</p>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; font-size: 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">
            🔄 Try Again
        </button>
    </div>
</body>
</html>
  `;
}

