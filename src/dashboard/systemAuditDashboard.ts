/**
 * 🔍 COMPREHENSIVE SYSTEM AUDIT DASHBOARD
 * Deep dive into system health with detailed analysis and fix plans
 */

import { ComprehensiveSystemAudit } from '../diagnostics/comprehensiveSystemAudit';
import { 
  generateNavigation, 
  getSharedStyles, 
  generateErrorHTML, 
  formatTimeAgo,
  TOKEN_PARAM
} from './shared/dashboardUtils';

export async function generateSystemAuditDashboard(): Promise<string> {
  try {
    const audit = ComprehensiveSystemAudit.getInstance();
    const report = await audit.runAudit();
    
    return generateAuditHTML(report);
  } catch (error: any) {
    console.error('[SYSTEM_AUDIT_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message, '/dashboard/business');
  }
}

function generateAuditHTML(report: any): string {
  const { components, criticalIssues, dataFlowIssues, configurationIssues, recommendations, overallHealth } = report;
  const now = new Date().toLocaleString();
  
  const healthColor = overallHealth === 'healthy' ? '#10b981' :
                     overallHealth === 'degraded' ? '#f59e0b' : '#ef4444';
  const healthEmoji = overallHealth === 'healthy' ? '🟢' :
                      overallHealth === 'degraded' ? '🟡' : '🔴';
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>🔍 xBOT System Audit</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="60">
    <style>
        ${getSharedStyles()}
        .audit-header {
            background: linear-gradient(135deg, ${healthColor}15, ${healthColor}05);
            border: 2px solid ${healthColor};
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
        }
        .component-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .component-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 5px solid #e5e7eb;
        }
        .component-card.healthy {
            border-left-color: #10b981;
        }
        .component-card.degraded {
            border-left-color: #f59e0b;
        }
        .component-card.failed {
            border-left-color: #ef4444;
        }
        .component-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .component-name {
            font-weight: 600;
            font-size: 18px;
            color: #333;
        }
        .health-score {
            font-size: 24px;
            font-weight: bold;
            color: ${healthColor};
        }
        .issue-list {
            margin-top: 15px;
        }
        .issue-item {
            padding: 10px;
            background: #f9fafb;
            border-radius: 6px;
            margin-bottom: 8px;
            border-left: 3px solid #e5e7eb;
        }
        .issue-item.critical {
            background: #fee2e2;
            border-left-color: #ef4444;
        }
        .issue-item.high {
            background: #fef3c7;
            border-left-color: #f59e0b;
        }
        .critical-section {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 5px solid #ef4444;
        }
        .fix-plan {
            background: #f0f9ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            border-radius: 6px;
            margin-top: 10px;
        }
        .recommendation-item {
            padding: 12px;
            background: white;
            border-radius: 6px;
            margin-bottom: 10px;
            border-left: 4px solid #3b82f6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 xBOT Comprehensive System Audit</h1>
            <p>Deep analysis of all system components, issues, and fix plans</p>
        </div>

        ${generateNavigation('/dashboard/system-audit')}

        <!-- Overall Health -->
        <div class="audit-header">
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="font-size: 48px;">${healthEmoji}</div>
                <div>
                    <div style="font-size: 28px; font-weight: 600; margin-bottom: 5px;">
                        System Health: ${overallHealth.toUpperCase()}
                    </div>
                    <div style="color: #666; font-size: 16px;">
                        ${components.length} components analyzed • ${criticalIssues.length} critical issues found
                    </div>
                </div>
            </div>
        </div>

        <!-- Critical Issues -->
        ${criticalIssues.length > 0 ? `
        <div class="critical-section">
            <h2 style="margin: 0 0 20px 0; color: #991b1b;">🚨 Critical Issues (${criticalIssues.length})</h2>
            ${criticalIssues.map((issue: any, index: number) => `
                <div style="margin-bottom: 20px; padding: 15px; background: #fee2e2; border-radius: 8px;">
                    <div style="font-weight: 600; color: #991b1b; margin-bottom: 8px;">
                        ${index + 1}. ${issue.component}: ${issue.issue}
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>Root Cause:</strong> ${issue.rootCause}
                    </div>
                    <div class="fix-plan">
                        <strong>Fix:</strong> ${issue.fix}
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- Component Analysis -->
        <h2 style="margin-bottom: 20px;">⚙️ Component Analysis</h2>
        <div class="component-grid">
            ${components.map((component: any) => {
              const statusColor = component.status === 'healthy' ? '#10b981' :
                                 component.status === 'degraded' ? '#f59e0b' : '#ef4444';
              return `
                <div class="component-card ${component.status}">
                    <div class="component-header">
                        <div>
                            <div class="component-name">${component.name}</div>
                            <div style="font-size: 12px; color: #666; margin-top: 4px;">
                                ${component.type} • ${component.impact} impact
                            </div>
                        </div>
                        <div class="health-score" style="color: ${statusColor};">
                            ${Math.round(component.healthScore)}%
                        </div>
                    </div>
                    
                    <div style="font-size: 13px; color: #666; margin-bottom: 15px;">
                        ${component.lastSuccess 
                          ? `✅ Last success: ${formatTimeAgo(component.lastSuccess)}<br/>`
                          : '❌ Never succeeded<br/>'}
                        ${component.consecutiveFailures > 0 
                          ? `<span style="color: #ef4444;">⚠️ ${component.consecutiveFailures} consecutive failures</span><br/>`
                          : ''}
                        ${component.expectedInterval 
                          ? `🔄 Expected interval: ${component.expectedInterval} min<br/>`
                          : ''}
                    </div>
                    
                    ${component.issues.length > 0 ? `
                        <div class="issue-list">
                            <div style="font-weight: 600; margin-bottom: 10px; color: #333;">
                                Issues (${component.issues.length}):
                            </div>
                            ${component.issues.map((issue: any) => `
                                <div class="issue-item ${issue.severity}">
                                    <div style="font-weight: 600; margin-bottom: 4px; color: ${issue.severity === 'critical' ? '#991b1b' : '#92400e'};">
                                        ${issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟡' : '🔵'} ${issue.severity.toUpperCase()}
                                    </div>
                                    <div style="font-size: 13px; margin-bottom: 4px;">${issue.description}</div>
                                    ${issue.rootCause ? `
                                        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                                            <strong>Root Cause:</strong> ${issue.rootCause}
                                        </div>
                                    ` : ''}
                                    ${issue.fix ? `
                                        <div style="font-size: 12px; color: #3b82f6;">
                                            <strong>Fix:</strong> ${issue.fix}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div style="color: #10b981; font-weight: 600;">✅ No issues</div>'}
                </div>
              `;
            }).join('')}
        </div>

        <!-- Data Flow Issues -->
        ${dataFlowIssues.length > 0 ? `
        <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="margin: 0 0 15px 0;">🔄 Data Flow Issues</h2>
            ${dataFlowIssues.map((issue: any) => `
                <div style="padding: 12px; background: #fef3c7; border-radius: 6px; margin-bottom: 10px; border-left: 4px solid #f59e0b;">
                    <div style="font-weight: 600; margin-bottom: 4px;">${issue.stage}</div>
                    <div style="font-size: 13px; margin-bottom: 4px;">${issue.issue}</div>
                    <div style="font-size: 12px; color: #666;">Impact: ${issue.impact}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- Configuration Issues -->
        ${configurationIssues.length > 0 ? `
        <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="margin: 0 0 15px 0;">⚙️ Configuration Issues</h2>
            ${configurationIssues.map((issue: any) => `
                <div style="padding: 12px; background: #fee2e2; border-radius: 6px; margin-bottom: 10px; border-left: 4px solid #ef4444;">
                    <div style="font-weight: 600; margin-bottom: 4px;">${issue.setting}</div>
                    <div style="font-size: 13px;">
                        Current: <strong>${issue.currentValue}</strong> → Expected: <strong>${issue.expectedValue}</strong>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">Impact: ${issue.impact}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- Recommendations -->
        ${recommendations.length > 0 ? `
        <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="margin: 0 0 15px 0;">💡 Recommendations</h2>
            ${recommendations.slice(0, 10).map((rec: any) => `
                <div class="recommendation-item">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div style="font-weight: 600; color: #333;">Priority ${rec.priority}: ${rec.action}</div>
                        <div style="font-size: 12px; color: #666; padding: 4px 8px; background: #f3f4f6; border-radius: 4px;">
                            ${rec.effort} effort
                        </div>
                    </div>
                    <div style="font-size: 13px; color: #666;">Expected Impact: ${rec.expectedImpact}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px; padding: 20px;">
            ⚡ Auto-refresh every 60 seconds • Last updated: ${now}
        </div>
    </div>
</body>
</html>`;
}

