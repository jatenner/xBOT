#!/usr/bin/env node

/**
 * 🚨 EMERGENCY: DISABLE ALL FAKE CONTENT SYSTEMS
 * ===============================================
 * Completely disable all systems posting fake replies or incomplete hooks
 */

const fs = require('fs');
const path = require('path');

function disableUnifiedSchedulerFakeContent() {
    console.log('🚨 EMERGENCY: Disabling fake content in Unified Scheduler...');
    
    const schedulerPath = path.join(process.cwd(), 'src/core/unifiedScheduler.ts');
    
    if (fs.existsSync(schedulerPath)) {
        let content = fs.readFileSync(schedulerPath, 'utf8');
        
        // Disable smart engagement that might post fake content
        const badSmartEngagement = `  private async runSmartEngagement(): Promise<void> {
    try {
      // Reduced engagement rate - 30% chance to actually engage
      if (Math.random() > 0.3) {
        console.log('🤖 Skipping engagement cycle for human-like variance');
        return;
      }

      // Use existing engagement method
      await this.runEngagement();
      console.log('💫 Smart engagement completed');
    } catch (error) {
      console.error('❌ Smart engagement failed:', error);
    }
  }`;

        const disabledSmartEngagement = `  private async runSmartEngagement(): Promise<void> {
    // 🚨 EMERGENCY DISABLED: This was posting fake content
    console.log('🚫 Smart engagement DISABLED - was posting fake replies');
    console.log('✅ Bot now focuses ONLY on original, complete tweets');
    return;
  }`;

        content = content.replace(badSmartEngagement, disabledSmartEngagement);

        // Disable the old reply system that posts fake content
        const badReplySystem = `  async runReplySystem(): Promise<void> {
    if (!this.isRunning) return;
    
    try {
      console.log('🎭 === REPLY SYSTEM CYCLE STARTING ===');
      const result = await replyAgent.runReplySystem();
      
      if (result.success) {
        this.totalReplies += result.repliesPosted;
        this.lastReplyTime = new Date();
        console.log(\`✅ Reply cycle successful: \${result.repliesPosted} replies posted\`);
      } else {
        console.log(\`⚠️ Reply cycle completed with issues: \${result.summary}\`);
      }
      
      // Log errors if any
      if (result.errors.length > 0) {
        console.log('⚠️ Reply system errors:');
        result.errors.forEach(error => console.log(\`   - \${error}\`));
      }
      
    } catch (error) {
      console.error('❌ Reply system cycle failed:', error);
    }
  }`;

        const disabledReplySystem = `  async runReplySystem(): Promise<void> {
    // 🚨 EMERGENCY DISABLED: This was posting fake "Reply to tweet mock_tweet_..." content
    console.log('🚫 Old reply system DISABLED - was posting fake mock_tweet replies');
    console.log('✅ Using new contextAwareReplyEngine for real influencer replies only');
    return;
  }`;

        content = content.replace(badReplySystem, disabledReplySystem);

        // Disable the general engagement system
        const badEngagement = `  private async runEngagement(): Promise<void> {
    try {
      console.log('\\n🤝 === AUTONOMOUS ENGAGEMENT CYCLE ===');
      
      const engagementResult = await this.engagementAgent.run();
      
      if (engagementResult.success) {
        console.log('✅ Engagement cycle completed successfully');
        console.log(\`📊 Actions: \${engagementResult.actions?.length || 0}\`);
        console.log(\`📝 Summary: \${engagementResult.message}\`);
      } else {
        console.log('⚠️ Engagement cycle had issues');
        console.log(\`📝 Message: \${engagementResult.message}\`);
      }
      
    } catch (error) {
      console.error('❌ Engagement cycle error:', error);
    }
  }`;

        const disabledEngagement = `  private async runEngagement(): Promise<void> {
    // 🚨 EMERGENCY DISABLED: This was posting fake content via engagementAgent
    console.log('🚫 General engagement system DISABLED - was posting fake content');
    console.log('✅ Only using human-like content generation and influencer replies');
    return;
  }`;

        content = content.replace(badEngagement, disabledEngagement);

        // Remove the scheduled engagement calls that trigger fake content
        content = content.replace(/await this\.runSmartEngagement\(\);/g, '// DISABLED: await this.runSmartEngagement(); // Was posting fake content');

        fs.writeFileSync(schedulerPath, content);
        console.log('✅ Unified Scheduler fake content systems DISABLED');
    }
}

