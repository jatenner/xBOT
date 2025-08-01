/**
 * 🚨 INTELLIGENT ALERTING SYSTEM
 * Monitors system health and sends smart alerts
 * Integrates with existing SystemHealth monitoring
 */

import { supabaseClient } from './supabaseClient';
import { SystemHealth } from '../core/masterAutonomousController';

export interface AlertConfig {
  webhookUrl?: string;
  slackChannel?: string;
  discordWebhook?: string;
  emailRecipients?: string[];
  enabledSeverities: ('info' | 'warning' | 'error' | 'critical')[];
}

export interface Alert {
  id?: string;
  type: 'session_missing' | 'budget_high' | 'follower_drop' | 'posting_failure' | 'system_degraded';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  triggeredAt: Date;
}

export class IntelligentAlerting {
  private static instance: IntelligentAlerting;
  private config: AlertConfig;
  private recentAlerts: Map<string, Date> = new Map();
  private alertCooldowns: Map<string, number> = new Map();

  private constructor() {
    this.config = this.loadAlertConfig();
    this.setupAlertCooldowns();
  }

  static getInstance(): IntelligentAlerting {
    if (!IntelligentAlerting.instance) {
      IntelligentAlerting.instance = new IntelligentAlerting();
    }
    return IntelligentAlerting.instance;
  }

  /**
   * 🚨 Create and send intelligent alert
   */
  async sendAlert(alert: Alert): Promise<void> {
    try {
      // Check if this alert type is on cooldown
      if (this.isOnCooldown(alert.type)) {
        console.log(`⏰ Alert ${alert.type} is on cooldown, skipping`);
        return;
      }

      // Store alert in database
      const alertId = await this.storeAlert(alert);
      alert.id = alertId?.toString();

      // Send to configured channels
      await this.dispatchAlert(alert);

      // Update cooldown
      this.updateCooldown(alert.type);

      console.log(`🚨 Alert sent: ${alert.title} (${alert.severity})`);

    } catch (error) {
      console.error('❌ Error sending alert:', error);
    }
  }

  /**
   * 📊 Analyze system health and generate appropriate alerts
   */
  async analyzeSystemHealth(health: SystemHealth): Promise<void> {
    try {
      // Check for session issues
      if (health.components.browser?.status === 'error') {
        await this.sendAlert({
          type: 'session_missing',
          severity: 'error',
          title: '🔑 Twitter Session Missing',
          message: 'Browser automation failed - Twitter session may be expired or missing',
          metadata: { component: 'browser', status: health.components.browser.status },
          triggeredAt: new Date()
        });
      }

      // Check budget utilization
      if (health.performance.budgetUtilization > 80) {
        const severity = health.performance.budgetUtilization > 95 ? 'critical' : 'warning';
        await this.sendAlert({
          type: 'budget_high',
          severity,
          title: `💰 Budget Alert: ${Math.round(health.performance.budgetUtilization)}% Used`,
          message: `Daily budget is ${Math.round(health.performance.budgetUtilization)}% utilized. Consider reducing AI calls.`,
          metadata: { budgetUtilization: health.performance.budgetUtilization },
          triggeredAt: new Date()
        });
      }

      // Check follower growth
      if (health.performance.followerGrowth24h < -5) {
        await this.sendAlert({
          type: 'follower_drop',
          severity: 'warning',
          title: `📉 Follower Drop: ${health.performance.followerGrowth24h}`,
          message: `Lost ${Math.abs(health.performance.followerGrowth24h)} followers in 24h. Content strategy may need adjustment.`,
          metadata: { followerGrowth24h: health.performance.followerGrowth24h },
          triggeredAt: new Date()
        });
      }

      // Check overall system health
      if (health.overall === 'critical' || health.overall === 'degraded') {
        await this.sendAlert({
          type: 'system_degraded',
          severity: health.overall === 'critical' ? 'critical' : 'warning',
          title: `🚨 System Health: ${health.overall.toUpperCase()}`,
          message: `Overall system health is ${health.overall}. Multiple components may need attention.`,
          metadata: { 
            overall: health.overall, 
            components: Object.keys(health.components).filter(k => 
              health.components[k].status === 'error' || health.components[k].status === 'warning'
            )
          },
          triggeredAt: new Date()
        });
      }

    } catch (error) {
      console.error('❌ Error analyzing system health for alerts:', error);
    }
  }

  /**
   * 📈 Send positive alerts for achievements
   */
  async sendSuccessAlert(type: 'viral_tweet' | 'follower_milestone' | 'engagement_spike', data: any): Promise<void> {
    const alerts = {
      viral_tweet: {
        title: '🚀 Viral Tweet Alert!',
        message: `Tweet achieved ${data.likes} likes and ${data.retweets} retweets in ${data.hours} hours!`,
        severity: 'info' as const
      },
      follower_milestone: {
        title: `🎉 Follower Milestone: ${data.followers}!`,
        message: `Account reached ${data.followers} followers! Growth rate: +${data.dailyGrowth}/day`,
        severity: 'info' as const
      },
      engagement_spike: {
        title: '📈 Engagement Spike Detected',
        message: `Engagement rate jumped to ${data.rate}% (${data.increase}x increase)`,
        severity: 'info' as const
      }
    };

    const alertTemplate = alerts[type];
    await this.sendAlert({
      type: 'posting_failure', // Reuse type for now
      severity: alertTemplate.severity,
      title: alertTemplate.title,
      message: alertTemplate.message,
      metadata: data,
      triggeredAt: new Date()
    });
  }

