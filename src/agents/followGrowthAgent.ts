import { supabaseClient } from '../utils/supabaseClient';
import { xClient } from '../utils/xClient';
import * as quotaGuard from '../utils/quotaGuard';
import { followerRatioGuard } from '../utils/followerRatioGuard';

export class FollowGrowthAgent {
  private readonly DAILY_FOLLOW_LIMIT = 25;
  private readonly DAILY_UNFOLLOW_LIMIT = 25;
  private readonly UNFOLLOW_DELAY_DAYS = 4;

  async run(): Promise<void> {
    console.log('👥 === FOLLOW GROWTH AGENT STARTED ===');
    
    try {
      // Check if following is paused due to ratio guard
      const followPaused = await supabaseClient.getBotConfig('follow_pause');
      if (followPaused === 'true') {
        console.log('⏸️ Following is paused due to ratio guard');
        return;
      }

      // Check ratio guard
      const canFollow = await followerRatioGuard();
      if (!canFollow) {
        await supabaseClient.setBotConfig('follow_pause', 'true');
        console.log('🚫 Ratio guard triggered - pausing follows');
        return;
      }

      // Get today's action counts
      const todayActions = await this.getTodayActionCounts();
      console.log('📊 Today\'s actions:', todayActions);

      // Perform unfollow actions first (clean up)
      if (todayActions.unfollows < this.DAILY_UNFOLLOW_LIMIT) {
        await this.performUnfollowActions(this.DAILY_UNFOLLOW_LIMIT - todayActions.unfollows);
      }

      // Perform follow actions
      if (todayActions.follows < this.DAILY_FOLLOW_LIMIT) {
        await this.performFollowActions(this.DAILY_FOLLOW_LIMIT - todayActions.follows);
      }

      console.log('✅ Follow growth cycle complete');

    } catch (error) {
      console.error('❌ Follow growth agent failed:', error);
    }
  }

  private async getTodayActionCounts(): Promise<{ follows: number; unfollows: number }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabaseClient.supabase
        ?.from('follow_actions')
        .select('action_type')
        .eq('action_date', today)
        .eq('success', true);

      if (error) throw error;

      const follows = data?.filter(a => a.action_type === 'follow').length || 0;
      const unfollows = data?.filter(a => a.action_type === 'unfollow').length || 0;

