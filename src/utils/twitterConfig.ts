/**
 * 🐦 TWITTER CONFIGURATION SERVICE
 * Production-safe Twitter authentication and configuration management
 * Handles all Twitter environment variables with comprehensive validation
 */

import { ProductionEnvValidator, safeGetEnv, safeGetEnvNumber } from './productionEnvValidator';

export interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken?: string;
}

export interface TwitterUserInfo {
  userId: string;
  username: string;
  screenName: string;
  userIdNumeric: number;
}

export interface TwitterConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  credentials?: TwitterCredentials;
  userInfo?: TwitterUserInfo;
}

export class TwitterConfigService {
  
  private static cachedConfig: {
    credentials?: TwitterCredentials;
    userInfo?: TwitterUserInfo;
    validationResult?: TwitterConfigValidation;
  } = {};

  /**
   * 🔍 COMPREHENSIVE TWITTER CONFIGURATION VALIDATION
   */
  static validateTwitterConfig(): TwitterConfigValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      console.log('🔐 Validating Twitter configuration...');

      // Get all required Twitter environment variables
      const apiKey = safeGetEnv('TWITTER_API_KEY');
      const apiSecret = safeGetEnv('TWITTER_API_SECRET');
      const accessToken = safeGetEnv('TWITTER_ACCESS_TOKEN');
      const accessTokenSecret = safeGetEnv('TWITTER_ACCESS_TOKEN_SECRET');
      const username = safeGetEnv('TWITTER_USERNAME');
      const screenName = safeGetEnv('TWITTER_SCREEN_NAME');
      const userId = safeGetEnv('TWITTER_USER_ID');
      const bearerToken = safeGetEnv('TWITTER_BEARER_TOKEN');

      // Validate required credentials
      if (!apiKey || apiKey.length < 10) {
        errors.push('TWITTER_API_KEY is missing or too short');
      }

      if (!apiSecret || apiSecret.length < 20) {
        errors.push('TWITTER_API_SECRET is missing or too short');
      }

      if (!accessToken || !accessToken.includes('-')) {
        errors.push('TWITTER_ACCESS_TOKEN is missing or invalid format (should contain hyphen)');
      }

      if (!accessTokenSecret || accessTokenSecret.length < 20) {
        errors.push('TWITTER_ACCESS_TOKEN_SECRET is missing or too short');
      }

      if (!username || username.trim().length === 0) {
        errors.push('TWITTER_USERNAME is missing');
      }

      if (!screenName || screenName.trim().length === 0) {
        errors.push('TWITTER_SCREEN_NAME is missing');
      }

      if (!userId || !/^\d+$/.test(userId)) {
        errors.push('TWITTER_USER_ID is missing or not a valid numeric string');
      }

      // Validate format consistency
      if (username && screenName && username !== screenName) {
        warnings.push(`TWITTER_USERNAME (${username}) and TWITTER_SCREEN_NAME (${screenName}) don't match`);
      }

      // Validate access token format
      if (accessToken && userId) {
        const expectedPrefix = `${userId}-`;
        if (!accessToken.startsWith(expectedPrefix)) {
          warnings.push(`TWITTER_ACCESS_TOKEN should start with ${expectedPrefix}`);
        }
      }

      // Check optional bearer token
      if (!bearerToken || bearerToken.length < 50) {
        warnings.push('TWITTER_BEARER_TOKEN is missing or too short (some features may be limited)');
      }

      // If validation passed, create configuration objects
      let credentials: TwitterCredentials | undefined;
      let userInfo: TwitterUserInfo | undefined;

      if (errors.length === 0) {
        credentials = {
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
          accessToken: accessToken.trim(),
          accessTokenSecret: accessTokenSecret.trim(),
          bearerToken: bearerToken ? bearerToken.trim() : undefined
        };

        userInfo = {
          userId: userId.trim(),
          username: username.trim(),
          screenName: screenName.trim(),
          userIdNumeric: parseInt(userId, 10)
        };

        console.log('✅ Twitter configuration validation successful');
        console.log(`👤 Account: @${userInfo.screenName} (ID: ${userInfo.userId})`);
        console.log(`🔑 Credentials: API Key, Secret, Access Token, Secret${bearerToken ? ', Bearer Token' : ''}`);
      } else {
        console.error('❌ Twitter configuration validation failed');
        errors.forEach(error => console.error(`   - ${error}`));
      }

      if (warnings.length > 0) {
        console.warn('⚠️ Twitter configuration warnings:');
        warnings.forEach(warning => console.warn(`   - ${warning}`));
      }

      const result: TwitterConfigValidation = {
        valid: errors.length === 0,
        errors,
        warnings,
        credentials,
        userInfo
      };

      // Cache the result
      this.cachedConfig.validationResult = result;
      this.cachedConfig.credentials = credentials;
      this.cachedConfig.userInfo = userInfo;

