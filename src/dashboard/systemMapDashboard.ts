/**
 * 🗺️ SYSTEM MAP DASHBOARD
 * Visual map showing all systems, their connections, and what's broken
 */

import { getSupabaseClient } from '../db/index';

interface SystemStatus {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  metrics?: any;
  dependencies?: string[];
}

export async function generateSystemMapDashboard(): Promise<string> {
  try {
    const systems = await checkAllSystems();
    const brokenSystems = systems.filter(s => s.status === 'critical');
    const warningSystems = systems.filter(s => s.status === 'warning');
    
    return generateMapHTML(systems, brokenSystems, warningSystems);
  } catch (error: any) {
    console.error('[SYSTEM_MAP] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

async function checkAllSystems(): Promise<SystemStatus[]> {
  const supabase = getSupabaseClient();
  const results: SystemStatus[] = [];
  
  // 1. REPLY HARVESTER CHECK
  try {
    const { count: opportunities } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('replied_to', false);
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: last24h } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo.toISOString());
    
    results.push({
      name: 'Reply Harvester',
      status: opportunities === 0 ? 'critical' : opportunities < 50 ? 'warning' : 'healthy',
      message: opportunities === 0 
        ? `🚨 BROKEN: Finding 0 opportunities (needs ${last24h || 0} in last 24h)`
        : opportunities < 50
        ? `⚠️ LOW: Only ${opportunities} opportunities available`
        : `✅ HEALTHY: ${opportunities} opportunities ready`,
      metrics: { available: opportunities, last24h: last24h || 0 },
      dependencies: ['Browser Authentication', 'Twitter Search']
    });
  } catch (error: any) {
    results.push({
      name: 'Reply Harvester',
      status: 'critical',
      message: `❌ ERROR: ${error.message}`,
      dependencies: ['Database']
    });
  }
  
  // 2. REPLY POSTING CHECK
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: repliesPosted } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .gte('created_at', twentyFourHoursAgo.toISOString());
    
    results.push({
      name: 'Reply Posting',
      status: repliesPosted === 0 ? 'critical' : repliesPosted < 48 ? 'warning' : 'healthy',
      message: repliesPosted === 0
        ? '🚨 BROKEN: 0 replies posted in 24h (expected: 96)'
        : repliesPosted < 48
        ? `⚠️ LOW: Only ${repliesPosted} replies in 24h (expected: 96)`
        : `✅ HEALTHY: ${repliesPosted} replies posted in 24h`,
      metrics: { posted24h: repliesPosted || 0, expected: 96 },
      dependencies: ['Reply Harvester', 'Reply Queue', 'Browser Posting']
    });
  } catch (error: any) {
    results.push({
      name: 'Reply Posting',
      status: 'unknown',
      message: `❓ Cannot check: ${error.message}`,
      dependencies: ['Database']
    });
  }
  
  // 3. CONTENT GENERATION CHECK
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { count: recentContent } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'single')
      .gte('created_at', oneHourAgo.toISOString());
    
    results.push({
      name: 'Content Generation',
      status: recentContent === 0 ? 'warning' : 'healthy',
      message: recentContent === 0
        ? '⚠️ STALE: No content generated in last hour'
        : `✅ HEALTHY: ${recentContent} posts generated in last hour`,
      metrics: { lastHour: recentContent || 0 },
      dependencies: ['OpenAI API', 'Plan Job']
    });
  } catch (error: any) {
    results.push({
      name: 'Content Generation',
      status: 'unknown',
      message: `❓ Cannot check: ${error.message}`,
      dependencies: ['Database']
    });
  }
  
  // 4. POSTING QUEUE CHECK
  try {
    const { count: queuedContent } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');
    
    results.push({
      name: 'Posting Queue',
      status: queuedContent === 0 ? 'warning' : 'healthy',
      message: queuedContent === 0
        ? '⚠️ EMPTY: No content queued for posting'
        : `✅ HEALTHY: ${queuedContent} items queued`,
      metrics: { queued: queuedContent || 0 },
      dependencies: ['Content Generation']
    });
  } catch (error: any) {
    results.push({
      name: 'Posting Queue',
      status: 'unknown',
      message: `❓ Cannot check: ${error.message}`,
      dependencies: ['Database']
    });
  }
  
  // 5. METRICS SCRAPING CHECK
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { data: recentOutcomes } = await supabase
      .from('outcomes')
      .select('collected_at')
      .order('collected_at', { ascending: false })
      .limit(1);
    
    const lastScrape = recentOutcomes?.[0]?.collected_at 
      ? new Date(recentOutcomes[0].collected_at)
      : null;
    
    const minutesSince = lastScrape 
      ? Math.floor((Date.now() - lastScrape.getTime()) / 60000)
      : 999;
    
    results.push({
      name: 'Metrics Scraper',
      status: minutesSince > 60 ? 'warning' : 'healthy',
      message: minutesSince > 60
        ? `⚠️ STALE: Last scraped ${minutesSince}min ago`
        : `✅ HEALTHY: Last scraped ${minutesSince}min ago`,
      metrics: { minutesSinceLastScrape: minutesSince },
      dependencies: ['Browser Pool', 'Posted Content']
    });
  } catch (error: any) {
    results.push({
      name: 'Metrics Scraper',
      status: 'unknown',
      message: `❓ Cannot check: ${error.message}`,
      dependencies: ['Database']
    });
  }
  
  // 6. DATABASE CHECK
  try {
    const { data, error } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .limit(1);
    
    results.push({
      name: 'Database',
      status: error ? 'critical' : 'healthy',
      message: error ? `🚨 ERROR: ${error.message}` : '✅ HEALTHY: Database connected',
      dependencies: []
    });
  } catch (error: any) {
    results.push({
      name: 'Database',
      status: 'critical',
      message: `🚨 CANNOT CONNECT: ${error.message}`,
      dependencies: []
    });
  }
  
  // 7. BROWSER AUTHENTICATION CHECK
  // This is inferred - if harvester is broken, likely auth issue
  const harvester = results.find(r => r.name === 'Reply Harvester');
  if (harvester?.status === 'critical') {
    results.push({
      name: 'Browser Authentication',
      status: 'critical',
      message: '🚨 LIKELY BROKEN: Harvester finding 0 tweets (auth expired?)',
      dependencies: ['Browser Pool']
    });
  } else {
    results.push({
      name: 'Browser Authentication',
      status: 'healthy',
      message: '✅ ASSUMED HEALTHY: Harvester working',
      dependencies: ['Browser Pool']
    });
  }
  
  return results;
}