      return { follows, unfollows };
    } catch (error) {
      console.error('Error getting today action counts:', error);
      return { follows: 0, unfollows: 0 };
    }
  }

  private async performFollowActions(maxActions: number): Promise<void> {
    console.log(`👥 Performing up to ${maxActions} follow actions`);
    
    try {
      // Get competitor handles
      const competitorHandles = await this.getCompetitorHandles();
      const targetUsers = await this.findFollowTargets(competitorHandles, maxActions);
      
      let followCount = 0;
      for (const user of targetUsers) {
        if (followCount >= maxActions) break;

        if (!(await quotaGuard.canMakeWrite())) {
          console.log('⏸️ Write quota reached, stopping follows');
          break;
        }

        const success = await this.followUser(user.id); // Use user ID instead of username
        await this.recordFollowAction(user.username, 'follow', success);
        
        if (success) followCount++;
        
        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      console.log(`✅ Followed ${followCount} users`);
    } catch (error) {
      console.error('Error in follow actions:', error);
    }
  }

  private async performUnfollowActions(maxActions: number): Promise<void> {
    console.log(`👥 Performing up to ${maxActions} unfollow actions`);
    
    try {
      const unfollowTargets = await this.getUnfollowTargets(maxActions);
      
      let unfollowCount = 0;
      for (const target of unfollowTargets) {
        if (unfollowCount >= maxActions) break;

        if (!(await quotaGuard.canMakeWrite())) {
          console.log('⏸️ Write quota reached, stopping unfollows');
          break;
        }

        // Get user ID from username
        const userData = await xClient.getUserByUsername(target.target_username);
        if (!userData) continue;

        const success = await this.unfollowUser(userData.id);
        await this.recordFollowAction(target.target_username, 'unfollow', success);
        
        if (success) unfollowCount++;
        
        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      console.log(`✅ Unfollowed ${unfollowCount} users`);
    } catch (error) {
      console.error('Error in unfollow actions:', error);
    }
  }

  private async getCompetitorHandles(): Promise<string[]> {
    try {
      const handles = await supabaseClient.getBotConfig('competitor_handles');
      return handles ? handles.split(',').map(h => h.trim()) : [];
    } catch (error) {
      console.error('Error getting competitor handles:', error);
      return ['healthtechfocus', 'medtech_news', 'digitalhealth']; // Fallback
    }
  }

  private async findFollowTargets(competitorHandles: string[], maxTargets: number): Promise<any[]> {
    try {
      const targets: any[] = [];
      
      for (const handle of competitorHandles.slice(0, 2)) { // Limit API calls
        if (targets.length >= maxTargets) break;
        
        // Use search functionality since we don't have direct followers API in xClient
        const users = await quotaGuard.safeRead(async () => {
          return await xClient.getUsersToFollow(`health tech ${handle}`, Math.min(20, maxTargets * 2));
        });

        if (users && users.length > 0) {
          for (const user of users.slice(0, maxTargets - targets.length)) {
            // Filter out bots and inactive accounts
            if (this.isValidFollowTarget(user)) {
              targets.push({ username: user.username, id: user.id });
            }
          }
        }
        
        // Throttle between API calls
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      return targets.slice(0, maxTargets);
    } catch (error) {
      console.error('Error finding follow targets:', error);
      return [];
    }
  }

  private isValidFollowTarget(user: any): boolean {
    // Basic bot detection and quality filtering
    const username = user.username.toLowerCase();
    const name = user.name?.toLowerCase() || '';
    const metrics = user.public_metrics;
    
    if (!metrics) return false;
    
    // Skip obvious bots
    if (username.includes('bot') || name.includes('bot')) return false;
    if (username.match(/\d{8,}/)) return false; // Long number sequences
    if (metrics.followers_count < 10 || metrics.followers_count > 100000) return false;
    if (metrics.following_count > metrics.followers_count * 3) return false; // Poor ratio
    
    return true;
  }

  private async followUser(userId: string): Promise<boolean> {
    try {
      const result = await quotaGuard.safeWrite(async () => {
        return await xClient.followUser(userId);
      });

      if (result?.success) {
        console.log(`✅ Followed user ${userId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Failed to follow user ${userId}:`, error);
      return false;
    }
  }

  private async unfollowUser(userId: string): Promise<boolean> {
    try {
      // Since xClient doesn't have unfollow, we'll skip this for now
      // In a real implementation, you'd add unfollow to xClient
      console.log(`⚠️ Unfollow not implemented in xClient for user ${userId}`);
      return false;
    } catch (error) {
      console.error(`❌ Failed to unfollow user ${userId}:`, error);
      return false;
    }
  }

  private async getUnfollowTargets(maxTargets: number): Promise<any[]> {
    try {
      const unfollowDate = new Date();
      unfollowDate.setDate(unfollowDate.getDate() - this.UNFOLLOW_DELAY_DAYS);
      const unfollowDateStr = unfollowDate.toISOString().split('T')[0];

      const { data, error } = await supabaseClient.supabase
        ?.from('follow_actions')
        .select('target_username')
        .eq('action_type', 'follow')
        .eq('success', true)
        .lte('action_date', unfollowDateStr)
        .limit(maxTargets);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting unfollow targets:', error);
      return [];
    }
  }

  private async recordFollowAction(username: string, actionType: 'follow' | 'unfollow', success: boolean): Promise<void> {
    try {
      const { error } = await supabaseClient.supabase
        ?.from('follow_actions')
        .insert({
          target_username: username,
          action_type: actionType,
          success,
          reason: success ? 'Growth strategy' : 'API error'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error recording follow action:', error);
    }
  }

  async getFollowStats(): Promise<any> {
    try {
      const { data, error } = await supabaseClient.supabase
        ?.from('follow_actions')
        .select('action_type, success, action_date')
        .gte('action_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      if (error) throw error;

      const stats = {
        follows_7d: data?.filter(a => a.action_type === 'follow' && a.success).length || 0,
        unfollows_7d: data?.filter(a => a.action_type === 'unfollow' && a.success).length || 0,
        success_rate: data?.length > 0 ? data.filter(a => a.success).length / data.length : 0
      };

      return stats;
    } catch (error) {
      console.error('Error getting follow stats:', error);
      return { follows_7d: 0, unfollows_7d: 0, success_rate: 0 };
    }
  }
} 