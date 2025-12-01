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
  business: { label: '💼 Business', path: '/dashboard/business', icon: '💼', description: 'Real-time system activity' },
  diagnostics: { label: '🤖 Diagnostics', path: '/dashboard/diagnostics', icon: '🤖', description: 'System health chatbot' },
  systemFlow: { label: '🔍 System Flow', path: '/dashboard/system-flow', icon: '🔍', description: 'End-to-end flow view' },
  health: { label: '🩺 Health', path: '/dashboard/health', icon: '🩺', description: 'System health overview' },
  posts: { label: '📝 Posts', path: '/dashboard/posts', icon: '📝', description: 'Posts analytics' },
  replies: { label: '💬 Replies', path: '/dashboard/replies', icon: '💬', description: 'Replies analytics' },
  dataValidation: { label: '🔬 Data Validation', path: '/dashboard/data-validation', icon: '🔬', description: 'Data integrity checks' },
  postingMonitor: { label: '📋 Posting Monitor', path: '/dashboard/posting-monitor', icon: '📋', description: 'Hourly posting tracking' },
  recent: { label: '📅 Recent', path: '/dashboard/recent', icon: '📅', description: 'Recent activity feed' }
};

/**
 * Generate navigation HTML with all active dashboards
 */
export function generateNavigation(activeTab: string): string {
  const navItems = [
    DASHBOARD_NAVIGATION.business,
    DASHBOARD_NAVIGATION.diagnostics,
    DASHBOARD_NAVIGATION.systemFlow,
    DASHBOARD_NAVIGATION.health,
    DASHBOARD_NAVIGATION.posts,
    DASHBOARD_NAVIGATION.replies,
    DASHBOARD_NAVIGATION.recent,
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
    .container { max-width: 1600px; margin: 0 auto; padding: 0 20px; }
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
    
    /* Content Type Visual Indicators */
    .content-type-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .content-type-badge.single {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }
    .content-type-badge.thread {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
    }
    .content-type-badge.reply {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    }
    
    /* Content Type Cards/Borders */
    .content-card.single {
        border-left: 5px solid #3b82f6;
        background: linear-gradient(90deg, rgba(59, 130, 246, 0.05) 0%, white 10%);
    }
    .content-card.thread {
        border-left: 5px solid #8b5cf6;
        background: linear-gradient(90deg, rgba(139, 92, 246, 0.05) 0%, white 10%);
    }
    .content-card.reply {
        border-left: 5px solid #10b981;
        background: linear-gradient(90deg, rgba(16, 185, 129, 0.05) 0%, white 10%);
    }
    
    /* Stats Cards by Type */
    .stat-card.type-single {
        border-top: 4px solid #3b82f6;
    }
    .stat-card.type-thread {
        border-top: 4px solid #8b5cf6;
    }
    .stat-card.type-reply {
        border-top: 4px solid #10b981;
    }
    
    /* Table Row Styling */
    tr.content-row.single {
        border-left: 4px solid #3b82f6;
    }
    tr.content-row.thread {
        border-left: 4px solid #8b5cf6;
    }
    tr.content-row.reply {
        border-left: 4px solid #10b981;
    }
  `;
}

/**
 * Get content type badge HTML
 */
export function getContentTypeBadge(decisionType: string | null): string {
  if (!decisionType) return '<span class="content-type-badge single">📝 Single</span>';
  
  const type = decisionType.toLowerCase();
  if (type === 'reply') {
    return '<span class="content-type-badge reply">💬 Reply</span>';
  } else if (type === 'thread') {
    return '<span class="content-type-badge thread">🧵 Thread</span>';
  } else {
    return '<span class="content-type-badge single">📝 Single</span>';
  }
}

/**
 * Get content type card class
 */
export function getContentTypeClass(decisionType: string | null): string {
  if (!decisionType) return 'single';
  return decisionType.toLowerCase();
}

/**
 * Generate error page HTML
 */
/**
 * Generate user-friendly error HTML with plain English messaging
 */
export function generateErrorHTML(error: string, backUrl: string = '/dashboard/business'): string {
  // Convert technical errors to plain English
  let friendlyError = error;
  
  if (error.includes('ECONNREFUSED') || error.includes('connection')) {
    friendlyError = 'Unable to connect to the database. The system may be starting up or experiencing connectivity issues.';
  } else if (error.includes('timeout')) {
    friendlyError = 'The request took too long to complete. Please try again in a moment.';
  } else if (error.includes('ENOTFOUND') || error.includes('DNS')) {
    friendlyError = 'Network connection issue detected. Please check your internet connection.';
  } else if (error.includes('unauthorized') || error.includes('401')) {
    friendlyError = 'Authentication required. Please add your access token to the URL.';
  } else if (error.includes('Cannot read') || error.includes('undefined')) {
    friendlyError = 'Some data is missing or not yet available. The system may still be initializing.';
  } else if (error.length > 100) {
    // For very long technical errors, provide a friendly message
    friendlyError = 'An unexpected error occurred while loading the dashboard. Our system is automatically working to fix this.';
  }
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>Dashboard Error</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${getSharedStyles()}
        body { 
            text-align: center; 
            padding: 50px; 
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
        .error-message { 
            color: #dc3545; 
            font-weight: 600; 
            margin-bottom: 15px;
            padding: 15px;
            background: #fef2f2;
            border-radius: 8px;
            border-left: 4px solid #ef4444;
        }
        .help-text {
            color: #666; 
            margin-bottom: 20px; 
            line-height: 1.6;
            font-size: 14px;
        }
        a {
            display: inline-block;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.2s;
            margin: 5px;
        }
        a:hover {
            background: #5568d3;
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="error-box">
        <h1>⚠️ Something Went Wrong</h1>
        <div class="error-message">${friendlyError}</div>
        <div class="help-text">
            ${error.includes('database') || error.includes('connection') 
              ? '💡 <strong>What to do:</strong> Wait a moment and try again. The system may be restarting or updating.'
              : '💡 <strong>What to do:</strong> Try refreshing the page. If the problem continues, check the Diagnostics dashboard for system status.'}
        </div>
        <a href="${backUrl}${TOKEN_PARAM}">🔄 Try Again</a>
        <a href="/dashboard/diagnostics${TOKEN_PARAM}">🤖 Check System Status</a>
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
 * Generate authentication error HTML with clear instructions
 */
export function generateAuthErrorHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Authentication Required</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${getSharedStyles()}
        body { 
            text-align: center; 
            padding: 50px; 
        }
        .auth-box { 
            background: white; 
            padding: 40px; 
            border-radius: 15px; 
            max-width: 600px; 
            margin: 0 auto; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 { color: #f59e0b; margin-bottom: 20px; }
        .instruction {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: left;
        }
        code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            color: #1f2937;
        }
        .help-text {
            color: #666; 
            margin-top: 20px; 
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="auth-box">
        <h1>🔒 Access Required</h1>
        <p style="color: #666; margin-bottom: 20px;">You need to authenticate to view this dashboard.</p>
        <div class="instruction">
            <strong>How to access:</strong><br>
            1. Add <code>?token=YOUR_TOKEN</code> to the end of the URL<br>
            2. Replace <code>YOUR_TOKEN</code> with your access token<br>
            3. Example: <code>/dashboard/business?token=xbot-admin-2025</code>
        </div>
        <div class="help-text">
            If you don't have an access token, please contact your system administrator.
        </div>
    </div>
</body>
</html>`;
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

