/**
 * 🔄 SYSTEM FLOW DASHBOARD
 * 
 * Shows the "pipes" of data flowing through the system:
 * 1. Content Generation → Queue → Posting → Twitter
 * 2. Harvesting → Reply Queue → Reply Posting → Twitter  
 * 3. Twitter → Scraping → Learning → Better Content
 * 
 * Each "pipe" shows: what's flowing, if it's working, where it's broken
 */

import { getSupabaseClient } from '../db/index';

interface PipelineStatus {
  name: string;
  working: boolean;
  lastActivity: string;
  flowRate: string;
  bottleneck: string | null;
  recentData: any[];
}

interface SystemFlowData {
  pipelines: {
    contentPipeline: PipelineStatus;
    replyPipeline: PipelineStatus;
    harvestPipeline: PipelineStatus;
    scrapingPipeline: PipelineStatus;
    learningPipeline: PipelineStatus;
  };
  queueStatus: {
    contentQueued: number;
    repliesQueued: number;
    readyToPost: number;
  };
  errors: any[];
  timestamp: Date;
}

export async function generateSystemFlowDashboard(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const data = await fetchSystemFlowData(supabase);
    
    console.log('[FLOW_DASHBOARD] Data fetched:', {
      contentQueued: data.queueStatus.contentQueued,
      repliesQueued: data.queueStatus.repliesQueued,
      errors: data.errors.length,
      pipelines: Object.keys(data.pipelines).map(k => ({
        name: k,
        working: data.pipelines[k as keyof typeof data.pipelines].working
      }))
    });
    
    return generateFlowHTML(data);
    
  } catch (error: any) {
    console.error('[FLOW_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

async function fetchSystemFlowData(supabase: any): Promise<SystemFlowData> {
  const now = new Date();
  const lastHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const last6Hours = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  
  try {
    // CONTENT PIPELINE: Generation → Queue → Posted
    const { data: contentGenerated } = await supabase
      .from('content_metadata')
      .select('created_at')
      .in('decision_type', ['single', 'thread'])
      .gte('created_at', last6Hours)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const { data: contentQueued } = await supabase
      .from('content_metadata')
      .select('scheduled_at, quality_score')
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread'])
      .order('scheduled_at', { ascending: true });
    
    const { data: contentPosted } = await supabase
      .from('content_metadata')
      .select('posted_at, content, actual_impressions')
      .eq('status', 'posted')
      .in('decision_type', ['single', 'thread'])
      .gte('posted_at', lastHour)
      .order('posted_at', { ascending: false });
    
    const contentGenMinutesAgo = contentGenerated?.created_at 
      ? Math.round((Date.now() - new Date(contentGenerated.created_at).getTime()) / (1000 * 60))
      : 999;
    
    const contentPipeline: PipelineStatus = {
      name: 'Content Pipeline',
      working: contentGenMinutesAgo < 150, // Should run every 120min
      lastActivity: contentGenMinutesAgo < 999 ? `${contentGenMinutesAgo}m ago` : 'Never',
      flowRate: `${contentPosted?.length || 0}/hour`,
      bottleneck: contentGenMinutesAgo >= 150 ? 'Content generation stalled' : 
                   (contentQueued?.length || 0) < 2 ? 'Queue low' : null,
      recentData: contentPosted?.slice(0, 3) || []
    };
    
    // REPLY PIPELINE: Harvesting → Reply Gen → Queue → Posted
    const { data: repliesGenerated } = await supabase
      .from('content_metadata')
      .select('created_at')
      .eq('decision_type', 'reply')
      .gte('created_at', lastHour)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const { data: repliesQueued } = await supabase
      .from('content_metadata')
      .select('scheduled_at, quality_score')
      .eq('status', 'queued')
      .eq('decision_type', 'reply')
      .order('scheduled_at', { ascending: true });
    
    const { data: repliesPosted } = await supabase
      .from('content_metadata')
      .select('posted_at, content, reply_to_username')
      .eq('status', 'posted')
      .eq('decision_type', 'reply')
      .gte('posted_at', lastHour)
      .order('posted_at', { ascending: false });
    
    const replyGenMinutesAgo = repliesGenerated?.created_at
      ? Math.round((Date.now() - new Date(repliesGenerated.created_at).getTime()) / (1000 * 60))
      : 999;
    
    const replyPipeline: PipelineStatus = {
      name: 'Reply Pipeline',
      working: replyGenMinutesAgo < 45, // Should run every 30min
      lastActivity: replyGenMinutesAgo < 999 ? `${replyGenMinutesAgo}m ago` : 'Never',
      flowRate: `${repliesPosted?.length || 0}/hour`,
      bottleneck: replyGenMinutesAgo >= 45 ? 'Reply generation stalled' : 
                   (repliesQueued?.length || 0) < 4 ? 'Queue low' : null,
      recentData: repliesPosted?.slice(0, 3) || []
    };
    
    // HARVEST PIPELINE: Finding opportunities
    const { data: opportunitiesHarvested } = await supabase
      .from('reply_opportunities')
      .select('created_at, tier, target_username')
      .gte('created_at', lastHour)
      .order('created_at', { ascending: false });
    
    const { data: availableOpportunities } = await supabase
      .from('reply_opportunities')
      .select('tier')
      .eq('replied_to', false)
      .or('expires_at.is.null,expires_at.gt.' + now.toISOString());
    
    const harvestPipeline: PipelineStatus = {
      name: 'Harvest Pipeline',
      working: (opportunitiesHarvested?.length || 0) > 0 || (availableOpportunities?.length || 0) > 10,
      lastActivity: opportunitiesHarvested?.[0]?.created_at 
        ? `${Math.round((Date.now() - new Date(opportunitiesHarvested[0].created_at).getTime()) / (1000 * 60))}m ago`
        : 'No recent activity',
      flowRate: `${opportunitiesHarvested?.length || 0}/hour`,
      bottleneck: (availableOpportunities?.length || 0) < 10 ? 'Opportunity pool low' : null,
      recentData: opportunitiesHarvested?.slice(0, 3) || []
    };
    
    // SCRAPING PIPELINE: Collecting metrics
    const { data: lastScrape } = await supabase
      .from('outcomes')
      .select('collected_at')
      .eq('data_source', 'orchestrator_v2')
      .order('collected_at', { ascending: false })
      .limit(1)
      .single();
    
    const { data: scrapedLastHour } = await supabase
      .from('outcomes')
      .select('tweet_id, actual_impressions, actual_likes')
      .eq('data_source', 'orchestrator_v2')
      .gte('collected_at', lastHour);
    
    const scrapeMinutesAgo = lastScrape?.collected_at
      ? Math.round((Date.now() - new Date(lastScrape.collected_at).getTime()) / (1000 * 60))
      : 999;
    
    const scrapingPipeline: PipelineStatus = {
      name: 'Scraping Pipeline',
      working: scrapeMinutesAgo < 30, // Should run every 20min
      lastActivity: scrapeMinutesAgo < 999 ? `${scrapeMinutesAgo}m ago` : 'Never',
      flowRate: `${scrapedLastHour?.length || 0}/hour`,
      bottleneck: scrapeMinutesAgo >= 30 ? 'Scraper not running' : null,
      recentData: scrapedLastHour?.slice(0, 3) || []
    };
    
    // LEARNING PIPELINE: Using data to improve
    const learningPipeline: PipelineStatus = {
      name: 'Learning Pipeline',
      working: true, // Always passive
      lastActivity: 'Continuous',
      flowRate: 'Passive',
      bottleneck: scrapedLastHour?.length === 0 ? 'No metrics to learn from' : null,
      recentData: []
    };
    
    // QUEUE STATUS
    const next5min = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const readyContent = contentQueued?.filter((c: any) => c.scheduled_at <= next5min).length || 0;
    const readyReplies = repliesQueued?.filter((r: any) => r.scheduled_at <= next5min).length || 0;
    
    // ERRORS
    const { data: errors } = await supabase
      .from('content_metadata')
      .select('decision_type, error_message, updated_at, content')
      .eq('status', 'failed')
      .gte('updated_at', lastHour)
      .order('updated_at', { ascending: false })
      .limit(10);
    
    return {
      pipelines: {
        contentPipeline,
        replyPipeline,
        harvestPipeline,
        scrapingPipeline,
        learningPipeline
      },
      queueStatus: {
        contentQueued: contentQueued?.length || 0,
        repliesQueued: repliesQueued?.length || 0,
        readyToPost: readyContent + readyReplies
      },
      errors: errors || [],
      timestamp: now
    };
  } catch (error: any) {
    console.error('[FLOW_DASHBOARD] Fetch error:', error.message);
    throw error;
  }
}

function generateFlowHTML(data: SystemFlowData): string {
  const { pipelines, queueStatus, errors } = data;
  const timestamp = new Date(data.timestamp).toLocaleString();
  
  const allPipelinesWorking = Object.values(pipelines).every(p => p.working);
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>xBOT System Flow</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${getFlowStyles()}
    </style>
</head>
<body>
    <div class="flow-container">
        
        <!-- HEADER -->
        <div class="flow-header">
            <h1>🔄 xBOT System Flow Monitor</h1>
            <p>Tracking data pipes in real-time</p>
            <div class="system-status ${allPipelinesWorking ? 'healthy' : 'broken'}">
                ${allPipelinesWorking ? '✅ All Pipes Flowing' : '⚠️ Pipe Blocked'}
            </div>
            <div class="refresh-indicator">
                <span class="pulse-dot"></span>
                Refreshes in <span id="countdown">5</span>s | Last updated: <span id="timestamp">${timestamp}</span>
            </div>
        </div>

        <!-- QUEUE OVERVIEW -->
        <div class="queue-overview">
            <div class="queue-stat">
                <div class="stat-value">${queueStatus.contentQueued}</div>
                <div class="stat-label">Content Queued</div>
            </div>
            <div class="queue-stat">
                <div class="stat-value">${queueStatus.repliesQueued}</div>
                <div class="stat-label">Replies Queued</div>
            </div>
            <div class="queue-stat highlight">
                <div class="stat-value">${queueStatus.readyToPost}</div>
                <div class="stat-label">Ready to Post</div>
            </div>
        </div>

        <!-- PIPELINE FLOWS -->
        <div class="pipelines">
            ${generatePipelineCard(pipelines.contentPipeline, '1')}
            ${generatePipelineCard(pipelines.replyPipeline, '2')}
            ${generatePipelineCard(pipelines.harvestPipeline, '3')}
            ${generatePipelineCard(pipelines.scrapingPipeline, '4')}
            ${generatePipelineCard(pipelines.learningPipeline, '5')}
        </div>

        <!-- ERRORS -->
        ${errors.length > 0 ? `
        <div class="errors-section">
            <h2>🚨 Pipeline Blockages (${errors.length})</h2>
            <div class="error-list">
                ${errors.map((error: any) => {
                    const age = Math.round((Date.now() - new Date(error.updated_at).getTime()) / (1000 * 60));
                    return `
                    <div class="error-card">
                        <div class="error-header">
                            <span class="error-badge">${error.decision_type}</span>
                            <span class="error-time">${age}m ago</span>
                        </div>
                        <div class="error-message">${error.error_message || 'Unknown error'}</div>
                        <div class="error-content">${(error.content || '').substring(0, 100)}...</div>
                    </div>
                `}).join('')}
            </div>
        </div>
        ` : ''}

        <!-- FOOTER -->
        <div class="footer">
            <p>🔄 Monitoring all data pipelines in real-time</p>
            <p style="font-size: 12px; margin-top: 5px; color: #718096;">
                Expected flow: 2 posts/hour, 4 replies/hour • Auto-refreshes every 5 seconds
            </p>
        </div>

    </div>
    
    <script>
        ${getFlowScripts()}
    </script>
</body>
</html>`;
}

function generatePipelineCard(pipeline: PipelineStatus, number: string): string {
  return `
    <div class="pipeline-card ${pipeline.working ? 'working' : 'blocked'}">
        <div class="pipeline-header">
            <div class="pipeline-number">${number}</div>
            <div class="pipeline-title">
                <h3>${pipeline.name}</h3>
                <p>${pipeline.working ? '✅ Flowing' : '❌ Blocked'}</p>
            </div>
            <div class="pipeline-indicator ${pipeline.working ? 'flowing' : 'blocked'}">
                <div class="flow-animation"></div>
            </div>
        </div>
        
        <div class="pipeline-stats">
            <div class="stat">
                <span class="stat-label">Last Activity:</span>
                <span class="stat-value">${pipeline.lastActivity}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Flow Rate:</span>
                <span class="stat-value">${pipeline.flowRate}</span>
            </div>
        </div>
        
        ${pipeline.bottleneck ? `
        <div class="bottleneck">
            <span class="bottleneck-icon">⚠️</span>
            <span class="bottleneck-text">${pipeline.bottleneck}</span>
        </div>
        ` : ''}
        
        ${pipeline.recentData.length > 0 ? `
        <div class="recent-flow">
            <div class="flow-label">Recent Flow:</div>
            ${pipeline.recentData.map((item: any, i: number) => `
                <div class="flow-item">
                    <span class="flow-dot"></span>
                    <span class="flow-text">${getFlowItemText(item)}</span>
                </div>
            `).join('')}
        </div>
        ` : ''}
    </div>
  `;
}

function getFlowItemText(item: any): string {
  if (item.content) {
    return `${item.content.substring(0, 50)}...`;
  }
  if (item.target_username) {
    return `@${item.target_username} (${item.tier})`;
  }
  if (item.actual_impressions !== undefined) {
    return `${item.actual_impressions} views, ${item.actual_likes || 0} likes`;
  }
  return 'Data item';
}

function getFlowStyles(): string {
  return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            min-height: 100vh;
            padding: 20px;
            color: #e2e8f0;
        }
        
        .flow-container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .flow-header {
            background: #1e293b;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            text-align: center;
            border: 1px solid #334155;
        }
        
        .flow-header h1 {
            color: #e2e8f0;
            margin-bottom: 10px;
        }
        
        .system-status {
            display: inline-block;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: 600;
            margin: 15px 0;
        }
        
        .system-status.healthy {
            background: #48bb7820;
            color: #48bb78;
            border: 2px solid #48bb78;
        }
        
        .system-status.broken {
            background: #f5656520;
            color: #f56565;
            border: 2px solid #f56565;
            animation: pulse 2s infinite;
        }
        
        .refresh-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 13px;
            color: #94a3b8;
            margin-top: 10px;
        }
        
        .pulse-dot {
            width: 8px;
            height: 8px;
            background: #48bb78;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.1); }
        }
        
        .queue-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .queue-stat {
            background: #1e293b;
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            border: 2px solid #334155;
        }
        
        .queue-stat.highlight {
            border-color: #3b82f6;
            background: #3b82f610;
        }
        
        .stat-value {
            font-size: 42px;
            font-weight: bold;
            color: #e2e8f0;
            margin-bottom: 8px;
        }
        
        .stat-label {
            font-size: 13px;
            color: #94a3b8;
            text-transform: uppercase;
            font-weight: 600;
        }
        
        .pipelines {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .pipeline-card {
            background: #1e293b;
            padding: 25px;
            border-radius: 15px;
            border: 2px solid;
            transition: all 0.3s;
        }
        
        .pipeline-card.working {
            border-color: #48bb78;
            box-shadow: 0 0 20px #48bb7820;
        }
        
        .pipeline-card.blocked {
            border-color: #f56565;
            box-shadow: 0 0 20px #f5656520;
        }
        
        .pipeline-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #334155;
        }
        
        .pipeline-number {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: bold;
            color: white;
        }
        
        .pipeline-title {
            flex: 1;
        }
        
        .pipeline-title h3 {
            color: #e2e8f0;
            font-size: 18px;
            margin-bottom: 5px;
        }
        
        .pipeline-title p {
            font-size: 13px;
            color: #94a3b8;
        }
        
        .pipeline-indicator {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: 3px solid;
            position: relative;
            overflow: hidden;
        }
        
        .pipeline-indicator.flowing {
            border-color: #48bb78;
            background: #48bb7810;
        }
        
        .pipeline-indicator.blocked {
            border-color: #f56565;
            background: #f5656510;
        }
        
        .flow-animation {
            position: absolute;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            animation: flow 2s linear infinite;
        }
        
        .pipeline-indicator.blocked .flow-animation {
            animation: none;
        }
        
        @keyframes flow {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        .pipeline-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
        }
        
        .stat {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .stat-label {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
        }
        
        .stat-value {
            font-size: 16px;
            color: #e2e8f0;
            font-weight: 600;
        }
        
        .bottleneck {
            display: flex;
            align-items: center;
            gap: 10px;
            background: #f5656515;
            padding: 12px;
            border-radius: 8px;
            border-left: 3px solid #f56565;
            margin-bottom: 15px;
        }
        
        .bottleneck-icon {
            font-size: 20px;
        }
        
        .bottleneck-text {
            color: #fca5a5;
            font-size: 13px;
            font-weight: 600;
        }
        
        .recent-flow {
            background: #0f172a;
            padding: 12px;
            border-radius: 8px;
        }
        
        .flow-label {
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .flow-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 0;
            font-size: 12px;
            color: #94a3b8;
        }
        
        .flow-dot {
            width: 6px;
            height: 6px;
            background: #48bb78;
            border-radius: 50%;
        }
        
        .flow-text {
            flex: 1;
        }
        
        .errors-section {
            background: #1e293b;
            padding: 25px;
            border-radius: 15px;
            border: 2px solid #f56565;
            margin-bottom: 30px;
        }
        
        .errors-section h2 {
            color: #f56565;
            margin-bottom: 20px;
        }
        
        .error-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .error-card {
            background: #0f172a;
            padding: 15px;
            border-radius: 10px;
            border-left: 4px solid #f56565;
        }
        
        .error-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        
        .error-badge {
            background: #f5656520;
            color: #fca5a5;
            padding: 4px 10px;
            border-radius: 5px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .error-time {
            font-size: 12px;
            color: #f56565;
            font-weight: 600;
        }
        
        .error-message {
            font-size: 13px;
            color: #fca5a5;
            margin-bottom: 8px;
            font-family: monospace;
        }
        
        .error-content {
            font-size: 12px;
            color: #64748b;
        }
        
        .footer {
            text-align: center;
            padding: 20px;
            color: #64748b;
        }
  `;
}

function getFlowScripts(): string {
  return `
        let countdown = 5;
        setInterval(() => {
            countdown--;
            if (countdown <= 0) {
                location.reload();
            }
            document.getElementById('countdown').textContent = countdown;
        }, 1000);
        
        setInterval(() => {
            document.getElementById('timestamp').textContent = new Date().toLocaleString();
        }, 1000);
  `;
}

function generateErrorHTML(error: string): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Flow Dashboard Error</title>
    <meta charset="UTF-8">
</head>
<body style="font-family: sans-serif; padding: 40px; background: #0f172a; color: #e2e8f0;">
    <div style="max-width: 800px; margin: 0 auto; background: #1e293b; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
        <h1 style="color: #f56565;">❌ Dashboard Error</h1>
        <p>Failed to generate flow dashboard.</p>
        <pre style="background: #0f172a; padding: 20px; border-radius: 8px; overflow-x: auto;">${error}</pre>
        <a href="/dashboard/health?token=xbot-admin-2025" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Retry</a>
    </div>
</body>
</html>`;
}