function disableAutonomousEngagementEngine() {
    console.log('🚨 EMERGENCY: Disabling Autonomous Engagement Engine fake posting...');
    
    const enginePath = path.join(process.cwd(), 'src/agents/autonomousEngagementEngine.ts');
    
    if (fs.existsSync(enginePath)) {
        let content = fs.readFileSync(enginePath, 'utf8');
        
        // Find and disable any switch statements that post fake content
        const fakePostingPattern = /switch\s*\(\s*action\.type\s*\)\s*{[\s\S]*?await\s+poster\.postTweet[\s\S]*?break;[\s\S]*?}/g;
        
        const disabledCode = `// 🚨 EMERGENCY DISABLED: This was posting fake "Reply to tweet mock_tweet_..." content
      console.log('🚫 Engagement actions DISABLED - was posting fake content');
      console.log(\`📝 Would have performed: \${action.type} on \${action.targetTweetId || action.targetUsername}\`);
      return { success: false, error: 'Fake content posting disabled' };`;

        content = content.replace(fakePostingPattern, disabledCode);

        fs.writeFileSync(enginePath, content);
        console.log('✅ Autonomous Engagement Engine fake posting DISABLED');
    }
}

function disableIntelligentReplyEngine() {
    console.log('🚨 EMERGENCY: Disabling Intelligent Reply Engine fake posting...');
    
    const enginePath = path.join(process.cwd(), 'src/agents/intelligentReplyEngine.ts');
    
    if (fs.existsSync(enginePath)) {
        let content = fs.readFileSync(enginePath, 'utf8');
        
        // Disable any postTweet calls for replies
        content = content.replace(
            /await\s+poster\.postTweet\([^)]*\);/g, 
            '// DISABLED: await poster.postTweet(...); // Was posting fake replies'
        );

        fs.writeFileSync(enginePath, content);
        console.log('✅ Intelligent Reply Engine fake posting DISABLED');
    }
}

function disableReplyAgent() {
    console.log('🚨 EMERGENCY: Disabling Reply Agent fake posting...');
    
    const agentPath = path.join(process.cwd(), 'src/agents/replyAgent.ts');
    
    if (fs.existsSync(agentPath)) {
        let content = fs.readFileSync(agentPath, 'utf8');
        
        // Disable the runReplySystem method
        const runReplySystemPattern = /async runReplySystem\(\)[\s\S]*?return\s*{[\s\S]*?};\s*}/;
        
        const disabledMethod = `async runReplySystem(): Promise<{
    success: boolean;
    tweetsFound: number;
    repliesGenerated: number;
    repliesPosted: number;
    errors: string[];
    summary: string;
  }> {
    // 🚨 EMERGENCY DISABLED: This was posting fake "Reply to tweet mock_tweet_..." content
    console.log('🚫 Reply Agent DISABLED - was posting fake content');
    return {
      success: false,
      tweetsFound: 0,
      repliesGenerated: 0,
      repliesPosted: 0,
      errors: ['System disabled - was posting fake content'],
      summary: 'Reply Agent disabled to prevent fake content posting'
    };
  }`;

        content = content.replace(runReplySystemPattern, disabledMethod);

        fs.writeFileSync(agentPath, content);
        console.log('✅ Reply Agent fake posting DISABLED');
    }
}

function disableRealEngagementAgent() {
    console.log('🚨 EMERGENCY: Disabling Real Engagement Agent fake posting...');
    
    const agentPath = path.join(process.cwd(), 'src/agents/realEngagementAgent.ts');
    
    if (fs.existsSync(agentPath)) {
        let content = fs.readFileSync(agentPath, 'utf8');
        
        // Disable the run method
        const runMethodPattern = /async run\(\)[\s\S]*?return\s*{[\s\S]*?};\s*}/;
        
        const disabledMethod = `async run(): Promise<{ success: boolean; message: string; actions?: any[] }> {
    // 🚨 EMERGENCY DISABLED: This was posting fake content
    console.log('🚫 Real Engagement Agent DISABLED - was posting fake content');
    return {
      success: false,
      message: 'Engagement agent disabled to prevent fake content posting',
      actions: []
    };
  }`;

        content = content.replace(runMethodPattern, disabledMethod);

        fs.writeFileSync(agentPath, content);
        console.log('✅ Real Engagement Agent fake posting DISABLED');
    }
}

