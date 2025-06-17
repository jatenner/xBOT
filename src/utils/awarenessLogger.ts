export class AwarenessLogger {
  static logSystemState(data: {
    currentTime: Date;
    timingState: {
      lastPostTime: number;
      postCount24h: number;
      maxDailyPosts: number;
      minutesSinceLastPost: number;
    };
    engagementContext: {
      multiplier: number;
      description: string;
      windowType: string;
    };
    decision: {
      action: string;
      priority: number;
      reasoning: string;
      expectedEngagement: number;
    };
  }) {
    console.log('\n🧠 === BOT AWARENESS DASHBOARD ===');
    
    // Time Context
    const timeStr = data.currentTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      weekday: 'long'
    });
    console.log(`📅 Current Context: ${timeStr}`);
    console.log(`🕐 Hour: ${data.currentTime.getHours()} | Day: ${data.currentTime.getDay()}`);
    
    // Timing Awareness
    console.log('\n⏰ TIMING AWARENESS:');
    console.log(`   📊 Daily Progress: ${data.timingState.postCount24h}/${data.timingState.maxDailyPosts} posts (${Math.round((data.timingState.postCount24h / data.timingState.maxDailyPosts) * 100)}%)`);
    console.log(`   ⏱️ Last Post: ${data.timingState.lastPostTime > 0 ? `${data.timingState.minutesSinceLastPost}m ago` : 'Never'}`);
    console.log(`   🎯 Status: ${this.getTimingStatus(data.timingState)}`);
    
    // Engagement Awareness
    console.log('\n📈 ENGAGEMENT AWARENESS:');
    console.log(`   🎭 Window: ${data.engagementContext.windowType}`);
    console.log(`   📊 Multiplier: ${data.engagementContext.multiplier}x`);
    console.log(`   📝 Description: ${data.engagementContext.description}`);
    console.log(`   🎯 Quality: ${this.getEngagementQuality(data.engagementContext.multiplier)}`);
    
    // Decision Awareness
    console.log('\n🧠 DECISION AWARENESS:');
    console.log(`   🎯 Action: ${data.decision.action.toUpperCase()}`);
    console.log(`   📊 Priority: ${data.decision.priority}/10 (${this.getPriorityLevel(data.decision.priority)})`);
    console.log(`   📈 Expected: ${data.decision.expectedEngagement.toFixed(2)}x engagement`);
    console.log(`   💭 Reasoning: ${data.decision.reasoning}`);
    
    // Strategic Insights
    console.log('\n🔍 STRATEGIC INSIGHTS:');
    console.log(`   ${this.getStrategicInsight(data)}`);
    
    console.log('=================================\n');
  }
  
  private static getTimingStatus(timing: any): string {
    if (timing.postCount24h === 0) return '🆕 Ready for first post';
    if (timing.postCount24h >= timing.maxDailyPosts) return '🔴 Daily limit reached';
    if (timing.postCount24h > timing.maxDailyPosts * 0.8) return '🟡 Approaching limit';
    return '🟢 On track';
  }
  
  private static getEngagementQuality(multiplier: number): string {
    if (multiplier >= 2.4) return '🔥 VIRAL POTENTIAL';
    if (multiplier >= 1.5) return '🚀 EXCELLENT';
    if (multiplier >= 1.0) return '✅ GOOD';
    if (multiplier >= 0.7) return '⚠️ MODERATE';
    return '🔴 LOW';
  }
  
  private static getPriorityLevel(priority: number): string {
    if (priority >= 9) return 'CRITICAL';
    if (priority >= 7) return 'HIGH';
    if (priority >= 5) return 'MEDIUM';
    if (priority >= 3) return 'LOW';
    return 'MINIMAL';
  }
  
  private static getStrategicInsight(data: any): string {
    const { timingState, engagementContext, decision } = data;
    
    if (decision.action === 'post' && engagementContext.multiplier >= 1.3) {
      return '🎯 OPTIMAL: Posting during high engagement window';
    }
    if (decision.action === 'thread' && engagementContext.multiplier >= 2.4) {
      return '🚀 VIRAL OPPORTUNITY: Thread during peak window';
    }
    if (decision.action === 'sleep' && engagementContext.multiplier >= 1.0) {
      return '⚠️ CONSERVATIVE: Missing good engagement opportunity';
    }
    if (decision.action === 'post' && timingState.postCount24h === 0) {
      return '🌅 FIRST POST: Starting daily content cycle';
    }
    if (decision.action === 'reply' && engagementContext.multiplier < 0.7) {
      return '💬 MAINTENANCE: Building engagement during low period';
    }
    
    return '📊 Standard strategic decision';
  }
  
  static logContentAwareness(data: {
    contentType: string;
    qualityScore?: number;
    missionAlignment?: number;
    imageUsed: boolean;
    hashtags: string[];
  }) {
    console.log('\n📝 CONTENT AWARENESS:');
    console.log(`   🎭 Type: ${data.contentType}`);
    if (data.qualityScore) console.log(`   ⭐ Quality: ${data.qualityScore}/100`);
    if (data.missionAlignment) console.log(`   🎯 Mission Alignment: ${data.missionAlignment}/100`);
    console.log(`   🖼️ Image: ${data.imageUsed ? 'YES' : 'NO'}`);
    console.log(`   🏷️ Hashtags: ${data.hashtags.length > 0 ? data.hashtags.join(', ') : 'None'}`);
  }
  
  static logPerformanceAwareness(data: {
    recentPosts: number;
    avgEngagement: number;
    bestPerformingHour: number;
    worstPerformingHour: number;
  }) {
    console.log('\n📊 PERFORMANCE AWARENESS:');
    console.log(`   📈 Recent Posts: ${data.recentPosts}`);
    console.log(`   💫 Avg Engagement: ${data.avgEngagement.toFixed(1)}%`);
    console.log(`   🌟 Best Hour: ${data.bestPerformingHour}:00`);
    console.log(`   📉 Worst Hour: ${data.worstPerformingHour}:00`);
  }
} 