  /**
   * 💾 Store alert in database
   */
  private async storeAlert(alert: Alert): Promise<number | null> {
    try {
      const { data, error } = await supabaseClient.rpc('create_system_alert', {
        p_alert_type: alert.type,
        p_severity: alert.severity,
        p_title: alert.title,
        p_message: alert.message,
        p_metadata: alert.metadata ? JSON.stringify(alert.metadata) : null
      });

      if (error) {
        console.error('❌ Error storing alert:', error);
        return null;
      }

      return data;

    } catch (error) {
      console.error('❌ Error storing alert in database:', error);
      return null;
    }
  }

  /**
   * 📤 Dispatch alert to configured channels
   */
  private async dispatchAlert(alert: Alert): Promise<void> {
    // Skip info alerts unless explicitly enabled
    if (alert.severity === 'info' && !this.config.enabledSeverities.includes('info')) {
      return;
    }

    const promises: Promise<void>[] = [];

    // Slack notification
    if (this.config.slackChannel && this.config.webhookUrl) {
      promises.push(this.sendSlackAlert(alert));
    }

    // Discord notification
    if (this.config.discordWebhook) {
      promises.push(this.sendDiscordAlert(alert));
    }

    // Console logging (always enabled)
    this.logAlert(alert);

    // Wait for all notifications to complete
    await Promise.allSettled(promises);
  }

  /**
   * 📱 Send Slack alert
   */
  private async sendSlackAlert(alert: Alert): Promise<void> {
    try {
      const emoji = this.getSeverityEmoji(alert.severity);
      const color = this.getSeverityColor(alert.severity);

      const payload = {
        channel: this.config.slackChannel,
        username: 'xBot Monitor',
        icon_emoji: ':robot_face:',
        attachments: [{
          color,
          title: `${emoji} ${alert.title}`,
          text: alert.message,
          fields: alert.metadata ? Object.entries(alert.metadata).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true
          })) : [],
          footer: 'xBot Monitoring',
          ts: Math.floor(alert.triggeredAt.getTime() / 1000)
        }]
      };

      const response = await fetch(this.config.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error('❌ Slack alert failed:', response.statusText);
      }

    } catch (error) {
      console.error('❌ Error sending Slack alert:', error);
    }
  }

  /**
   * 🟦 Send Discord alert
   */
  private async sendDiscordAlert(alert: Alert): Promise<void> {
    try {
      const emoji = this.getSeverityEmoji(alert.severity);
      const color = parseInt(this.getSeverityColor(alert.severity).replace('#', ''), 16);

      const payload = {
        embeds: [{
          title: `${emoji} ${alert.title}`,
          description: alert.message,
          color,
          fields: alert.metadata ? Object.entries(alert.metadata).map(([key, value]) => ({
            name: key,
            value: String(value),
            inline: true
          })) : [],
          footer: {
            text: 'xBot Monitoring'
          },
          timestamp: alert.triggeredAt.toISOString()
        }]
      };

      const response = await fetch(this.config.discordWebhook!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error('❌ Discord alert failed:', response.statusText);
      }

    } catch (error) {
      console.error('❌ Error sending Discord alert:', error);
    }
  }

  /**
   * 📝 Log alert to console
   */
  private logAlert(alert: Alert): void {
    const emoji = this.getSeverityEmoji(alert.severity);
    const timestamp = alert.triggeredAt.toISOString();
    
    console.log(`${emoji} [${timestamp}] ${alert.title}`);
    console.log(`   ${alert.message}`);
    
    if (alert.metadata) {
      console.log(`   Metadata:`, alert.metadata);
    }
  }

  /**
   * 🔧 Helper methods
   */
  private loadAlertConfig(): AlertConfig {
    return {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      slackChannel: process.env.SLACK_CHANNEL || '#alerts',
      discordWebhook: process.env.DISCORD_WEBHOOK_URL,
      enabledSeverities: ['warning', 'error', 'critical'] // Skip info by default
    };
  }

  private setupAlertCooldowns(): void {
    // Set cooldown periods (in minutes) for different alert types
    this.alertCooldowns.set('session_missing', 30);
    this.alertCooldowns.set('budget_high', 60);
    this.alertCooldowns.set('follower_drop', 120);
    this.alertCooldowns.set('posting_failure', 15);
    this.alertCooldowns.set('system_degraded', 30);
  }

  private isOnCooldown(alertType: string): boolean {
    const lastSent = this.recentAlerts.get(alertType);
    if (!lastSent) return false;

    const cooldownMinutes = this.alertCooldowns.get(alertType) || 60;
    const cooldownMs = cooldownMinutes * 60 * 1000;
    
    return Date.now() - lastSent.getTime() < cooldownMs;
  }

  private updateCooldown(alertType: string): void {
    this.recentAlerts.set(alertType, new Date());
  }

  private getSeverityEmoji(severity: string): string {
    const emojis = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨'
    };
    return emojis[severity as keyof typeof emojis] || '📢';
  }

  private getSeverityColor(severity: string): string {
    const colors = {
      info: '#36a64f',
      warning: '#ff9500',
      error: '#ff4444',
      critical: '#ff0000'
    };
    return colors[severity as keyof typeof colors] || '#999999';
  }
}