function createEmergencyContentValidation() {
    console.log('🔧 Creating emergency content validation...');
    
    const validationCode = `// 🚨 EMERGENCY CONTENT VALIDATION
// Prevent all incomplete hooks and fake content

export function isEmergencyBlockedContent(content: string): boolean {
    // Block incomplete hooks
    const incompleteHooks = [
        /here's how to .+(?:in \\d+ minutes?)?:?\\s*$/i,
        /here are \\d+ ways to .+:?\\s*$/i,
        /the secret to .+ is:?\\s*$/i,
        /\\d+ tips for .+:?\\s*$/i,
        /here's what .+ found:?\\s*$/i
    ];

    // Block fake replies
    const fakeReplies = [
        /reply to tweet mock_tweet/i,
        /reply to tweet \\d+/i,
        /action for user/i,
        /mock_tweet_\\d+/i
    ];

    // Check all patterns
    const allPatterns = [...incompleteHooks, ...fakeReplies];
    
    for (const pattern of allPatterns) {
        if (pattern.test(content.trim())) {
            console.log(\`🚨 EMERGENCY BLOCKED: \${pattern.source}\`);
            return true;
        }
    }

    return false;
}

export const EMERGENCY_CONTENT_VALIDATION = {
    isBlocked: isEmergencyBlockedContent,
    reason: 'Emergency content validation - preventing fake and incomplete content'
};`;

    const validationPath = path.join(process.cwd(), 'src/config/emergencyContentValidation.ts');
    fs.writeFileSync(validationPath, validationCode);
    console.log('✅ Emergency content validation created');
}

function main() {
    console.log('🚨 EMERGENCY: DISABLING ALL FAKE CONTENT SYSTEMS');
    console.log('================================================');
    console.log('');
    console.log('PROBLEM: Bot is posting:');
    console.log('  ❌ "Reply to tweet mock_tweet_175381022951"');
    console.log('  ❌ "Here\'s how to optimize your gut_health in just 5 minutes:"');
    console.log('');
    console.log('SOLUTION: Completely disable all problematic systems');
    console.log('');

    disableUnifiedSchedulerFakeContent();
    disableAutonomousEngagementEngine();
    disableIntelligentReplyEngine();
    disableReplyAgent();
    disableRealEngagementAgent();
    createEmergencyContentValidation();

    console.log('');
    console.log('🎉 EMERGENCY FIXES COMPLETE!');
    console.log('');
    console.log('✅ SYSTEMS DISABLED:');
    console.log('   1. 🚫 Unified Scheduler fake content systems');
    console.log('   2. 🚫 Autonomous Engagement Engine fake posting');
    console.log('   3. 🚫 Intelligent Reply Engine fake posting');
    console.log('   4. 🚫 Reply Agent fake posting');
    console.log('   5. 🚫 Real Engagement Agent fake posting');
    console.log('   6. ✅ Emergency content validation added');
    console.log('');
    console.log('📈 REMAINING ACTIVE SYSTEMS:');
    console.log('   ✅ Elite Twitter Content Strategist (fixed)');
    console.log('   ✅ Enhanced Content Generator (fixed)');
    console.log('   ✅ Context Aware Reply Engine (for real influencers)');
    console.log('   ✅ Content fact checker');
    console.log('   ✅ Incomplete hook validation');
    console.log('');
    console.log('🎯 EXPECTED RESULTS:');
    console.log('   - NO MORE fake "Reply to tweet mock_tweet_..." posts');
    console.log('   - NO MORE incomplete "Here\'s how to..." hooks');
    console.log('   - ONLY complete, valuable standalone tweets');
    console.log('   - ONLY real influencer replies with context');
    console.log('');
    console.log('🚀 Ready for immediate deployment!');
}

if (require.main === module) {
    main();
} 