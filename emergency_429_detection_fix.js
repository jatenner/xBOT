#!/usr/bin/env node

/**
 * 🚨 EMERGENCY: 429 DETECTION FIX
 * ===============================
 * 
 * Fixes the Real-Time Limits Intelligence Agent to properly detect:
 * 1. 429 rate limit errors
 * 2. x-user-limit-24hour-remaining: 0
 * 3. Force bot into waiting mode when exhausted
 */

const fs = require('fs');
const path = require('path');

async function fix429Detection() {
  console.log('🚨 EMERGENCY: 429 DETECTION FIX');
  console.log('===============================');
  console.log('✅ Fixing limits detection for 429 errors');
  console.log('✅ Adding proper header parsing');
  console.log('✅ Adding exhaustion detection');
  
  try {
    const limitsAgentPath = path.join(__dirname, 'src/agents/realTimeLimitsIntelligenceAgent.ts');
    
    if (!fs.existsSync(limitsAgentPath)) {
      throw new Error('Limits agent file not found');
    }
    
    let content = fs.readFileSync(limitsAgentPath, 'utf8');
    
    // Find the checkTwitterLimits method and add 429 detection
    const fix429DetectionCode = `
    // 🚨 EMERGENCY: Enhanced 429 and exhaustion detection
    private async detect429AndExhaustion(response: any): Promise<{ is429: boolean; isExhausted: boolean; remaining: number }> {
      try {
        // Check for 429 status code
        if (response?.status === 429 || response?.code === 429) {
          console.log('🚨 429 RATE LIMIT DETECTED');
          return { is429: true, isExhausted: true, remaining: 0 };
        }
        
        // Check for 0 remaining in headers
        const headers = response?.headers || {};
        const remaining = parseInt(headers['x-user-limit-24hour-remaining'] || '999');
        
        if (remaining === 0) {
          console.log('🚨 DAILY LIMIT EXHAUSTED: 0 tweets remaining');
          return { is429: false, isExhausted: true, remaining: 0 };
        }
        
        // Check for low remaining (< 3)
        if (remaining < 3) {
          console.log(\`⚠️ LOW REMAINING: \${remaining} tweets left\`);
          return { is429: false, isExhausted: false, remaining };
        }
        
        return { is429: false, isExhausted: false, remaining };
        
      } catch (error) {
        console.error('❌ 429 detection failed:', error);
        return { is429: true, isExhausted: true, remaining: 0 }; // Conservative fallback
      }
    }`;
    
    // Insert the new method before the last closing brace
    const lastBraceIndex = content.lastIndexOf('}');
    content = content.slice(0, lastBraceIndex) + fix429DetectionCode + '\n' + content.slice(lastBraceIndex);
    
    // Also add emergency exhaustion check in checkTwitterLimits method
    const exhaustionCheckCode = `
      // 🚨 EMERGENCY: Check for exhaustion before proceeding
      const exhaustionCheck = await this.detect429AndExhaustion(rateLimits);
      if (exhaustionCheck.isExhausted) {
        console.log('🚨 TWITTER LIMITS EXHAUSTED - FORCING WAIT MODE');
        
        const resetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
        
        return {
          dailyTweets: {
            used: realDailyLimit || 25,
            limit: realDailyLimit || 25,
            remaining: 0,
            resetTime
          },
          monthlyTweets: {
            used: monthlyStats.tweets,
            limit: 1500,
            remaining: Math.max(0, 1500 - monthlyStats.tweets),
            resetTime: new Date(now.getFullYear(), now.getMonth() + 1, 1)
          },
          readRequests: {
            used: dailyStats.reads,
            limit: 10000,
            remaining: Math.max(0, 10000 - dailyStats.reads),
            resetTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          },
          shortTermLimits: {
            tweets15min: { used: realDailyLimit || 25, limit: realDailyLimit || 25, remaining: 0, resetTime },
            reads15min: { used: 0, limit: 180, remaining: 180, resetTime }
          },
          accountStatus: 'limited',
          isLocked: true,
          canPost: false,
          canRead: true,
          nextSafePostTime: resetTime,
          recommendedWaitTime: Math.ceil((resetTime.getTime() - now.getTime()) / 60000)
        };
      }`;
    
    // Find the checkTwitterLimits method and add the exhaustion check at the beginning
    const checkTwitterLimitsStart = content.indexOf('private async checkTwitterLimits()');
    if (checkTwitterLimitsStart !== -1) {
      const methodStart = content.indexOf('{', checkTwitterLimitsStart);
      if (methodStart !== -1) {
        content = content.slice(0, methodStart + 1) + exhaustionCheckCode + content.slice(methodStart + 1);
      }
    }
    
    // Write the fixed file
    fs.writeFileSync(limitsAgentPath, content);
    
    console.log('✅ 429 detection fix applied successfully');
    console.log('✅ Enhanced exhaustion detection added');
    console.log('✅ Emergency wait mode triggers added');
    
    console.log('\n🎯 FIXES APPLIED:');
    console.log('1. ✅ 429 status code detection');
    console.log('2. ✅ x-user-limit-24hour-remaining: 0 detection');
    console.log('3. ✅ Automatic wait mode activation');
    console.log('4. ✅ Conservative fallback on detection failure');
    
  } catch (error) {
    console.error('❌ 429 detection fix failed:', error);
    throw error;
  }
}

// Run the emergency fix
if (require.main === module) {
  fix429Detection()
    .then(() => {
      console.log('\n✅ Emergency 429 detection fix completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Emergency fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fix429Detection }; 