/**
 * 📝 CONTENT DASHBOARD
 * Unified view of all posts, replies, and content analytics
 */

import { getSupabaseClient } from '../db';
import { 
  generateNavigation, 
  getSharedStyles, 
  generateErrorHTML, 
  formatTimeAgo,
  getContentTypeBadge,
  TOKEN_PARAM
} from './shared/dashboardUtils';

export async function generateContentDashboard(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    
    // Get posts
    const { data: posts } = await supabase
      .from('content_metadata')
      .select('decision_id, content, posted_at, tweet_id, actual_impressions, actual_likes, actual_engagement_rate, decision_type, status')
      .in('decision_type', ['single', 'thread'])
      .order('created_at', { ascending: false })
      .limit(50);
    
    // Get replies
    const { data: replies } = await supabase
      .from('content_metadata')
      .select('decision_id, content, posted_at, tweet_id, actual_impressions, actual_likes, actual_engagement_rate, decision_type, status')
      .eq('decision_type', 'reply')
      .order('created_at', { ascending: false })
      .limit(50);
    
    // Get stats
    const { data: allContent } = await supabase
      .from('content_metadata')
      .select('decision_type, status')
      .order('created_at', { ascending: false })
      .limit(1000);
    
    const singlesCount = allContent?.filter((c: any) => c.decision_type === 'single' && c.status === 'posted').length || 0;
    const threadsCount = allContent?.filter((c: any) => c.decision_type === 'thread' && c.status === 'posted').length || 0;
    const repliesCount = allContent?.filter((c: any) => c.decision_type === 'reply' && c.status === 'posted').length || 0;
    
    return generateContentHTML({
      posts: posts || [],
      replies: replies || [],
      singlesCount,
      threadsCount,
      repliesCount
    });
  } catch (error: any) {
    console.error('[CONTENT_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message, '/dashboard/overview');
  }
}

function generateContentHTML(data: any): string {
  const { posts, replies, singlesCount, threadsCount, repliesCount } = data;
  const now = new Date().toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>📝 xBOT Content</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="60">
    <style>
        ${getSharedStyles()}
        .content-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
        }
        .content-tab {
            padding: 12px 20px;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            cursor: pointer;
            font-weight: 600;
            color: #666;
            transition: all 0.2s;
        }
        .content-tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
        }
        .content-tab:hover {
            color: #667eea;
        }
        .content-section {
            display: none;
        }
        .content-section.active {
            display: block;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #333;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        th {
            background: #f9fafb;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #333;
            border-bottom: 2px solid #e5e7eb;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        tr:hover {
            background: #f9fafb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📝 xBOT Content</h1>
            <p>All posts, replies, and content analytics</p>
        </div>

        ${generateNavigation('/dashboard/content')}

        <!-- Stats -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" style="color: #3b82f6;">${singlesCount}</div>
                <div class="stat-label">Single Posts</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #8b5cf6;">${threadsCount}</div>
                <div class="stat-label">Threads</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #10b981;">${repliesCount}</div>
                <div class="stat-label">Replies</div>
            </div>
        </div>

        <!-- Content Tabs -->
        <div class="content-tabs">
            <button class="content-tab active" onclick="showTab('posts')">📝 Posts (${posts.length})</button>
            <button class="content-tab" onclick="showTab('replies')">💬 Replies (${replies.length})</button>
        </div>

        <!-- Posts Section -->
        <div id="posts-section" class="content-section active">
            <table>
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Content</th>
                        <th>Status</th>
                        <th>Posted</th>
                        <th>Metrics</th>
                    </tr>
                </thead>
                <tbody>
                    ${posts.length > 0 ? posts.map((post: any) => `
                        <tr class="content-row ${post.decision_type}">
                            <td>${getContentTypeBadge(post.decision_type)}</td>
                            <td style="max-width: 400px;">${post.content?.substring(0, 100) || 'No content'}...</td>
                            <td>
                                <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; background: ${post.status === 'posted' ? '#d1fae5' : '#fef3c7'}; color: ${post.status === 'posted' ? '#065f46' : '#92400e'};">
                                    ${post.status === 'posted' ? '✅ Posted' : '⏳ Queued'}
                                </span>
                            </td>
                            <td>${post.posted_at ? formatTimeAgo(post.posted_at) : 'Not posted'}</td>
                            <td>
                                ${post.actual_impressions ? `
                                    👁️ ${post.actual_impressions.toLocaleString()} • 
                                    ❤️ ${post.actual_likes || 0} • 
                                    📊 ${((post.actual_engagement_rate || 0) * 100).toFixed(2)}%
                                ` : 'No metrics yet'}
                            </td>
                        </tr>
                    `).join('') : '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #666;">No posts found</td></tr>'}
                </tbody>
            </table>
        </div>

        <!-- Replies Section -->
        <div id="replies-section" class="content-section">
            <table>
                <thead>
                    <tr>
                        <th>Content</th>
                        <th>Status</th>
                        <th>Posted</th>
                        <th>Metrics</th>
                    </tr>
                </thead>
                <tbody>
                    ${replies.length > 0 ? replies.map((reply: any) => `
                        <tr class="content-row reply">
                            <td style="max-width: 500px;">${reply.content?.substring(0, 150) || 'No content'}...</td>
                            <td>
                                <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; background: ${reply.status === 'posted' ? '#d1fae5' : '#fef3c7'}; color: ${reply.status === 'posted' ? '#065f46' : '#92400e'};">
                                    ${reply.status === 'posted' ? '✅ Posted' : '⏳ Queued'}
                                </span>
                            </td>
                            <td>${reply.posted_at ? formatTimeAgo(reply.posted_at) : 'Not posted'}</td>
                            <td>
                                ${reply.actual_impressions ? `
                                    👁️ ${reply.actual_impressions.toLocaleString()} • 
                                    ❤️ ${reply.actual_likes || 0} • 
                                    📊 ${((reply.actual_engagement_rate || 0) * 100).toFixed(2)}%
                                ` : 'No metrics yet'}
                            </td>
                        </tr>
                    `).join('') : '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #666;">No replies found</td></tr>'}
                </tbody>
            </table>
        </div>

        <div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px; padding: 20px;">
            ⚡ Auto-refresh every 60 seconds • Last updated: ${now}
        </div>
    </div>

    <script>
        function showTab(tab) {
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
            document.getElementById(tab + '-section').classList.add('active');
            event.target.classList.add('active');
        }
    </script>
</body>
</html>`;
}

