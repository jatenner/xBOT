/**
 * 🚀 TWITTER AUTHENTICATION ENTERPRISE FIX
 * 
 * PURPOSE: Comprehensive Twitter authentication system with:
 * - Environment variable validation
 * - Secure credential management
 * - Robust error handling
 * - Session management
 * - Rate limiting integration
 */

import TwitterApi, { TwitterApiReadWrite } from 'twitter-api-v2';
import * as dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken?: string;
  userId?: string;
}

interface TwitterAuthResult {
  success: boolean;
  client?: TwitterApiReadWrite;
  error?: string;
  authStatus?: 'authenticated' | 'failed' | 'missing_credentials' | 'invalid_credentials';
}

interface TweetPostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  rateLimitStatus?: {
    remaining: number;
    resetTime: Date;
  };
}

class TwitterAuthenticationManager {
  private static instance: TwitterAuthenticationManager;
  private client: TwitterApiReadWrite | null = null;
  private credentials: TwitterCredentials | null = null;
  private authStatus: 'authenticated' | 'failed' | 'pending' = 'pending';
  private lastAuthAttempt: Date | null = null;
  private rateLimitInfo: any = null;

  private constructor() {
    this.validateAndLoadCredentials();
  }

  public static getInstance(): TwitterAuthenticationManager {
    if (!TwitterAuthenticationManager.instance) {
      TwitterAuthenticationManager.instance = new TwitterAuthenticationManager();
    }
    return TwitterAuthenticationManager.instance;
  }

  /**
   * Validate and load Twitter credentials from environment variables
   */
  private validateAndLoadCredentials(): TwitterAuthResult {
    try {
      console.log('🔐 Validating Twitter API credentials...');

      // Check for required environment variables
      const requiredEnvVars = [
        'TWITTER_API_KEY',
        'TWITTER_API_SECRET', 
        'TWITTER_ACCESS_TOKEN',
        'TWITTER_ACCESS_TOKEN_SECRET'
      ];

      const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
      
      if (missingVars.length > 0) {
        const error = `❌ Missing required Twitter environment variables: ${missingVars.join(', ')}`;
        console.error(error);
        console.error('📋 Required environment variables:');
        console.error('   TWITTER_API_KEY=your_api_key_here');
        console.error('   TWITTER_API_SECRET=your_api_secret_here');
        console.error('   TWITTER_ACCESS_TOKEN=your_access_token_here');
        console.error('   TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here');
        console.error('   TWITTER_BEARER_TOKEN=your_bearer_token_here (optional)');
        console.error('   TWITTER_USER_ID=your_numeric_user_id (optional)');
        
        this.authStatus = 'failed';
        return {
          success: false,
          error,
          authStatus: 'missing_credentials'
        };
      }

      // Load credentials
      this.credentials = {
        apiKey: process.env.TWITTER_API_KEY!,
        apiSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
        bearerToken: process.env.TWITTER_BEARER_TOKEN,
        userId: process.env.TWITTER_USER_ID
      };

      // Validate credential formats
      const validationResult = this.validateCredentialFormats(this.credentials);
      if (!validationResult.success) {
        this.authStatus = 'failed';
        return validationResult;
      }

      // Initialize Twitter client
      return this.initializeTwitterClient();

    } catch (error: any) {
      const errorMessage = `Failed to load Twitter credentials: ${error.message}`;
      console.error('❌', errorMessage);
      this.authStatus = 'failed';
      
      return {
        success: false,
        error: errorMessage,
        authStatus: 'failed'
      };
    }
  }

  /**
   * Validate credential formats to catch common issues early
   */
  private validateCredentialFormats(credentials: TwitterCredentials): TwitterAuthResult {
    try {
      console.log('🔍 Validating credential formats...');

      // API Key validation (typically 25 characters)
      if (credentials.apiKey.length < 20 || credentials.apiKey.length > 30) {
        return {
          success: false,
          error: `Invalid API Key format. Expected 20-30 characters, got ${credentials.apiKey.length}`,
          authStatus: 'invalid_credentials'
        };
      }

      // API Secret validation (typically 50 characters)
      if (credentials.apiSecret.length < 40 || credentials.apiSecret.length > 60) {
        return {
          success: false,
          error: `Invalid API Secret format. Expected 40-60 characters, got ${credentials.apiSecret.length}`,
          authStatus: 'invalid_credentials'
        };
      }

      // Access Token validation (format: numbers-alphanumeric)
      if (!credentials.accessToken.match(/^\d+-[A-Za-z0-9]+$/)) {
        return {
          success: false,
          error: 'Invalid Access Token format. Expected format: numbers-alphanumeric',
          authStatus: 'invalid_credentials'
        };
      }

      // Access Token Secret validation (typically 45 characters)
      if (credentials.accessTokenSecret.length < 40 || credentials.accessTokenSecret.length > 50) {
        return {
          success: false,
          error: `Invalid Access Token Secret format. Expected 40-50 characters, got ${credentials.accessTokenSecret.length}`,
          authStatus: 'invalid_credentials'
        };
      }

      // Bearer Token validation (if provided)
      if (credentials.bearerToken && !credentials.bearerToken.startsWith('AAAAAAAAAAAAAAAAAAA')) {
        console.warn('⚠️ Bearer Token format may be invalid. Expected to start with multiple A characters.');
      }

      console.log('✅ Credential formats validated successfully');
      return { success: true, authStatus: 'authenticated' };

    } catch (error: any) {
      return {
        success: false,
        error: `Credential validation failed: ${error.message}`,
        authStatus: 'invalid_credentials'
      };
    }
  }

