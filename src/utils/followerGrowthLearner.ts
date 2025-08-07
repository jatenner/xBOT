/**
 * 🚨 EMERGENCY STUB: Follower Growth Learner
 * This file was empty but being imported, creating minimal export to fix build
 */

export class FollowerGrowthLearner {
  // Disabled to prevent quality gate bypass
  async startLearning(): Promise<void> {
    console.log('🚫 FollowerGrowthLearner disabled to prevent quality gate bypass');
  }

  async getGrowthInsights(): Promise<any> {
    return { disabled: true, reason: 'Emergency disabled' };
  }
}

// Export singleton instance
export const followerGrowthLearner = new FollowerGrowthLearner();