      return result;

    } catch (error) {
      const errorMessage = `Twitter configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMessage);
      
      return {
        valid: false,
        errors: [errorMessage],
        warnings: []
      };
    }
  }

  /**
   * 🔑 GET SAFE TWITTER CREDENTIALS
   */
  static getTwitterCredentials(): TwitterCredentials {
    // Use cached result if available
    if (this.cachedConfig.credentials) {
      return this.cachedConfig.credentials;
    }

    // Validate and get credentials
    const validation = this.validateTwitterConfig();
    
    if (!validation.valid || !validation.credentials) {
      console.error('❌ Cannot get Twitter credentials - validation failed');
      // Return safe defaults to prevent crashes
      return {
        apiKey: 'INVALID',
        apiSecret: 'INVALID',
        accessToken: 'INVALID',
        accessTokenSecret: 'INVALID'
      };
    }

    return validation.credentials;
  }

  /**
   * 👤 GET SAFE TWITTER USER INFO
   */
  static getTwitterUserInfo(): TwitterUserInfo {
    // Use cached result if available
    if (this.cachedConfig.userInfo) {
      return this.cachedConfig.userInfo;
    }

    // Validate and get user info
    const validation = this.validateTwitterConfig();
    
    if (!validation.valid || !validation.userInfo) {
      console.error('❌ Cannot get Twitter user info - validation failed');
      // Return safe defaults to prevent crashes
      return {
        userId: '0',
        username: 'INVALID',
        screenName: 'INVALID',
        userIdNumeric: 0
      };
    }

    return validation.userInfo;
  }

  /**
   * 🏷️ GET MENTION TAG (for replies and mentions)
   */
  static getMentionTag(): string {
    const userInfo = this.getTwitterUserInfo();
    return `@${userInfo.screenName}`;
  }

  /**
   * 🆔 GET NUMERIC USER ID (for API calls requiring numeric ID)
   */
  static getNumericUserId(): number {
    const userInfo = this.getTwitterUserInfo();
    return userInfo.userIdNumeric;
  }

  /**
   * 📝 GET DISPLAY NAME (for logging and UI)
   */
  static getDisplayName(): string {
    const userInfo = this.getTwitterUserInfo();
    return `@${userInfo.screenName} (${userInfo.userId})`;
  }

  /**
   * 🔄 REFRESH CONFIGURATION (clear cache and re-validate)
   */
  static refreshConfiguration(): TwitterConfigValidation {
    this.cachedConfig = {};
    return this.validateTwitterConfig();
  }

  /**
   * 🧪 TEST TWITTER CONFIGURATION
   */
  static testConfiguration(): {
    success: boolean;
    tests: Array<{ name: string; passed: boolean; details: string; }>;
  } {
    console.log('🧪 Testing Twitter configuration...');
    
    const tests = [
      { name: 'Environment Variables', passed: false, details: '' },
      { name: 'Credential Format', passed: false, details: '' },
      { name: 'User Info', passed: false, details: '' },
      { name: 'API Compatibility', passed: false, details: '' }
    ];

    try {
      // Test 1: Environment variables
      const validation = this.validateTwitterConfig();
      tests[0].passed = validation.valid;
      tests[0].details = validation.valid 
        ? 'All environment variables present and valid'
        : `${validation.errors.length} errors: ${validation.errors.join(', ')}`;

      // Test 2: Credential format
      if (validation.credentials) {
        const creds = validation.credentials;
        const formatValid = creds.apiKey.length > 10 && 
                           creds.apiSecret.length > 20 && 
                           creds.accessToken.includes('-') && 
                           creds.accessTokenSecret.length > 20;
        
        tests[1].passed = formatValid;
        tests[1].details = formatValid 
          ? 'All credential formats are valid'
          : 'One or more credentials have invalid format';
      } else {
        tests[1].details = 'Cannot test - credentials not available';
      }

      // Test 3: User info
      if (validation.userInfo) {
        const userInfo = validation.userInfo;
        const userInfoValid = userInfo.userId.length > 0 && 
                              userInfo.userIdNumeric > 0 && 
                              userInfo.screenName.length > 0;
        
        tests[2].passed = userInfoValid;
        tests[2].details = userInfoValid 
          ? `User: @${userInfo.screenName} (${userInfo.userId})`
          : 'User info is incomplete';
      } else {
        tests[2].details = 'Cannot test - user info not available';
      }

      // Test 4: API compatibility
      try {
        const credentials = this.getTwitterCredentials();
        const userInfo = this.getTwitterUserInfo();
        const mentionTag = this.getMentionTag();
        
        tests[3].passed = credentials.apiKey !== 'INVALID' && 
                         userInfo.userId !== '0' && 
                         mentionTag.startsWith('@');
        tests[3].details = tests[3].passed 
          ? `Ready for Twitter API: ${mentionTag}`
          : 'API compatibility check failed';
      } catch (error) {
        tests[3].details = `API test error: ${error instanceof Error ? error.message : 'Unknown'}`;
      }

      const allPassed = tests.every(test => test.passed);
      
      console.log(`📊 Configuration test results: ${tests.filter(t => t.passed).length}/${tests.length} passed`);
      
      return {
        success: allPassed,
        tests
      };

    } catch (error) {
      console.error('❌ Twitter configuration test failed:', error);
      return {
        success: false,
        tests: tests.map(test => ({
          ...test,
          details: test.details || `Test failed: ${error instanceof Error ? error.message : 'Unknown'}`
        }))
      };
    }
  }
}

// Export convenience functions
export const getTwitterCredentials = TwitterConfigService.getTwitterCredentials;
export const getTwitterUserInfo = TwitterConfigService.getTwitterUserInfo;
export const getMentionTag = TwitterConfigService.getMentionTag;
export const getNumericUserId = TwitterConfigService.getNumericUserId;
export const getDisplayName = TwitterConfigService.getDisplayName;