  /**
   * Initialize Twitter API client with validated credentials
   */
  private initializeTwitterClient(): TwitterAuthResult {
    try {
      if (!this.credentials) {
        throw new Error('No credentials available for client initialization');
      }

      console.log('🐦 Initializing Twitter API client...');

      // Create Twitter API client
      const twitterApi = new TwitterApi({
        appKey: this.credentials.apiKey,
        appSecret: this.credentials.apiSecret,
        accessToken: this.credentials.accessToken,
        accessSecret: this.credentials.accessTokenSecret,
      });

      // Get read-write client
      this.client = twitterApi.readWrite;
      this.authStatus = 'authenticated';
      this.lastAuthAttempt = new Date();

      console.log('✅ Twitter API client initialized successfully');
      
      // Log authentication status
      if (this.credentials.userId) {
        console.log(`📱 Authenticated for Twitter User ID: ${this.credentials.userId}`);
      }

      return {
        success: true,
        client: this.client,
        authStatus: 'authenticated'
      };

    } catch (error: any) {
      const errorMessage = `Failed to initialize Twitter client: ${error.message}`;
      console.error('❌', errorMessage);
      this.authStatus = 'failed';
      
      return {
        success: false,
        error: errorMessage,
        authStatus: 'failed'
      };
    }
  }

  /**
   * Get authenticated Twitter client
   */
  public getClient(): TwitterApiReadWrite | null {
    if (this.authStatus !== 'authenticated' || !this.client) {
      console.warn('⚠️ Twitter client not authenticated. Attempting re-authentication...');
      const result = this.validateAndLoadCredentials();
      if (!result.success) {
        return null;
      }
    }
    
    return this.client;
  }

  /**
   * Check authentication status
   */
  public getAuthStatus(): {
    authenticated: boolean;
    status: string;
    lastAttempt?: Date;
    userId?: string;
  } {
    return {
      authenticated: this.authStatus === 'authenticated',
      status: this.authStatus,
      lastAttempt: this.lastAuthAttempt || undefined,
      userId: this.credentials?.userId
    };
  }

