/**
 * Official X API Poster
 * Uses the official Twitter API v2 for posting tweets
 */

import { getEnvConfig } from '../config/env';

export interface PostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

export class XApiPoster {
  private bearerToken: string;
  private accessToken?: string;
  private accessTokenSecret?: string;
  
  constructor() {
    const config = getEnvConfig();
    
    if (!config.X_API_BEARER_TOKEN) {
      throw new Error('X_API_BEARER_TOKEN is required for X API posting');
    }
    
    this.bearerToken = config.X_API_BEARER_TOKEN;
    this.accessToken = config.X_API_ACCESS_TOKEN;
    this.accessTokenSecret = config.X_API_ACCESS_TOKEN_SECRET;
  }

  async postStatus(text: string): Promise<PostResult> {
    try {
      console.log('X_API_POSTER: Posting tweet via official API...');
      
      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('X_API_POSTER: API error:', response.status, errorText);
        return {
          success: false,
          error: `X API error ${response.status}: ${errorText}`
        };
      }

      const result = await response.json();
      const tweetId = result.data?.id;
      
      if (!tweetId) {
        console.error('X_API_POSTER: No tweet ID in response:', result);
        return {
          success: false,
          error: 'No tweet ID returned from X API'
        };
      }

      console.log(`X_API_POSTER: Tweet posted successfully with ID: ${tweetId}`);
      return {
        success: true,
        tweetId: tweetId
      };

    } catch (error) {
      console.error('X_API_POSTER: Network error:', error);
      return {
        success: false,
        error: `Network error: ${error.message}`
      };
    }
  }
}
