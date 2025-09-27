/**
 * 🎚️ AI RATE CONTROLLER
 * Dynamically adjusts posting/reply rates based on performance within hard ceilings
 */

export interface RateInputs {
  rollingER24h: number;
  rollingER7d: number;
  outcomesFreshness: {
    good: number; // Count of recent outcomes
    stale: number; // Count of old outcomes
  };
  spendToday: number;
  spendLimit: number;
  postErrorRate: number; // Last 50 posts error rate
}

export interface RateTargets {
  postsPerHourTarget: number;
  repliesPerDayTarget: number;
}

export function computeTargets(inputs: RateInputs): RateTargets {
  console.log('[RATE_CTRL] 🧠 Computing adaptive rate targets...');
  console.log(`[RATE_CTRL] Inputs: ER24h=${inputs.rollingER24h.toFixed(4)}, ER7d=${inputs.rollingER7d.toFixed(4)}, fresh=${inputs.outcomesFreshness.good}, spend=${inputs.spendToday}/${inputs.spendLimit}, errors=${inputs.postErrorRate.toFixed(3)}`);
  
  // Environment constraints
  const TARGET_POSTS_PER_HOUR_MIN = parseFloat(process.env.TARGET_POSTS_PER_HOUR_MIN || '0.25');
  const TARGET_POSTS_PER_HOUR_MAX = parseFloat(process.env.TARGET_POSTS_PER_HOUR_MAX || '4');
  const TARGET_REPLIES_PER_DAY_MIN = parseFloat(process.env.TARGET_REPLIES_PER_DAY_MIN || '5');
  const TARGET_REPLIES_PER_DAY_MAX = parseFloat(process.env.TARGET_REPLIES_PER_DAY_MAX || '40');
  
  // Base rates
  let postsBase = 0.5; // 0.5 posts per hour base
  let repliesBase = 10; // 10 replies per day base
  
  // Performance adjustments for posts
  if (inputs.rollingER24h > 0.025 && inputs.outcomesFreshness.good >= 10) {
    postsBase += 0.25;
    console.log('[RATE_CTRL] 📈 +0.25 posts/hour: good 24h ER & fresh outcomes');
  }
  
  if (inputs.rollingER7d > 0.035) {
    postsBase += 0.25;
    console.log('[RATE_CTRL] 📈 +0.25 posts/hour: excellent 7d ER');
  }
  
  if (inputs.spendToday / inputs.spendLimit > 0.80) {
    postsBase -= 0.5;
    console.log('[RATE_CTRL] 📉 -0.5 posts/hour: approaching spend limit');
  }
  
  if (inputs.postErrorRate > 0.05) {
    postsBase -= 0.25;
    console.log('[RATE_CTRL] 📉 -0.25 posts/hour: high error rate');
  }
  
  // Performance adjustments for replies (similar logic)
  if (inputs.rollingER24h > 0.025 && inputs.outcomesFreshness.good >= 10) {
    repliesBase += 5;
    console.log('[RATE_CTRL] 📈 +5 replies/day: good 24h ER & fresh outcomes');
  }
  
  if (inputs.rollingER7d > 0.035) {
    repliesBase += 5;
    console.log('[RATE_CTRL] 📈 +5 replies/day: excellent 7d ER');
  }
  
  if (inputs.spendToday / inputs.spendLimit > 0.80) {
    repliesBase -= 10;
    console.log('[RATE_CTRL] 📉 -10 replies/day: approaching spend limit');
  }
  
  if (inputs.postErrorRate > 0.05) {
    repliesBase -= 5;
    console.log('[RATE_CTRL] 📉 -5 replies/day: high error rate');
  }
  
  // Clamp to target ranges
  const postsPerHourTarget = Math.max(TARGET_POSTS_PER_HOUR_MIN, 
                                     Math.min(TARGET_POSTS_PER_HOUR_MAX, postsBase));
  const repliesPerDayTarget = Math.max(TARGET_REPLIES_PER_DAY_MIN, 
                                      Math.min(TARGET_REPLIES_PER_DAY_MAX, repliesBase));
  
  // Ensure we don't exceed hard ceilings
  const MAX_POSTS_PER_HOUR = parseFloat(process.env.MAX_POSTS_PER_HOUR || '4');
  const REPLY_MAX_PER_DAY = parseFloat(process.env.REPLY_MAX_PER_DAY || '40');
  
  const finalTargets = {
    postsPerHourTarget: Math.min(postsPerHourTarget, MAX_POSTS_PER_HOUR),
    repliesPerDayTarget: Math.min(repliesPerDayTarget, REPLY_MAX_PER_DAY)
  };
  
  console.log(`[RATE_CTRL] targets: postsPerHour=${finalTargets.postsPerHourTarget}, repliesPerDay=${finalTargets.repliesPerDayTarget} (ceilings ${MAX_POSTS_PER_HOUR}/${REPLY_MAX_PER_DAY})`);
  
  return finalTargets;
}

export async function gatherRateInputs(): Promise<RateInputs> {
  // Mock implementation - in real system would query database
  return {
    rollingER24h: 0.020 + Math.random() * 0.015, // 2.0-3.5%
    rollingER7d: 0.025 + Math.random() * 0.015,  // 2.5-4.0%
    outcomesFreshness: {
      good: Math.floor(Math.random() * 20) + 5, // 5-25 fresh outcomes
      stale: Math.floor(Math.random() * 10)     // 0-10 stale outcomes
    },
    spendToday: Math.random() * 50,  // $0-50 spent today
    spendLimit: 100,                 // $100 daily limit
    postErrorRate: Math.random() * 0.1 // 0-10% error rate
  };
}
