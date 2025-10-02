/**
 * 🌐 REMOTE BROWSER POSTER
 * Posts tweets via local browser server instead of Railway's browser
 */

import axios from 'axios';

const BROWSER_SERVER_URL = process.env.BROWSER_SERVER_URL || 'http://localhost:3100';
const BROWSER_SERVER_SECRET = process.env.BROWSER_SERVER_SECRET || '';

interface PostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  postedAt?: string;
}

interface ThreadResult {
  success: boolean;
  tweetIds?: string[];
  error?: string;
  postedAt?: string;
  partialIds?: string[];
}

/**
 * Post a single tweet via remote browser
 */
export async function postTweetRemote(text: string): Promise<PostResult> {
  if (!BROWSER_SERVER_URL || !BROWSER_SERVER_SECRET) {
    console.error('[REMOTE_POSTER] ❌ BROWSER_SERVER_URL or BROWSER_SERVER_SECRET not configured');
    return {
      success: false,
      error: 'Remote browser not configured'
    };
  }

  console.log(`[REMOTE_POSTER] 📡 Sending tweet to local browser (${text.length} chars)...`);
  
  try {
    const response = await axios.post<PostResult>(
      `${BROWSER_SERVER_URL}/post`,
      { text },
      {
        headers: {
          'Authorization': `Bearer ${BROWSER_SERVER_SECRET}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout
      }
    );

    if (response.data.success) {
      console.log(`[REMOTE_POSTER] ✅ Posted successfully via local browser! ID: ${response.data.tweetId}`);
    } else {
      console.error(`[REMOTE_POSTER] ❌ Remote posting failed: ${response.data.error}`);
    }

    return response.data;
    
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
    console.error(`[REMOTE_POSTER] ❌ Request failed: ${errorMsg}`);
    
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Post a thread via remote browser
 */
export async function postThreadRemote(tweets: string[]): Promise<ThreadResult> {
  if (!BROWSER_SERVER_URL || !BROWSER_SERVER_SECRET) {
    console.error('[REMOTE_POSTER] ❌ BROWSER_SERVER_URL or BROWSER_SERVER_SECRET not configured');
    return {
      success: false,
      error: 'Remote browser not configured'
    };
  }

  console.log(`[REMOTE_POSTER] 📡 Sending thread to local browser (${tweets.length} tweets)...`);
  
  try {
    const response = await axios.post<ThreadResult>(
      `${BROWSER_SERVER_URL}/thread`,
      { tweets },
      {
        headers: {
          'Authorization': `Bearer ${BROWSER_SERVER_SECRET}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 minute timeout for threads
      }
    );

    if (response.data.success) {
      console.log(`[REMOTE_POSTER] ✅ Thread posted successfully via local browser!`);
    } else {
      console.error(`[REMOTE_POSTER] ❌ Remote thread posting failed: ${response.data.error}`);
    }

    return response.data;
    
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
    console.error(`[REMOTE_POSTER] ❌ Request failed: ${errorMsg}`);
    
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Check if remote browser server is healthy
 */
export async function checkRemoteBrowserHealth(): Promise<boolean> {
  if (!BROWSER_SERVER_URL) {
    return false;
  }

  try {
    const response = await axios.get(`${BROWSER_SERVER_URL}/health`, {
      timeout: 5000
    });
    
    const isHealthy = response.data.status === 'ok';
    if (isHealthy) {
      console.log('[REMOTE_POSTER] ✅ Remote browser server is healthy');
    }
    return isHealthy;
    
  } catch (error) {
    console.log('[REMOTE_POSTER] ⚠️ Remote browser server not reachable');
    return false;
  }
}

