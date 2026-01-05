/**
 * 🚫 LEGACY BYPASS BLOCKER
 * 
 * This file exists to catch any legacy code that tries to use the old
 * bulletproofPoster bypass path. All calls will fail with an error
 * requiring use of the authorized posting flow.
 * 
 * ✅ Authorized path: postingQueue.ts → UltimateTwitterPoster (with authorization)
 * ❌ This file: BLOCKED
 */

export const bulletproofPoster = {
  postReply: async (content: string, target_tweet_id: string): Promise<{ success: boolean; error?: string; tweetId?: string }> => {
    console.error(`[BYPASS_BLOCKED] 🚨 bulletproofPoster.postReply() is deprecated and blocked.`);
    console.error(`[BYPASS_BLOCKED] 🚨 All replies must go through postingQueue → FINAL_REPLY_GATE.`);
    console.error(`[BYPASS_BLOCKED] 🚨 target=${target_tweet_id}, content_length=${content?.length || 0}`);
    return { 
      success: false, 
      error: 'bulletproofPoster is deprecated. Use authorized posting flow via postingQueue.' 
    };
  },
  
  postTweet: async (content: string): Promise<{ success: boolean; error?: string; tweetId?: string }> => {
    console.error(`[BYPASS_BLOCKED] 🚨 bulletproofPoster.postTweet() is deprecated and blocked.`);
    console.error(`[BYPASS_BLOCKED] 🚨 All posts must go through postingQueue.`);
    return { 
      success: false, 
      error: 'bulletproofPoster is deprecated. Use authorized posting flow via postingQueue.' 
    };
  },
  
  postContent: async (content: string): Promise<{ success: boolean; error?: string; tweetId?: string }> => {
    console.error(`[BYPASS_BLOCKED] 🚨 bulletproofPoster.postContent() is deprecated and blocked.`);
    return { 
      success: false, 
      error: 'bulletproofPoster is deprecated. Use authorized posting flow via postingQueue.' 
    };
  },
  
  getStatus: () => ({
    status: 'blocked',
    message: 'bulletproofPoster is deprecated and blocked. Use authorized posting flow.'
  }),
  
  healthCheck: async () => ({
    healthy: false,
    message: 'bulletproofPoster is deprecated and blocked.'
  })
};

