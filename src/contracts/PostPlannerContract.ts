/**
 * Post Planner Contract
 * 
 * Defines strict JSON output format for content generation to ensure
 * singles and threads are properly differentiated and validated.
 */

export interface SinglePostPlan {
  post_type: 'single';
  text: string;
}

export interface ThreadPostPlan {
  post_type: 'thread';
  tweets: string[];
  thread_goal: string;
}

export type PostPlan = SinglePostPlan | ThreadPostPlan;

/**
 * Validate that a post plan matches the contract
 */
export function isValidPostPlan(plan: any): plan is PostPlan {
  if (!plan || typeof plan !== 'object') {
    return false;
  }
  
  if (plan.post_type === 'single') {
    return typeof plan.text === 'string' && plan.text.length > 0;
  }
  
  if (plan.post_type === 'thread') {
    return (
      Array.isArray(plan.tweets) &&
      plan.tweets.length >= 2 &&
      plan.tweets.length <= 6 &&
      plan.tweets.every((t: any) => typeof t === 'string' && t.length > 0 && t.length <= 280) &&
      typeof plan.thread_goal === 'string' &&
      plan.thread_goal.length > 0
    );
  }
  
  return false;
}

/**
 * Extract text from a post plan (for DB storage)
 */
export function extractPostText(plan: PostPlan): string {
  if (plan.post_type === 'single') {
    return plan.text;
  } else {
    return plan.tweets.join('\n\n');
  }
}

/**
 * Extract thread parts from a post plan (for DB storage)
 */
export function extractThreadParts(plan: PostPlan): string[] | null {
  if (plan.post_type === 'thread') {
    return plan.tweets;
  }
  return null;
}

