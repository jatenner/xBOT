/**
 * 📊 SIMPLE DASHBOARD
 * Clean, simple view: Posts and Replies only
 */

import { getSupabaseClient } from '../db';

export async function generateSimpleDashboard(): Promise<string> {
  const supabase = getSupabaseClient();
  
  // Fetch all posts (singles + threads)
  const { data: posts } = await supabase
    .from('content_metadata')
    .select('*')
    .in('decision_type', ['single', 'thread'])
    .order('posted_at', { ascending: false })
    .limit(500);
  
  // Fetch all replies
  const { data: replies } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('decision_type', 'reply')
    .order('posted_at', { ascending: false })
    .limit(500);
  
  return generateDashboardHTML(posts || [], replies || []);
}

function generateDashboardHTML(posts: any[], replies: any[]): string {
  const now = new Date().toLocaleString();
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>xBOT Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            text-align: center;
            font-size: 28px;
            font-weight: 600;
        }
        
        .tabs {
            display: flex;
            justify-content: center;
            background: white;
            border-bottom: 2px solid #e5e7eb;
            padding: 0 20px;
        }
        
        .tab {
            padding: 15px 30px;
            cursor: pointer;
            border: none;
            background: none;
            font-size: 16px;
            font-weight: 500;
            color: #666;
            border-bottom: 3px solid transparent;
            transition: all 0.2s;
        }
        
        .tab:hover {
            color: #667eea;
            background: #f9fafb;
        }
        
        .tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 30px 20px;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .stats-bar {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .stat {
            text-align: center;
        }
        
        .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: 600;
            color: #333;
        }
        
        .post-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: box-shadow 0.2s;
        }
        
        .post-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .post-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .post-type {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .post-type.single {
            background: #dbeafe;
            color: #1e40af;
        }
        
        .post-type.thread {
            background: #fef3c7;
            color: #92400e;
        }
        
        .post-type.reply {
            background: #d1fae5;
            color: #065f46;
        }
        
        .post-content {
            font-size: 15px;
            line-height: 1.6;
            color: #333;
            margin-bottom: 15px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .post-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
        }
        
        .metric {
            text-align: center;
        }
        
        .metric-label {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        
        .metric-value {
            font-size: 20px;
            font-weight: 600;
            color: #333;
        }
        
        .post-meta {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            font-size: 13px;
            color: #666;
            margin-top: 10px;
        }
        
        .meta-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .tweet-link {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        
        .tweet-link:hover {
            text-decoration: underline;
        }
        
        .no-data {
            text-align: center;
            padding: 60px 20px;
            color: #666;
        }
        
        .no-data-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        
        .thread-parts {
            margin-top: 15px;
            padding: 15px;
            background: #f9fafb;
            border-radius: 6px;
            border-left: 3px solid #fbbf24;
        }
        
        .thread-part {
            padding: 10px;
            margin-bottom: 10px;
            background: white;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .thread-part:last-child {
            margin-bottom: 0;
        }
        
        .thread-part-number {
            font-weight: 600;
            color: #92400e;
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 xBOT Dashboard</h1>
    </div>
    
    <div class="tabs">
        <button class="tab active" onclick="showTab('posts')">Posts</button>
        <button class="tab" onclick="showTab('replies')">Replies</button>
    </div>
    
    <div class="container">
        <!-- Posts Tab -->
        <div id="posts-tab" class="tab-content active">
            <div class="stats-bar">
                <div class="stat">
                    <div class="stat-label">Total Posts</div>
                    <div class="stat-value">${posts.length}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Singles</div>
                    <div class="stat-value">${posts.filter(p => p.decision_type === 'single').length}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Threads</div>
                    <div class="stat-value">${posts.filter(p => p.decision_type === 'thread').length}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">With Metrics</div>
                    <div class="stat-value">${posts.filter(p => p.actual_impressions && p.actual_impressions > 0).length}</div>
                </div>
            </div>
            
            ${posts.length === 0 ? `
                <div class="no-data">
                    <div class="no-data-icon">📭</div>
                    <div>No posts found</div>
                </div>
            ` : posts.map(post => `
                <div class="post-card">
                    <div class="post-header">
                        <div>
                            <span class="post-type ${post.decision_type}">${post.decision_type}</span>
                            ${post.tweet_id ? `
                                <a href="https://x.com/SignalAndSynapse/status/${post.tweet_id}" target="_blank" class="tweet-link" style="margin-left: 10px;">
                                    View Tweet →
                                </a>
                            ` : ''}
                        </div>
                        <div style="font-size: 13px; color: #666;">
                            ${post.posted_at ? new Date(post.posted_at).toLocaleString() : 'Not posted'}
                        </div>
                    </div>
                    
                    <div class="post-content">
                        ${post.decision_type === 'thread' && post.thread_parts && Array.isArray(post.thread_parts) ? `
                            <div class="thread-parts">
                                ${post.thread_parts.map((part: string, idx: number) => `
                                    <div class="thread-part">
                                        <span class="thread-part-number">${idx + 1}.</span>
                                        ${escapeHtml(part)}
                                    </div>
                                `).join('')}
                            </div>
                        ` : escapeHtml(post.content || 'No content')}
                    </div>
                    
                    ${(post.actual_impressions || post.actual_likes || post.actual_retweets || post.actual_replies) ? `
                        <div class="post-metrics">
                            ${post.actual_impressions ? `
                                <div class="metric">
                                    <div class="metric-label">Views</div>
                                    <div class="metric-value">${formatNumber(post.actual_impressions)}</div>
                                </div>
                            ` : ''}
                            ${post.actual_likes ? `
                                <div class="metric">
                                    <div class="metric-label">Likes</div>
                                    <div class="metric-value">${formatNumber(post.actual_likes)}</div>
                                </div>
                            ` : ''}
                            ${post.actual_retweets ? `
                                <div class="metric">
                                    <div class="metric-label">Retweets</div>
                                    <div class="metric-value">${formatNumber(post.actual_retweets)}</div>
                                </div>
                            ` : ''}
                            ${post.actual_replies ? `
                                <div class="metric">
                                    <div class="metric-label">Replies</div>
                                    <div class="metric-value">${formatNumber(post.actual_replies)}</div>
                                </div>
                            ` : ''}
                            ${post.actual_engagement_rate ? `
                                <div class="metric">
                                    <div class="metric-label">Engagement</div>
                                    <div class="metric-value">${(post.actual_engagement_rate * 100).toFixed(2)}%</div>
                                </div>
                            ` : ''}
                        </div>
                    ` : `
                        <div style="padding: 15px; background: #fef3c7; border-radius: 6px; color: #92400e; text-align: center;">
                            ⏳ Metrics not yet scraped
                        </div>
                    `}
                    
                    <div class="post-meta">
                        <div class="meta-item">
                            <strong>ID:</strong> ${post.decision_id?.substring(0, 8)}...
                        </div>
                        ${post.tweet_id ? `
                            <div class="meta-item">
                                <strong>Tweet ID:</strong> ${post.tweet_id}
                            </div>
                        ` : ''}
                        ${post.topic_cluster ? `
                            <div class="meta-item">
                                <strong>Topic:</strong> ${post.topic_cluster}
                            </div>
                        ` : ''}
                        ${post.bandit_arm ? `
                            <div class="meta-item">
                                <strong>Bandit Arm:</strong> ${post.bandit_arm}
                            </div>
                        ` : ''}
                        ${post.created_at ? `
                            <div class="meta-item">
                                <strong>Created:</strong> ${new Date(post.created_at).toLocaleString()}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <!-- Replies Tab -->
        <div id="replies-tab" class="tab-content">
            <div class="stats-bar">
                <div class="stat">
                    <div class="stat-label">Total Replies</div>
                    <div class="stat-value">${replies.length}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Posted</div>
                    <div class="stat-value">${replies.filter(r => r.status === 'posted').length}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Queued</div>
                    <div class="stat-value">${replies.filter(r => r.status === 'queued').length}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">With Metrics</div>
                    <div class="stat-value">${replies.filter(r => r.actual_impressions && r.actual_impressions > 0).length}</div>
                </div>
            </div>
            
            ${replies.length === 0 ? `
                <div class="no-data">
                    <div class="no-data-icon">💬</div>
                    <div>No replies found</div>
                </div>
            ` : replies.map(reply => `
                <div class="post-card">
                    <div class="post-header">
                        <div>
                            <span class="post-type reply">Reply</span>
                            ${reply.tweet_id ? `
                                <a href="https://x.com/SignalAndSynapse/status/${reply.tweet_id}" target="_blank" class="tweet-link" style="margin-left: 10px;">
                                    View Tweet →
                                </a>
                            ` : ''}
                            ${reply.target_username ? `
                                <span style="margin-left: 10px; color: #666; font-size: 13px;">
                                    → @${reply.target_username}
                                </span>
                            ` : ''}
                        </div>
                        <div style="font-size: 13px; color: #666;">
                            ${reply.posted_at ? new Date(reply.posted_at).toLocaleString() : 'Not posted'}
                        </div>
                    </div>
                    
                    <div class="post-content">
                        ${escapeHtml(reply.content || 'No content')}
                    </div>
                    
                    ${(reply.actual_impressions || reply.actual_likes || reply.actual_retweets || reply.actual_replies) ? `
                        <div class="post-metrics">
                            ${reply.actual_impressions ? `
                                <div class="metric">
                                    <div class="metric-label">Views</div>
                                    <div class="metric-value">${formatNumber(reply.actual_impressions)}</div>
                                </div>
                            ` : ''}
                            ${reply.actual_likes ? `
                                <div class="metric">
                                    <div class="metric-label">Likes</div>
                                    <div class="metric-value">${formatNumber(reply.actual_likes)}</div>
                                </div>
                            ` : ''}
                            ${reply.actual_retweets ? `
                                <div class="metric">
                                    <div class="metric-label">Retweets</div>
                                    <div class="metric-value">${formatNumber(reply.actual_retweets)}</div>
                                </div>
                            ` : ''}
                            ${reply.actual_replies ? `
                                <div class="metric">
                                    <div class="metric-label">Replies</div>
                                    <div class="metric-value">${formatNumber(reply.actual_replies)}</div>
                                </div>
                            ` : ''}
                            ${reply.actual_engagement_rate ? `
                                <div class="metric">
                                    <div class="metric-label">Engagement</div>
                                    <div class="metric-value">${(reply.actual_engagement_rate * 100).toFixed(2)}%</div>
                                </div>
                            ` : ''}
                        </div>
                    ` : `
                        <div style="padding: 15px; background: #fef3c7; border-radius: 6px; color: #92400e; text-align: center;">
                            ⏳ Metrics not yet scraped
                        </div>
                    `}
                    
                    <div class="post-meta">
                        <div class="meta-item">
                            <strong>ID:</strong> ${reply.decision_id?.substring(0, 8)}...
                        </div>
                        ${reply.tweet_id ? `
                            <div class="meta-item">
                                <strong>Tweet ID:</strong> ${reply.tweet_id}
                            </div>
                        ` : ''}
                        ${reply.target_tweet_id ? `
                            <div class="meta-item">
                                <strong>Target Tweet:</strong> ${reply.target_tweet_id}
                            </div>
                        ` : ''}
                        ${reply.target_username ? `
                            <div class="meta-item">
                                <strong>Target User:</strong> @${reply.target_username}
                            </div>
                        ` : ''}
                        ${reply.status ? `
                            <div class="meta-item">
                                <strong>Status:</strong> ${reply.status}
                            </div>
                        ` : ''}
                        ${reply.created_at ? `
                            <div class="meta-item">
                                <strong>Created:</strong> ${new Date(reply.created_at).toLocaleString()}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
    
    <script>
        function showTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Remove active class from all buttons
            document.querySelectorAll('.tab').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabName + '-tab').classList.add('active');
            
            // Add active class to clicked button
            event.target.classList.add('active');
        }
    </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