function generateMapHTML(
  systems: SystemStatus[], 
  broken: SystemStatus[], 
  warnings: SystemStatus[]
): string {
  const overallHealth = broken.length === 0 
    ? (warnings.length === 0 ? 'healthy' : 'degraded')
    : 'critical';
  
  const healthColor = {
    healthy: '#22c55e',
    degraded: '#eab308', 
    critical: '#ef4444'
  }[overallHealth];
  
  const healthEmoji = {
    healthy: '✅',
    degraded: '⚠️',
    critical: '🚨'
  }[overallHealth];
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🗺️ System Map - xBOT</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border-radius: 16px;
            border: 2px solid ${healthColor};
        }
        
        .health-status {
            font-size: 48px;
            margin-bottom: 10px;
        }
        
        .health-text {
            font-size: 24px;
            color: ${healthColor};
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .summary-card {
            background: #1e293b;
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid #64748b;
            text-align: center;
        }
        
        .summary-card.critical { border-left-color: #ef4444; }
        .summary-card.warning { border-left-color: #eab308; }
        .summary-card.healthy { border-left-color: #22c55e; }
        
        .summary-number {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .summary-label {
            color: #94a3b8;
            font-size: 14px;
            text-transform: uppercase;
        }
        
        .systems-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
        }
        
        .system-card {
            background: #1e293b;
            border-radius: 12px;
            padding: 24px;
            border: 2px solid #334155;
            transition: all 0.3s;
        }
        
        .system-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        
        .system-card.healthy { border-color: #22c55e; }
        .system-card.warning { border-color: #eab308; }
        .system-card.critical { border-color: #ef4444; }
        .system-card.unknown { border-color: #64748b; }
        
        .system-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        
        .system-name {
            font-size: 20px;
            font-weight: bold;
        }
        
        .system-status-badge {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-healthy { background: #22c55e; color: white; }
        .status-warning { background: #eab308; color: white; }
        .status-critical { background: #ef4444; color: white; }
        .status-unknown { background: #64748b; color: white; }
        
        .system-message {
            font-size: 16px;
            line-height: 1.5;
            margin-bottom: 16px;
            padding: 12px;
            background: #0f172a;
            border-radius: 8px;
        }
        
        .system-metrics {
            display: flex;
            gap: 16px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }
        
        .metric {
            background: #0f172a;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 14px;
        }
        
        .metric-label {
            color: #94a3b8;
            font-size: 12px;
        }
        
        .metric-value {
            color: #e2e8f0;
            font-weight: bold;
        }
        
        .dependencies {
            border-top: 1px solid #334155;
            padding-top: 12px;
        }
        
        .dependencies-label {
            color: #94a3b8;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        
        .dependency-list {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .dependency-tag {
            background: #334155;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            color: #94a3b8;
        }
        
        .section-title {
            font-size: 24px;
            font-weight: bold;
            margin: 40px 0 20px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #334155;
        }
        
        .refresh-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #3b82f6;
            color: white;
            border: none;
            padding: 16px 24px;
            border-radius: 50px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
            transition: all 0.3s;
        }
        
        .refresh-btn:hover {
            background: #2563eb;
            transform: scale(1.05);
        }
        
        .timestamp {
            text-align: center;
            color: #64748b;
            font-size: 14px;
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="health-status">${healthEmoji}</div>
            <div class="health-text">${overallHealth}</div>
            <div style="color: #94a3b8; margin-top: 10px;">
                Overall System Health
            </div>
        </div>
        
        <div class="summary">
            <div class="summary-card critical">
                <div class="summary-number" style="color: #ef4444;">${broken.length}</div>
                <div class="summary-label">Critical Issues</div>
            </div>
            <div class="summary-card warning">
                <div class="summary-number" style="color: #eab308;">${warnings.length}</div>
                <div class="summary-label">Warnings</div>
            </div>
            <div class="summary-card healthy">
                <div class="summary-number" style="color: #22c55e;">${systems.length - broken.length - warnings.length}</div>
                <div class="summary-label">Healthy Systems</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: #3b82f6;">${systems.length}</div>
                <div class="summary-label">Total Systems</div>
            </div>
        </div>
        
        ${broken.length > 0 ? `
        <div class="section-title" style="color: #ef4444;">🚨 CRITICAL ISSUES (Fix These First!)</div>
        <div class="systems-grid">
            ${broken.map(system => generateSystemCard(system)).join('')}
        </div>
        ` : ''}
        
        ${warnings.length > 0 ? `
        <div class="section-title" style="color: #eab308;">⚠️ WARNINGS (Monitor These)</div>
        <div class="systems-grid">
            ${warnings.map(system => generateSystemCard(system)).join('')}
        </div>
        ` : ''}
        
        <div class="section-title" style="color: #22c55e;">✅ ALL SYSTEMS</div>
        <div class="systems-grid">
            ${systems.map(system => generateSystemCard(system)).join('')}
        </div>
        
        <div class="timestamp">
            Last updated: ${new Date().toLocaleString()}<br>
            Auto-refreshes every 60 seconds
        </div>
    </div>
    
    <button class="refresh-btn" onclick="location.reload()">
        🔄 Refresh Now
    </button>
    
    <script>
        // Auto-refresh every 60 seconds
        setTimeout(() => location.reload(), 60000);
    </script>
</body>
</html>
  `;
}

function generateSystemCard(system: SystemStatus): string {
  return `
    <div class="system-card ${system.status}">
        <div class="system-header">
            <div class="system-name">${system.name}</div>
            <div class="system-status-badge status-${system.status}">
                ${system.status}
            </div>
        </div>
        
        <div class="system-message">
            ${system.message}
        </div>
        
        ${system.metrics ? `
        <div class="system-metrics">
            ${Object.entries(system.metrics).map(([key, value]) => `
                <div class="metric">
                    <div class="metric-label">${key}</div>
                    <div class="metric-value">${value}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        ${system.dependencies && system.dependencies.length > 0 ? `
        <div class="dependencies">
            <div class="dependencies-label">Depends on:</div>
            <div class="dependency-list">
                ${system.dependencies.map(dep => `
                    <span class="dependency-tag">${dep}</span>
                `).join('')}
            </div>
        </div>
        ` : ''}
    </div>
  `;
}

function generateErrorHTML(error: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Error - System Map</title>
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
        }
    </style>
</head>
<body>
    <div class="error">
        <h1>🚨 Dashboard Error</h1>
        <p>${error}</p>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; font-size: 16px;">
            🔄 Try Again
        </button>
    </div>
</body>
</html>
  `;
}

