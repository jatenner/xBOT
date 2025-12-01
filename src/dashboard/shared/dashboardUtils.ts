/**
 * 📊 SHARED DASHBOARD UTILITIES
 * Common functions, styles, and navigation for all dashboards
 */

import { getSupabaseClient } from '../../db';

export const ADMIN_TOKEN = 'xbot-admin-2025';
export const TOKEN_PARAM = `?token=${ADMIN_TOKEN}`;

/**
 * Standard dashboard navigation links
 */
export const DASHBOARD_NAVIGATION = {
  business: { label: '💼 Business', path: '/dashboard/business', icon: '💼' },
  diagnostics: { label: '🤖 Diagnostics', path: '/dashboard/diagnostics', icon: '🤖' },
  systemFlow: { label: '🔍 System Flow', path: '/dashboard/system-flow', icon: '🔍' },
  health: { label: '🩺 Health', path: '/dashboard/health', icon: '🩺' },
  posts: { label: '📝 Posts', path: '/dashboard/posts', icon: '📝' },
  replies: { label: '💬 Replies', path: '/dashboard/replies', icon: '💬' },
  dataValidation: { label: '🔬 Data Validation', path: '/dashboard/data-validation', icon: '🔬' },
  postingMonitor: { label: '📋 Posting Monitor', path: '/dashboard/posting-monitor', icon: '📋' },
  vi: { label: '🔍 VI Collection', path: '/dashboard/vi', icon: '🔍' }
};

/**
 * Generate navigation HTML
 */
export function generateNavigation(activeTab: string): string {
  const navItems = [
    DASHBOARD_NAVIGATION.business,
    DASHBOARD_NAVIGATION.diagnostics,
    DASHBOARD_NAVIGATION.systemFlow,
    DASHBOARD_NAVIGATION.health,
    DASHBOARD_NAVIGATION.posts,
    DASHBOARD_NAVIGATION.replies,
    DASHBOARD_NAVIGATION.dataValidation,
    DASHBOARD_NAVIGATION.postingMonitor
  ];

  return `
    <div class="nav-tabs">
      ${navItems.map(item => `
        <a href="${item.path}${TOKEN_PARAM}" 
           class="nav-tab ${activeTab === item.path ? 'active' : ''}">
          ${item.label}
        </a>
      `).join('')}
    </div>
  `;
}

/**
 * Shared styles for all dashboards
 */
export function getSharedStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        padding: 20px;
    }
    .container { max-width: 1800px; margin: 0 auto; }
    .header {
        background: white;
        padding: 30px;
        border-radius: 15px;
        margin-bottom: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .header h1 { color: #333; margin-bottom: 10px; font-size: 32px; }
    .header p { color: #666; font-size: 16px; }
    .nav-tabs { 
        display: flex; 
        gap: 10px; 
        margin-bottom: 20px; 
        flex-wrap: wrap; 
    }
    .nav-tab { 
        padding: 12px 24px; 
        background: white; 
        border-radius: 8px; 
        text-decoration: none; 
        color: #333;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        transition: all 0.2s;
        font-size: 14px;
    }
    .nav-tab:hover { 
        background: #667eea; 
        color: white; 
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .nav-tab.active { 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
        color: white;
    }
    .section {
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        margin-bottom: 20px;
    }
    .section h2 { 
        color: #333; 
        margin-bottom: 20px; 
        font-size: 24px; 
    }
    .footer { 
        text-align: center; 
        color: white; 
        margin-top: 40px; 
        opacity: 0.9; 
        font-size: 14px;
    }
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 20px;
    }
    .stat-card {
        background: white;
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        transition: transform 0.2s;
    }
    .stat-card:hover { 
        transform: translateY(-2px); 
    }
    .stat-label { 
        color: #666; 
        font-size: 14px; 
        margin-bottom: 8px; 
        text-transform: uppercase; 
        letter-spacing: 0.5px; 
    }
    .stat-value { 
        color: #333; 
        font-size: 36px; 
        font-weight: bold; 
    }
    .stat-change { 
        color: #28a745; 
        font-size: 14px; 
        margin-top: 8px; 
    }
  `;
}

/**
 * Generate error page HTML
 */
export function generateErrorHTML(error: string, backUrl: string = '/dashboard/business'): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Dashboard Error</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .error-box { 
            background: white; 
            padding: 40px; 
            border-radius: 15px; 
            max-width: 600px; 
            margin: 0 auto; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 { color: #ef4444; margin-bottom: 20px; }
        p { color: #666; margin-bottom: 20px; line-height: 1.6; }
        a {
            display: inline-block;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.2s;
        }
        a:hover {
            background: #5568d3;
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="error-box">
        <h1>🚨 Dashboard Error</h1>
        <p style="color: #dc3545; font-weight: 600;">${error}</p>
        <a href="${backUrl}${TOKEN_PARAM}">🔄 Try Again</a>
    </div>
</body>
</html>`;
}

/**
 * Format time ago
 */
export function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format number with commas
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return value.toLocaleString();
}

/**
 * Get health color from score
 */
export function getHealthColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

/**
 * Standard authentication check
 */
export function checkAuth(token: string | undefined, headerToken: string | undefined): boolean {
  const adminToken = process.env.ADMIN_TOKEN || ADMIN_TOKEN;
  const providedToken = token || headerToken?.replace('Bearer ', '');
  return providedToken === adminToken;
}

/**
 * Generate auth error HTML
 */
export function generateAuthErrorHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Authentication Required</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .auth-box { 
            background: white; 
            padding: 40px; 
            border-radius: 15px; 
            max-width: 500px; 
            margin: 0 auto; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 { color: #333; margin-bottom: 20px; }
        code {
            background: #f3f4f6;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: 'Monaco', 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="auth-box">
        <h1>🔒 Authentication Required</h1>
        <p>Add <code>?token=YOUR_TOKEN</code> to the URL</p>
    </div>
</body>
</html>`;
}

/**
 * Common data fetchers
 */
export async function getTodayStats() {
  const supabase = getSupabaseClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, actual_impressions, actual_likes, status')
    .gte('created_at', todayStart.toISOString());

  const postedToday = todayPosts?.filter(p => p.status === 'posted' && p.decision_type === 'single').length || 0;
  const repliedToday = todayPosts?.filter(p => p.status === 'posted' && p.decision_type === 'reply').length || 0;
  const queuedToday = todayPosts?.filter(p => p.status === 'queued').length || 0;
  const totalViews = todayPosts?.reduce((sum, p) => sum + (p.actual_impressions || 0), 0) || 0;
  const totalLikes = todayPosts?.reduce((sum, p) => sum + (p.actual_likes || 0), 0) || 0;

  return { postedToday, repliedToday, queuedToday, totalViews, totalLikes };
}

export async function getQueueStatus() {
  const supabase = getSupabaseClient();
  const { count } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued');
  
  return count || 0;
}

export async function getScraperCoverage() {
  const supabase = getSupabaseClient();
  
  const { count: postsWithMetrics } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .not('actual_impressions', 'is', null);

  const { count: totalPosted } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .not('tweet_id', 'is', null);

  const coverage = totalPosted && totalPosted > 0 
    ? Math.round((postsWithMetrics || 0) / totalPosted * 100)
    : 100;

  return { coverage, postsWithMetrics: postsWithMetrics || 0, totalPosted: totalPosted || 0 };
}

