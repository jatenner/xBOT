/**
 * Dashboard Writer
 * Generates tomorrow's planned posts and saves to bot_dashboard table
 */

import { supabaseClient } from '../utils/supabaseClient';
import { DynamicPostingController } from '../utils/dynamicPostingController';
import { getConfig } from '../utils/botConfig';
import { monthlyBudgetManager } from '../utils/monthlyBudgetManager';

interface PlannedPost {
  time: string;
  content_type: string;
  priority: number;
  reasoning: string;
  estimated_engagement?: number;
}

export class DashboardWriter {
  private dynamicController: DynamicPostingController;

  constructor() {
    this.dynamicController = new DynamicPostingController();
  }

  async publish(): Promise<void> {
    console.log('📝 === DASHBOARD WRITER STARTED ===');
    
    try {
      // Generate tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDate = tomorrow.toISOString().split('T')[0];
      
      console.log(`📅 Generating planned posts for ${tomorrowDate}`);
      
      // Get planned posts for tomorrow
      const plannedPosts = await this.getPlannedPostsForTomorrow();
      
      if (plannedPosts.length === 0) {
        console.log('📭 No planned posts generated for tomorrow');
        return;
      }

      console.log(`📊 Generated ${plannedPosts.length} planned posts for tomorrow`);
      
      // Upsert to bot_dashboard table
      const { error } = await supabaseClient.supabase
        ?.from('bot_dashboard')
        .upsert({
          date: tomorrowDate,
          planned_posts_json: plannedPosts,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'date'
        });

      if (error) {
        console.error('❌ Error saving planned posts to dashboard:', error);
        return;
      }

      console.log(`✅ Dashboard updated successfully for ${tomorrowDate}`);
      console.log(`📋 Summary:`);
      console.log(`   📝 Total posts planned: ${plannedPosts.length}`);
      
      // Log post types breakdown
      const postTypes = plannedPosts.reduce((acc: any, post) => {
        acc[post.content_type] = (acc[post.content_type] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(postTypes).forEach(([type, count]) => {
        console.log(`   📊 ${type}: ${count} posts`);
      });

      // Log peak posting times
      const peakHours = plannedPosts
        .map(post => new Date(post.time).getUTCHours())
        .reduce((acc: any, hour) => {
          acc[hour] = (acc[hour] || 0) + 1;
          return acc;
        }, {});
      
      const topHour = Object.entries(peakHours)
        .sort(([,a]: any, [,b]: any) => b - a)[0];
      
      if (topHour) {
        console.log(`   🕐 Peak posting hour: ${topHour[0]}:00 UTC (${topHour[1]} posts)`);
      }

    } catch (error) {
      console.error('❌ Dashboard writer failed:', error);
    }
  }

  async getPlannedPostsForTomorrow(): Promise<PlannedPost[]> {
    const plannedPosts: PlannedPost[] = [];
    
    try {
      // Get bot configuration for tomorrow's strategy
      const postingStrategy = await getConfig('posting_strategy', 'intelligent_monthly_budget');
      
      // Get intelligent daily target from monthly budget manager
      const budgetCalculation = await monthlyBudgetManager.getIntelligentDailyTarget();
      const dailyTarget = budgetCalculation.final_target;
      
      console.log(`🎯 Strategy: ${postingStrategy}`);
      console.log(`📊 Intelligent Daily Target: ${dailyTarget} posts`);
      console.log(`💡 Reasoning: ${budgetCalculation.reasoning}`);
      
      // Get monthly budget status for context
      const monthlyStatus = await monthlyBudgetManager.getMonthlyStatus();
      console.log(`📈 Monthly Budget: ${monthlyStatus.used}/${monthlyStatus.budget} tweets (${(monthlyStatus.utilization * 100).toFixed(1)}%)`);
      console.log(`📅 Days Remaining: ${monthlyStatus.daysLeft}`);
      
      // Generate posting schedule for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Dynamic posting windows based on intelligent target
      const baseWindows = [
        { start: 9, end: 10, ratio: 0.12, priority: 3, type: 'morning_startup' },
        { start: 11, end: 12, ratio: 0.15, priority: 3, type: 'late_morning' },
        { start: 13, end: 14, ratio: 0.18, priority: 4, type: 'lunch_peak' },
        { start: 15, end: 16, ratio: 0.20, priority: 4, type: 'afternoon_peak' },
        { start: 17, end: 18, ratio: 0.15, priority: 3, type: 'evening_start' },
        { start: 19, end: 20, ratio: 0.20, priority: 4, type: 'evening_prime' }
      ];
      
      // Calculate posts per window based on daily target
      const postingWindows = baseWindows.map(window => ({
        ...window,
        posts: Math.max(1, Math.ceil(dailyTarget * window.ratio))
      }));

      // Adjust to hit exact target
      const totalPlanned = postingWindows.reduce((sum, window) => sum + window.posts, 0);
      if (totalPlanned !== dailyTarget) {
        const difference = dailyTarget - totalPlanned;
        // Distribute difference across high-priority windows
        const highPriorityWindows = postingWindows.filter(w => w.priority === 4);
        if (highPriorityWindows.length > 0) {
          const perWindow = Math.ceil(Math.abs(difference) / highPriorityWindows.length);
          for (let i = 0; i < Math.abs(difference); i++) {
            const windowIndex = i % highPriorityWindows.length;
            const window = highPriorityWindows[windowIndex];
            window.posts += difference > 0 ? 1 : -1;
            window.posts = Math.max(1, window.posts); // Ensure at least 1 post
          }
        }
      }

      // Generate posts for each window
      for (const window of postingWindows) {
        for (let i = 0; i < window.posts; i++) {
          // Random time within window
          const randomMinute = Math.floor(Math.random() * 60);
          const postTime = new Date(tomorrow);
          postTime.setUTCHours(window.start, randomMinute, 0, 0);
          
          // Determine content type based on time and strategy
          const contentType = this.selectContentType(window.type, postingStrategy, budgetCalculation);
          
          plannedPosts.push({
            time: postTime.toISOString(),
            content_type: contentType,
            priority: window.priority,
            reasoning: `${window.type} - ${budgetCalculation.reasoning}`,
            estimated_engagement: this.estimateEngagement(contentType, window.priority)
          });
        }
      }

      // Sort by time
      plannedPosts.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      
      console.log(`✅ Generated ${plannedPosts.length} intelligent posts for tomorrow`);
      
      return plannedPosts;
      
    } catch (error) {
      console.error('❌ Error generating planned posts:', error);
      return [];
    }
  }

  private selectContentType(windowType: string, strategy: string, budgetCalc: any): string {
    // Enhanced content selection based on budget calculation
    const isHighOpportunity = budgetCalc.opportunity_boost > 0.2;
    const isHighPerformance = budgetCalc.performance_modifier > 1.1;
    
    const contentTypes = {
      morning_startup: isHighOpportunity ? ['breakthrough_discovery', 'trending_insight'] : ['industry_insight', 'research_highlight'],
      late_morning: isHighPerformance ? ['viral_stat', 'controversial_take'] : ['educational', 'thought_leadership'],
      lunch_peak: ['breakthrough_discovery', 'viral_stat', 'controversial_take'],
      afternoon_peak: isHighOpportunity ? ['breaking_news', 'trending_insight', 'viral_stat'] : ['trend_analysis', 'industry_insight'],
      evening_start: ['thought_leadership', 'industry_insight'],
      evening_prime: isHighPerformance ? ['engaging_question', 'viral_stat'] : ['educational', 'research_highlight']
    };

    // Intelligent strategy-based selection
    if (strategy === 'intelligent_monthly_budget') {
      if (isHighOpportunity && isHighPerformance) {
        // High opportunity + high performance = aggressive content
        return ['breakthrough_discovery', 'controversial_take', 'viral_stat'][Math.floor(Math.random() * 3)];
      } else if (isHighOpportunity) {
        // High opportunity = trending content
        return ['trending_insight', 'breaking_news', 'viral_stat'][Math.floor(Math.random() * 3)];
      } else if (isHighPerformance) {
        // High performance = engaging content
        return ['engaging_question', 'controversial_take', 'thought_leadership'][Math.floor(Math.random() * 3)];
      }
    }

    // Default to window-appropriate content
    const windowTypes = contentTypes[windowType as keyof typeof contentTypes] || ['educational'];
    return windowTypes[Math.floor(Math.random() * windowTypes.length)];
  }

  private estimateEngagement(contentType: string, priority: number): number {
    // Base engagement estimates by content type (as percentage)
    const baseEngagement = {
      breakthrough_discovery: 4.5,
      controversial_take: 5.2,
      viral_stat: 4.8,
      breaking_news: 4.2,
      trend_analysis: 3.8,
      thought_leadership: 3.5,
      industry_insight: 3.2,
      educational: 2.8,
      research_highlight: 3.0,
      engaging_question: 3.6
    };

    const base = baseEngagement[contentType as keyof typeof baseEngagement] || 3.0;
    const priorityMultiplier = priority === 4 ? 1.2 : priority === 3 ? 1.0 : 0.8;
    
    return Math.round((base * priorityMultiplier) * 10) / 10;
  }
}

// Export singleton instance
export const dashboardWriter = new DashboardWriter(); 