  /**
   * Post a tweet with comprehensive error handling
   */
  public async postTweet(content: string): Promise<TweetPostResult> {
    try {
      const client = this.getClient();
      if (!client) {
        return {
          success: false,
          error: 'Twitter client not authenticated'
        };
      }

      console.log('📝 Posting tweet...');
      console.log(`📄 Content: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);

      // Validate content length
      if (content.length > 280) {
        return {
          success: false,
          error: `Tweet content too long: ${content.length} characters (max 280)`
        };
      }

      if (content.length === 0) {
        return {
          success: false,
          error: 'Tweet content cannot be empty'
        };
      }

      // Post the tweet
      const result = await client.v2.tweet(content);

      console.log(`✅ Tweet posted successfully!`);
      console.log(`🔗 Tweet ID: ${result.data.id}`);

      // Get rate limit info if available
      let rateLimitStatus;
      try {
        const rateLimitResponse = await client.v1.getRateLimitStatus();
        if (rateLimitResponse && rateLimitResponse.resources?.statuses) {
          const statusLimits = rateLimitResponse.resources.statuses['/statuses/update'];
          if (statusLimits) {
            rateLimitStatus = {
              remaining: statusLimits.remaining,
              resetTime: new Date(statusLimits.reset * 1000)
            };
          }
        }
      } catch (rateLimitError) {
        console.warn('⚠️ Could not fetch rate limit status:', rateLimitError);
      }

      return {
        success: true,
        tweetId: result.data.id,
        rateLimitStatus
      };

    } catch (error: any) {
      console.error('❌ Failed to post tweet:', error);

      // Handle specific Twitter API errors
      let errorMessage = 'Failed to post tweet';
      
      if (error.code === 187) {
        errorMessage = 'Duplicate tweet detected';
      } else if (error.code === 420) {
        errorMessage = 'Rate limit exceeded';
      } else if (error.code === 401) {
        errorMessage = 'Authentication failed - check credentials';
        this.authStatus = 'failed';
      } else if (error.code === 403) {
        errorMessage = 'Forbidden - account may be suspended or tweet violates rules';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Test authentication by making a simple API call
   */
  public async testAuthentication(): Promise<TwitterAuthResult> {
    try {
      const client = this.getClient();
      if (!client) {
        return {
          success: false,
          error: 'No authenticated client available',
          authStatus: 'failed'
        };
      }

      console.log('🧪 Testing Twitter authentication...');

      // Test with a simple API call
      const user = await client.v2.me();
      
      console.log('✅ Authentication test successful!');
      console.log(`👤 Authenticated as: @${user.data.username} (${user.data.name})`);
      console.log(`📊 User ID: ${user.data.id}`);

      return {
        success: true,
        client: this.client!,
        authStatus: 'authenticated'
      };

    } catch (error: any) {
      console.error('❌ Authentication test failed:', error);
      this.authStatus = 'failed';

      return {
        success: false,
        error: `Authentication test failed: ${error.message}`,
        authStatus: 'failed'
      };
    }
  }

  /**
   * Get comprehensive authentication diagnostics
   */
  public async getDiagnostics(): Promise<{
    credentialsLoaded: boolean;
    credentialFormats: { [key: string]: boolean };
    clientInitialized: boolean;
    authenticationWorking: boolean;
    rateLimitStatus?: any;
    userInfo?: any;
    recommendations: string[];
  }> {
    const diagnostics = {
      credentialsLoaded: !!this.credentials,
      credentialFormats: {},
      clientInitialized: !!this.client,
      authenticationWorking: false,
      recommendations: [] as string[]
    };

    // Check credential formats
    if (this.credentials) {
      diagnostics.credentialFormats = {
        apiKey: this.credentials.apiKey.length >= 20 && this.credentials.apiKey.length <= 30,
        apiSecret: this.credentials.apiSecret.length >= 40 && this.credentials.apiSecret.length <= 60,
        accessToken: /^\d+-[A-Za-z0-9]+$/.test(this.credentials.accessToken),
        accessTokenSecret: this.credentials.accessTokenSecret.length >= 40 && this.credentials.accessTokenSecret.length <= 50
      };
    }

    // Test authentication
    try {
      const authTest = await this.testAuthentication();
      diagnostics.authenticationWorking = authTest.success;
      
      if (authTest.success && this.client) {
        // Get user info
        const user = await this.client.v2.me();
        diagnostics.userInfo = {
          id: user.data.id,
          username: user.data.username,
          name: user.data.name
        };

        // Get rate limit status
        try {
          diagnostics.rateLimitStatus = await this.client.v1.getRateLimitStatus();
        } catch (error) {
          diagnostics.recommendations.push('Rate limit status unavailable - may indicate API access issues');
        }
      }
    } catch (error) {
      diagnostics.recommendations.push('Authentication test failed - check credentials and API access');
    }

    // Generate recommendations
    if (!diagnostics.credentialsLoaded) {
      diagnostics.recommendations.push('Load Twitter API credentials in environment variables');
    }

    if (diagnostics.credentialsLoaded && Object.values(diagnostics.credentialFormats).some(valid => !valid)) {
      diagnostics.recommendations.push('Check credential formats - some appear invalid');
    }

    if (!diagnostics.clientInitialized) {
      diagnostics.recommendations.push('Twitter client failed to initialize - check credentials');
    }

    if (!diagnostics.authenticationWorking) {
      diagnostics.recommendations.push('Authentication not working - verify credentials with Twitter Developer Portal');
    }

    return diagnostics;
  }

  /**
   * Force re-authentication
   */
  public async forceReauth(): Promise<TwitterAuthResult> {
    console.log('🔄 Forcing re-authentication...');
    this.client = null;
    this.credentials = null;
    this.authStatus = 'pending';
    this.lastAuthAttempt = null;
    
    return this.validateAndLoadCredentials();
  }
}

// Export singleton instance
export const twitterAuth = TwitterAuthenticationManager.getInstance();

// Export types for use in other modules
export type { TwitterCredentials, TwitterAuthResult, TweetPostResult };

// Export class for direct instantiation if needed
export { TwitterAuthenticationManager };

// Default export
export default twitterAuth;