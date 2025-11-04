/**
 * 🌐 REMOTE BROWSER POSTER
 * Posts tweets through the local browser server running on your Mac
 */

import { log } from '../lib/logger';

interface PostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

export async function postTweetRemote(text: string): Promise<PostResult> {
  const BROWSER_SERVER_URL = null;
  const BROWSER_SERVER_SECRET = null;
  
  if (!BROWSER_SERVER_URL || !BROWSER_SERVER_SECRET) {
    return {
      success: false,
      error: 'BROWSER_SERVER_URL or BROWSER_SERVER_SECRET not configured'
    };
  }
  
  try {
    log({ op: 'remote_poster_start', url: BROWSER_SERVER_URL });
    
    const response = await fetch(`${BROWSER_SERVER_URL}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-browser-secret': BROWSER_SERVER_SECRET
      },
      body: JSON.stringify({ text })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      log({ op: 'remote_poster_complete', outcome: 'success', tweet_id: result.tweetId });
      return {
        success: true,
        tweetId: result.tweetId
      };
    } else {
      log({ op: 'remote_poster_complete', outcome: 'error', error: result.error });
      return {
        success: false,
        error: result.error || `HTTP ${response.status}`
      };
    }
    
  } catch (error: any) {
    console.error(`[REMOTE_POSTER] ❌ Network error:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function postThreadRemote(tweets: string[]): Promise<PostResult> {
  const BROWSER_SERVER_URL = process.env.BROWSER_SERVER_URL;
  const BROWSER_SERVER_SECRET = process.env.BROWSER_SERVER_SECRET;
  
  if (!BROWSER_SERVER_URL || !BROWSER_SERVER_SECRET) {
    return {
      success: false,
      error: 'BROWSER_SERVER_URL or BROWSER_SERVER_SECRET not configured'
    };
  }
  
  try {
    const response = await fetch(`${BROWSER_SERVER_URL}/thread`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-browser-secret': BROWSER_SERVER_SECRET
      },
      body: JSON.stringify({ tweets })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      return {
        success: true,
        tweetId: result.tweetIds?.[0] || 'thread_posted'
      };
    } else {
      return {
        success: false,
        error: result.error || `HTTP ${response.status}`
      };
    }
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}