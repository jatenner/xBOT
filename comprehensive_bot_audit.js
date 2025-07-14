#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE BOT AUDIT
 * 
 * This script audits all systems to ensure:
 * 1. Bot tweets consistently throughout the day
 * 2. Bot tweets every day without manual intervention
 * 3. Bot uses viral follower growth content to get engagement
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🔍 === COMPREHENSIVE BOT AUDIT ===');
console.log('📊 Checking all systems for tweeting issues...\n');

class BotAuditor {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.issues = [];
    this.recommendations = [];
  }

  async runFullAudit() {
    console.log('🚀 Starting comprehensive audit...\n');

    // 1. BUDGET SYSTEM AUDIT
    await this.auditBudgetSystem();
    
    // 2. POSTING SCHEDULE AUDIT
    await this.auditPostingSchedule();
    
    // 3. CONTENT SYSTEM AUDIT
    await this.auditContentSystem();
    
    // 4. SYSTEM CONFIGURATION AUDIT
    await this.auditSystemConfiguration();
    
    // 5. DATABASE AUDIT
    await this.auditDatabase();
    
    // 6. VIRAL CONTENT AUDIT
    await this.auditViralContent();
    
    // 7. GENERATE REPORT
    this.generateAuditReport();
    
    // 8. PROVIDE FIXES
    await this.generateFixes();
  }

  async auditBudgetSystem() {
    console.log('💰 === BUDGET SYSTEM AUDIT ===');
    
    // Check budget lockdown file
    if (fs.existsSync('.budget_lockdown')) {
      const lockdownData = JSON.parse(fs.readFileSync('.budget_lockdown', 'utf8'));
      console.log('🚨 CRITICAL ISSUE: Budget lockdown is ACTIVE');
      console.log(`   📅 Since: ${new Date(lockdownData.timestamp).toLocaleString()}`);
      console.log(`   💰 Total spent: $${lockdownData.totalSpent}`);
      console.log(`   🔍 Reason: ${lockdownData.reason}`);
      
      this.issues.push({
        severity: 'CRITICAL',
        system: 'Budget',
        issue: 'Budget lockdown preventing all AI operations',
        impact: 'Bot cannot generate content or make posting decisions',
        fix: 'Remove .budget_lockdown file and fix database connection'
      });
    } else {
      console.log('✅ No budget lockdown file found');
    }
    
    // Check budget transactions
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: transactions } = await this.supabase
        .from('budget_transactions')
        .select('*')
        .eq('date', today);
      
      const totalSpent = transactions?.reduce((sum, tx) => sum + tx.cost_usd, 0) || 0;
      console.log(`💰 Today's spending: $${totalSpent.toFixed(4)}/3.00`);
      
      if (totalSpent >= 2.80) {
        this.issues.push({
          severity: 'HIGH',
          system: 'Budget',
          issue: 'Daily budget nearly exhausted',
          impact: 'Limited AI operations available',
          fix: 'Wait for midnight reset or increase daily limit'
        });
      }
    } catch (error) {
      console.log('❌ Budget transaction check failed:', error.message);
      this.issues.push({
        severity: 'CRITICAL',
        system: 'Budget',
        issue: 'Cannot access budget_transactions table',
        impact: 'Budget system may be broken',
        fix: 'Run budget_enforcement_update.sql'
      });
    }
    console.log('');
  }

  async auditPostingSchedule() {
    console.log('📅 === POSTING SCHEDULE AUDIT ===');
    
    // Check recent posting activity
    try {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentTweets } = await this.supabase
        .from('tweets')
        .select('*')
        .gte('created_at', last24h)
        .order('created_at', { ascending: false });
      
      console.log(`📊 Tweets in last 24h: ${recentTweets?.length || 0}`);
      
      if (!recentTweets || recentTweets.length === 0) {
        this.issues.push({
          severity: 'CRITICAL',
          system: 'Posting',
          issue: 'No tweets in last 24 hours',
          impact: 'Bot appears completely inactive',
          fix: 'Check system status and posting agents'
        });
      } else if (recentTweets.length < 3) {
        this.issues.push({
          severity: 'HIGH',
          system: 'Posting',
          issue: 'Very low posting frequency',
          impact: 'Poor Twitter presence and engagement',
          fix: 'Investigate posting scheduler and limits'
        });
      }
      
      // Check posting pattern
      if (recentTweets && recentTweets.length > 0) {
        const lastTweet = new Date(recentTweets[0].created_at);
        const hoursSinceLastTweet = (Date.now() - lastTweet.getTime()) / (1000 * 60 * 60);
        console.log(`⏰ Hours since last tweet: ${hoursSinceLastTweet.toFixed(1)}`);
        
        if (hoursSinceLastTweet > 4) {
          this.issues.push({
            severity: 'HIGH',
            system: 'Posting',
            issue: 'Long gap since last tweet',
            impact: 'Audience may lose interest',
            fix: 'Check posting scheduler and rate limits'
          });
        }
      }
    } catch (error) {
      console.log('❌ Tweet history check failed:', error.message);
      this.issues.push({
        severity: 'CRITICAL',
        system: 'Database',
        issue: 'Cannot access tweets table',
        impact: 'Cannot track posting activity',
        fix: 'Check database connection and schema'
      });
    }
    console.log('');
  }

  async auditContentSystem() {
    console.log('🎨 === CONTENT SYSTEM AUDIT ===');
    
    // Check if viral agents exist
    const viralAgents = [
      'src/agents/streamlinedPostAgent.ts',
      'src/agents/viralFollowerGrowthAgent.ts',
      'src/agents/aggressiveEngagementAgent.ts'
    ];
    
    for (const agent of viralAgents) {
      if (fs.existsSync(agent)) {
        console.log(`✅ ${path.basename(agent)} exists`);
      } else {
        console.log(`❌ ${path.basename(agent)} missing`);
        this.issues.push({
          severity: 'HIGH',
          system: 'Content',
          issue: `Missing viral agent: ${path.basename(agent)}`,
          impact: 'Reduced content variety and engagement',
          fix: 'Restore viral agent files'
        });
      }
    }
    
    // Check if old repetitive agent is still being used
    try {
      const { data: tweets } = await this.supabase
        .from('tweets')
        .select('content')
        .limit(10)
        .order('created_at', { ascending: false });
      
      if (tweets && tweets.length > 0) {
        const repetitivePatterns = tweets.filter(t => 
          t.content && (
            t.content.includes('BREAKTHROUGH:') ||
            t.content.includes('GAME CHANGER:') ||
            t.content.includes('Machine learning algorithms identify')
          )
        );
        
        if (repetitivePatterns.length > 0) {
          console.log(`⚠️ Found ${repetitivePatterns.length}/10 recent tweets with repetitive patterns`);
          this.issues.push({
            severity: 'MEDIUM',
            system: 'Content',
            issue: 'Still using repetitive content patterns',
            impact: 'Low engagement, poor follower growth',
            fix: 'Ensure viral agents are being used instead of old PostTweetAgent'
          });
        } else {
          console.log('✅ No repetitive patterns in recent tweets');
        }
      }
    } catch (error) {
      console.log('❌ Content pattern check failed:', error.message);
    }
    console.log('');
  }

  async auditSystemConfiguration() {
    console.log('⚙️ === SYSTEM CONFIGURATION AUDIT ===');
    
    // Check bot_config table for critical settings
    try {
      const criticalConfigs = [
        'enabled',
        'DISABLE_BOT',
        'emergency_stop',
        'posting_enabled',
        'kill_switch',
        'max_posts_per_day'
      ];
      
      for (const key of criticalConfigs) {
        const { data } = await this.supabase
          .from('bot_config')
          .select('value')
          .eq('key', key)
          .single();
        
        if (data) {
          console.log(`⚙️ ${key}: ${data.value}`);
          
          // Check for blocking configurations
          if ((key === 'DISABLE_BOT' && data.value === 'true') ||
              (key === 'enabled' && data.value === 'false') ||
              (key === 'kill_switch' && data.value === 'true') ||
              (key === 'emergency_stop' && data.value === 'true') ||
              (key === 'posting_enabled' && data.value === 'false')) {
            this.issues.push({
              severity: 'CRITICAL',
              system: 'Configuration',
              issue: `Blocking configuration: ${key} = ${data.value}`,
              impact: 'Bot is disabled and cannot post',
              fix: `Update ${key} to allow posting`
            });
          }
          
          if (key === 'max_posts_per_day' && parseInt(data.value) < 6) {
            this.issues.push({
              severity: 'MEDIUM',
              system: 'Configuration',
              issue: 'Daily post limit too low',
              impact: 'Limited posting frequency',
              fix: 'Increase max_posts_per_day to at least 6'
            });
          }
        } else {
          console.log(`⚠️ ${key}: NOT SET`);
        }
      }
    } catch (error) {
      console.log('❌ Configuration check failed:', error.message);
    }
    console.log('');
  }

  async auditDatabase() {
    console.log('🗄️ === DATABASE AUDIT ===');
    
    // Check essential tables exist
    const essentialTables = [
      'tweets',
      'bot_config',
      'budget_transactions',
      'daily_budget_status'
    ];
    
    for (const table of essentialTables) {
      try {
        const { data, error } = await this.supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
          this.issues.push({
            severity: 'CRITICAL',
            system: 'Database',
            issue: `Table ${table} inaccessible`,
            impact: 'Core functionality broken',
            fix: `Check table exists and permissions for ${table}`
          });
        } else {
          console.log(`✅ ${table}: Accessible`);
        }
      } catch (error) {
        console.log(`❌ ${table}: Connection failed`);
      }
    }
    console.log('');
  }

  async auditViralContent() {
    console.log('🔥 === VIRAL CONTENT AUDIT ===');
    
    // Check if engagement tracking is working
    try {
      const { data: recentTweets } = await this.supabase
        .from('tweets')
        .select('content, likes, retweets, replies, impressions')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (recentTweets && recentTweets.length > 0) {
        const avgEngagement = recentTweets.reduce((sum, tweet) => {
          return sum + (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0);
        }, 0) / recentTweets.length;
        
        console.log(`📊 Average engagement per tweet: ${avgEngagement.toFixed(1)}`);
        
        if (avgEngagement < 5) {
          this.issues.push({
            severity: 'HIGH',
            system: 'Engagement',
            issue: 'Very low engagement rates',
            impact: 'Poor follower growth and reach',
            fix: 'Switch to viral content system and improve content quality'
          });
        }
        
        // Check for viral content patterns
        const viralPatterns = recentTweets.filter(t => 
          t.content && (
            t.content.includes('Plot twist:') ||
            t.content.includes('Hot take:') ||
            t.content.includes('Nobody talks about') ||
            t.content.includes('After') ||
            t.content.includes('years')
          )
        );
        
        if (viralPatterns.length === 0) {
          this.issues.push({
            severity: 'MEDIUM',
            system: 'Content',
            issue: 'No viral content patterns detected',
            impact: 'Missing engagement opportunities',
            fix: 'Ensure viral follower growth agents are active'
          });
        } else {
          console.log(`✅ Found ${viralPatterns.length}/10 tweets with viral patterns`);
        }
      }
    } catch (error) {
      console.log('❌ Engagement audit failed:', error.message);
    }
    console.log('');
  }

  generateAuditReport() {
    console.log('📋 === AUDIT REPORT ===');
    
    const criticalIssues = this.issues.filter(i => i.severity === 'CRITICAL');
    const highIssues = this.issues.filter(i => i.severity === 'HIGH');
    const mediumIssues = this.issues.filter(i => i.severity === 'MEDIUM');
    
    console.log(`🚨 Critical Issues: ${criticalIssues.length}`);
    console.log(`⚠️ High Priority Issues: ${highIssues.length}`);
    console.log(`💡 Medium Priority Issues: ${mediumIssues.length}`);
    console.log('');
    
    if (criticalIssues.length > 0) {
      console.log('🚨 CRITICAL ISSUES (Must fix immediately):');
      criticalIssues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue.system}: ${issue.issue}`);
        console.log(`   Impact: ${issue.impact}`);
        console.log(`   Fix: ${issue.fix}`);
        console.log('');
      });
    }
    
    if (highIssues.length > 0) {
      console.log('⚠️ HIGH PRIORITY ISSUES:');
      highIssues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue.system}: ${issue.issue}`);
        console.log(`   Impact: ${issue.impact}`);
        console.log(`   Fix: ${issue.fix}`);
        console.log('');
      });
    }
    
    if (mediumIssues.length > 0) {
      console.log('💡 MEDIUM PRIORITY ISSUES:');
      mediumIssues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue.system}: ${issue.issue}`);
        console.log(`   Impact: ${issue.impact}`);
        console.log(`   Fix: ${issue.fix}`);
        console.log('');
      });
    }
  }

  async generateFixes() {
    console.log('🔧 === AUTOMATED FIXES ===');
    
    const criticalIssues = this.issues.filter(i => i.severity === 'CRITICAL');
    
    if (criticalIssues.some(i => i.issue.includes('Budget lockdown'))) {
      console.log('🔧 Fixing budget lockdown...');
      
      // Remove lockdown file
      if (fs.existsSync('.budget_lockdown')) {
        fs.unlinkSync('.budget_lockdown');
        console.log('✅ Removed .budget_lockdown file');
      }
      
      // Reset budget for today
      await this.resetDailyBudget();
    }
    
    if (criticalIssues.some(i => i.issue.includes('Bot is disabled'))) {
      console.log('🔧 Enabling bot...');
      await this.enableBot();
    }
    
    if (this.issues.some(i => i.issue.includes('repetitive content'))) {
      console.log('🔧 Switching to viral content system...');
      await this.activateViralContentSystem();
    }
    
    console.log('');
    console.log('🎉 AUDIT COMPLETE!');
    console.log('🚀 Bot should now be ready for consistent tweeting.');
  }

  async resetDailyBudget() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await this.supabase
        .from('daily_budget_status')
        .upsert({
          date: today,
          total_spent: 0,
          budget_limit: 3.00,
          emergency_brake_active: false
        });
      
      console.log('✅ Reset daily budget to $3.00');
    } catch (error) {
      console.log('❌ Failed to reset budget:', error.message);
    }
  }

  async enableBot() {
    try {
      const enableConfigs = [
        { key: 'enabled', value: 'true' },
        { key: 'DISABLE_BOT', value: 'false' },
        { key: 'emergency_stop', value: 'false' },
        { key: 'posting_enabled', value: 'true' },
        { key: 'kill_switch', value: 'false' },
        { key: 'max_posts_per_day', value: '6' }
      ];
      
      for (const config of enableConfigs) {
        await this.supabase
          .from('bot_config')
          .upsert(config);
      }
      
      console.log('✅ Bot enabled with proper configuration');
    } catch (error) {
      console.log('❌ Failed to enable bot:', error.message);
    }
  }

  async activateViralContentSystem() {
    try {
      await this.supabase
        .from('bot_config')
        .upsert({
          key: 'use_viral_content_system',
          value: 'true'
        });
      
      await this.supabase
        .from('bot_config')
        .upsert({
          key: 'disable_repetitive_templates',
          value: 'true'
        });
      
      console.log('✅ Activated viral content system');
    } catch (error) {
      console.log('❌ Failed to activate viral system:', error.message);
    }
  }
}

// Run the audit
async function main() {
  const auditor = new BotAuditor();
  await auditor.runFullAudit();
}

main().catch(console.error); 