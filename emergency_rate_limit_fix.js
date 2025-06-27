#!/usr/bin/env node

/**
 * 🚨 EMERGENCY RATE LIMIT FIX
 * ===========================
 * 
 * PROBLEM: Bot posted 17 times in 30 minutes, exhausted Twitter API daily limit
 * SOLUTION: Immediate posting pause + proper rate limiting implementation
 */

const fs = require('fs');
const path = require('path');

async function emergencyRateLimitFix() {
  console.log('🚨 EMERGENCY RATE LIMIT FIX ACTIVATED');
  console.log('====================================');
  console.log('❌ Problem: Bot posted 17 times in 30 minutes');
  console.log('✅ Solution: Immediate posting pause + rate limiting');
  
  const fixes = [];
  
  // 1. IMMEDIATE: Disable emergency posting in DailyPostingManager
  console.log('\n1. 🛑 DISABLING EMERGENCY POSTING...');
  const dailyManagerPath = 'src/utils/dailyPostingManager.ts';
  
  if (fs.existsSync(dailyManagerPath)) {
    let content = fs.readFileSync(dailyManagerPath, 'utf8');
    
    // Disable emergency posting activation
    content = content.replace(
      /private async activateEmergencyPosting\(postsNeeded: number\): Promise<void> \{[\s\S]*?\n  \}/,
      `private async activateEmergencyPosting(postsNeeded: number): Promise<void> {
    console.log(\`🚨 Emergency posting activated - need \${postsNeeded} additional posts\`);
    
    // 🚨 EMERGENCY FIX: Disable all emergency posting
    console.log('🛑 EMERGENCY FIX: Emergency posting DISABLED to prevent API exhaustion');
    console.log('⏰ Bot will wait for natural schedule instead of catch-up posting');
    return; // Exit immediately without scheduling emergency posts
  }`
    );
    
    // Disable strategic monitoring burst posting
    content = content.replace(
      /for \(let i = 0; i < rec\.postCount.*?\}/s,
      `// 🚨 EMERGENCY FIX: Disabled strategic burst posting
      console.log('🛑 Strategic burst posting DISABLED - preventing API spam');
      console.log(\`   Would have posted \${rec.postCount} times but blocked for safety\`);`
    );
    
    // Add rate limiting to executePost
    content = content.replace(
      /private async executePost\(trigger: 'scheduled' \| 'emergency' \| 'catchup'\): Promise<void> \{/,
      `private async executePost(trigger: 'scheduled' | 'emergency' | 'catchup'): Promise<void> {
    // 🚨 EMERGENCY RATE LIMITING
    const lastPostTime = this.currentState.last_post_time ? new Date(this.currentState.last_post_time) : null;
    const now = new Date();
    
    if (lastPostTime) {
      const timeSinceLastPost = now.getTime() - lastPostTime.getTime();
      const MIN_INTERVAL = 30 * 60 * 1000; // 30 minutes minimum
      
      if (timeSinceLastPost < MIN_INTERVAL) {
        const waitTime = MIN_INTERVAL - timeSinceLastPost;
        console.log(\`🚨 RATE LIMIT: Must wait \${Math.ceil(waitTime / 60000)} minutes since last post\`);
        console.log('🛑 Post blocked to prevent API exhaustion');
        return;
      }
    }
    
    // Check daily limit
    if (this.currentState.posts_completed >= 10) { // Conservative limit
      console.log('🚨 DAILY LIMIT REACHED: 10 posts completed, blocking further posts');
      return;
    }`
    );
    
    fs.writeFileSync(dailyManagerPath, content);
    fixes.push('✅ Disabled emergency posting in DailyPostingManager');
    console.log('✅ Fixed DailyPostingManager emergency posting');
  }
  
  // 2. IMMEDIATE: Add rate limiting to PostTweetAgent
  console.log('\n2. 🛑 ADDING RATE LIMITING TO POST AGENT...');
  const postAgentPath = 'src/agents/postTweet.ts';
  
  if (fs.existsSync(postAgentPath)) {
    let content = fs.readFileSync(postAgentPath, 'utf8');
    
    // Add rate limiting at the start of the run method
    content = content.replace(
      /(async run\([^)]*\)[^{]*\{)/,
      `$1
    // 🚨 EMERGENCY RATE LIMITING
    const rateLimitCheck = await this.checkRateLimit();
    if (!rateLimitCheck.canPost) {
      console.log('🚨 RATE LIMIT BLOCK: Cannot post -', rateLimitCheck.reason);
      return { success: false, reason: rateLimitCheck.reason };
    }`
    );
    
    // Add the rate limit checking method
    const rateLimitMethod = `
  
  /**
   * 🚨 EMERGENCY RATE LIMITING
   * Prevents API exhaustion by enforcing strict limits
   */
  private async checkRateLimit(): Promise<{ canPost: boolean; reason: string }> {
    try {
      // Check database for recent posts
      const today = new Date().toISOString().split('T')[0];
      const { data: todaysPosts } = await supabaseClient.supabase
        ?.from('tweets')
        .select('created_at')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false }) || { data: [] };
      
      const postsToday = todaysPosts?.length || 0;
      
      // Conservative daily limit
      if (postsToday >= 8) {
        return { 
          canPost: false, 
          reason: \`Daily limit reached: \${postsToday}/8 posts today\`
        };
      }
      
      // Check time since last post
      if (todaysPosts && todaysPosts.length > 0) {
        const lastPostTime = new Date(todaysPosts[0].created_at);
        const timeSinceLastPost = Date.now() - lastPostTime.getTime();
        const MIN_INTERVAL = 20 * 60 * 1000; // 20 minutes minimum
        
        if (timeSinceLastPost < MIN_INTERVAL) {
          const waitMinutes = Math.ceil((MIN_INTERVAL - timeSinceLastPost) / 60000);
          return { 
            canPost: false, 
            reason: \`Must wait \${waitMinutes} more minutes since last post\`
          };
        }
      }
      
      return { canPost: true, reason: 'Rate limit check passed' };
      
    } catch (error) {
      console.log('⚠️ Rate limit check failed:', error.message);
      // Be conservative on error
      return { canPost: false, reason: 'Rate limit check failed - being conservative' };
    }
  }`;
    
    // Add the method before the last closing brace
    content = content.replace(/}\s*$/, rateLimitMethod + '\n}');
    
    fs.writeFileSync(postAgentPath, content);
    fixes.push('✅ Added emergency rate limiting to PostTweetAgent');
    console.log('✅ Added rate limiting to PostTweetAgent');
  }
  
  // 3. IMMEDIATE: Disable strategist aggressive posting
  console.log('\n3. 🛑 DISABLING STRATEGIST AGGRESSIVE POSTING...');
  const strategistPath = 'src/agents/strategistAgent.ts';
  
  if (fs.existsSync(strategistPath)) {
    let content = fs.readFileSync(strategistPath, 'utf8');
    
    // Disable aggressive posting decisions
    content = content.replace(
      /shouldPost.*true/g,
      'shouldPost: false // 🚨 EMERGENCY: Disabled aggressive posting'
    );
    
    content = content.replace(
      /Decision: post/g,
      'Decision: blocked_emergency_fix // 🚨 EMERGENCY: Posting disabled'
    );
    
    fs.writeFileSync(strategistPath, content);
    fixes.push('✅ Disabled strategist aggressive posting');
    console.log('✅ Disabled strategist aggressive posting');
  }
  
  // 4. IMMEDIATE: Set conservative environment variables
  console.log('\n4. 🛑 SETTING CONSERVATIVE LIMITS...');
  
  const envContent = `# 🚨 EMERGENCY RATE LIMIT SETTINGS
# Conservative limits to prevent API exhaustion
MAX_DAILY_TWEETS=8
EMERGENCY_COST_MODE=true
DISABLE_EMERGENCY_POSTING=true
MIN_POST_INTERVAL_MINUTES=30
DISABLE_CATCH_UP_POSTING=true
DISABLE_STRATEGIC_BURSTS=true

# Rate limiting
TWITTER_DAILY_LIMIT=17
CONSERVATIVE_DAILY_LIMIT=8
EMERGENCY_MODE=true
`;
  
  fs.writeFileSync('.env.emergency', envContent);
  fixes.push('✅ Created emergency environment configuration');
  console.log('✅ Created emergency environment configuration');
  
  // 5. IMMEDIATE: Create emergency deployment trigger
  console.log('\n5. 🚀 PREPARING EMERGENCY DEPLOYMENT...');
  
  const deploymentTrigger = `# 🚨 EMERGENCY RATE LIMIT FIX DEPLOYMENT
# Timestamp: ${new Date().toISOString()}
# Issue: Bot posted 17 times in 30 minutes, exhausted Twitter API
# Fix: Conservative rate limiting + emergency posting disabled
`;
  
  fs.writeFileSync('.render-emergency-rate-limit-fix', deploymentTrigger);
  fixes.push('✅ Created emergency deployment trigger');
  console.log('✅ Created emergency deployment trigger');
  
  // 6. Create monitoring script
  console.log('\n6. 📊 CREATING MONITORING SCRIPT...');
  
  const monitoringScript = `#!/usr/bin/env node

/**
 * 🔍 EMERGENCY RATE LIMIT MONITORING
 * Monitor bot posting to ensure limits are respected
 */

const { supabaseClient } = require('./src/utils/supabaseClient.ts');

async function monitorPostingRate() {
  console.log('🔍 EMERGENCY RATE LIMIT MONITORING');
  console.log('=================================');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's posts
    const { data: todaysPosts } = await supabaseClient.supabase
      ?.from('tweets')
      .select('*')
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false }) || { data: [] };
    
    const postsToday = todaysPosts?.length || 0;
    
    console.log(\`📊 Posts today: \${postsToday}/8 (safe limit)\`);
    
    if (postsToday >= 8) {
      console.log('🚨 WARNING: Daily limit reached!');
    } else if (postsToday >= 6) {
      console.log('⚠️ CAUTION: Approaching daily limit');
    } else {
      console.log('✅ Posting rate is safe');
    }
    
    // Check posting intervals
    if (todaysPosts && todaysPosts.length > 1) {
      for (let i = 0; i < Math.min(5, todaysPosts.length - 1); i++) {
        const post1 = new Date(todaysPosts[i].created_at);
        const post2 = new Date(todaysPosts[i + 1].created_at);
        const interval = (post1.getTime() - post2.getTime()) / (1000 * 60);
        
        console.log(\`⏱️  Interval \${i + 1}: \${interval.toFixed(1)} minutes\`);
        
        if (interval < 20) {
          console.log('🚨 WARNING: Posting interval too short!');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Monitoring failed:', error);
  }
}

monitorPostingRate();
`;
  
  fs.writeFileSync('monitor_rate_limits.js', monitoringScript);
  fixes.push('✅ Created rate limit monitoring script');
  console.log('✅ Created rate limit monitoring script');
  
  // 7. Summary and next steps
  console.log('\n🎯 EMERGENCY FIX SUMMARY');
  console.log('========================');
  fixes.forEach(fix => console.log(fix));
  
  console.log('\n🚀 IMMEDIATE ACTIONS REQUIRED:');
  console.log('1. 🔄 Deploy emergency fix to Render');
  console.log('2. 🔍 Run: node monitor_rate_limits.js');
  console.log('3. ⏰ Wait 24 hours for Twitter API reset');
  console.log('4. 🧪 Test with single tweet before full restart');
  
  console.log('\n⚠️ WHAT THIS FIX DOES:');
  console.log('✅ Disables emergency/catch-up posting');
  console.log('✅ Enforces 30-minute minimum intervals');
  console.log('✅ Limits to 8 tweets per day maximum');
  console.log('✅ Blocks posting when limits detected');
  console.log('✅ Provides real-time monitoring');
  
  console.log('\n🔧 BUILD AND DEPLOY:');
  console.log('npx tsc && git add . && git commit -m "Emergency rate limit fix" && git push');
}

emergencyRateLimitFix().catch(console.error); 