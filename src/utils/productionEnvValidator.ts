/**
 * 🛡️ PRODUCTION ENVIRONMENT VALIDATOR
 * Comprehensive validation and safe parsing of environment variables
 * Prevents all undefined, null, and malformed data issues
 */

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed: {
    [key: string]: any;
  };
}

export interface SafeEnvConfig {
  // Core API keys
  OPENAI_API_KEY: string;
  TWITTER_API_KEY: string;
  TWITTER_API_SECRET: string;
  TWITTER_ACCESS_TOKEN: string;
  TWITTER_ACCESS_TOKEN_SECRET: string;
  TWITTER_USERNAME: string;
  TWITTER_SCREEN_NAME: string;
  TWITTER_USER_ID: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  
  // Optional keys with defaults
  TWITTER_BEARER_TOKEN?: string;
  SUPABASE_ANON_KEY?: string;
  NEWS_API_KEY?: string;
  PEXELS_API_KEY?: string;
  
  // System configuration
  NODE_ENV: string;
  PORT: number;
  DAILY_BUDGET_LIMIT: number;
  MAX_DAILY_POSTS: number;
  
  // JSON configurations (safely parsed)
  POSTING_CONFIG?: any;
  BUDGET_CONFIG?: any;
  FEATURE_FLAGS?: any;
}

export class ProductionEnvValidator {
  
  /**
   * 🔍 COMPREHENSIVE ENVIRONMENT VALIDATION
   */
  static validateEnvironment(): EnvValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const parsed: any = {};

    try {
      // Required string variables
      const requiredStrings = [
        'OPENAI_API_KEY',
        'TWITTER_API_KEY', 
        'TWITTER_API_SECRET',
        'TWITTER_ACCESS_TOKEN',
        'TWITTER_ACCESS_TOKEN_SECRET',
        'TWITTER_USERNAME',
        'TWITTER_SCREEN_NAME',
        'TWITTER_USER_ID',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY'
      ];

      // Validate required strings
      for (const key of requiredStrings) {
        const value = this.safeGetEnv(key);
        if (!value || value.trim().length === 0) {
          errors.push(`Missing or empty required variable: ${key}`);
        } else {
          parsed[key] = value.trim();
        }
      }

      // Validate API key formats
      if (parsed.OPENAI_API_KEY && !parsed.OPENAI_API_KEY.startsWith('sk-')) {
        errors.push('OPENAI_API_KEY must start with "sk-"');
      }

      if (parsed.SUPABASE_URL && !parsed.SUPABASE_URL.startsWith('https://')) {
        errors.push('SUPABASE_URL must be a valid HTTPS URL');
      }

      if (parsed.SUPABASE_SERVICE_ROLE_KEY && 
          !parsed.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ') && 
          !parsed.SUPABASE_SERVICE_ROLE_KEY.startsWith('sbp_')) {
        warnings.push('SUPABASE_SERVICE_ROLE_KEY format may be incorrect');
      }

      // Validate Twitter credentials format
      if (parsed.TWITTER_ACCESS_TOKEN && !parsed.TWITTER_ACCESS_TOKEN.includes('-')) {
        errors.push('TWITTER_ACCESS_TOKEN should contain a hyphen (format: userid-token)');
      }

      if (parsed.TWITTER_USER_ID && !/^\d+$/.test(parsed.TWITTER_USER_ID)) {
        errors.push('TWITTER_USER_ID must be a numeric string');
      }

      if (parsed.TWITTER_SCREEN_NAME && (parsed.TWITTER_SCREEN_NAME.startsWith('@') || parsed.TWITTER_SCREEN_NAME.includes(' '))) {
        errors.push('TWITTER_SCREEN_NAME should not include @ symbol or spaces');
      }

      if (parsed.TWITTER_USERNAME && parsed.TWITTER_SCREEN_NAME && 
          parsed.TWITTER_USERNAME !== parsed.TWITTER_SCREEN_NAME) {
        warnings.push('TWITTER_USERNAME and TWITTER_SCREEN_NAME should match');
      }

      // Optional string variables
      const optionalStrings = [
        'TWITTER_BEARER_TOKEN',
        'SUPABASE_ANON_KEY', 
        'NEWS_API_KEY',
        'PEXELS_API_KEY'
      ];

      for (const key of optionalStrings) {
        const value = this.safeGetEnv(key);
        if (value) {
          parsed[key] = value.trim();
        } else {
          warnings.push(`Optional variable missing: ${key}`);
        }
      }

      // System configuration with defaults
      parsed.NODE_ENV = this.safeGetEnv('NODE_ENV', 'production');
      parsed.PORT = this.safeGetEnvNumber('PORT', 3000);
      parsed.DAILY_BUDGET_LIMIT = this.safeGetEnvNumber('DAILY_BUDGET_LIMIT', 7.5);
      parsed.MAX_DAILY_POSTS = this.safeGetEnvNumber('MAX_DAILY_POSTS', 17);

      // Safe JSON parsing with fallbacks
      parsed.POSTING_CONFIG = this.safeParseJSON('POSTING_CONFIG', {
        maxDailyPosts: 17,
        minHoursBetween: 2,
        activeHours: { start: 6, end: 22 }
      });

      parsed.BUDGET_CONFIG = this.safeParseJSON('BUDGET_CONFIG', {
        dailyLimit: 7.5,
        emergencyLimit: 7.25,
        operationsAllowed: true
      });

      parsed.FEATURE_FLAGS = this.safeParseJSON('FEATURE_FLAGS', {
        intelligentPosting: true,
        playwrightEnabled: true,
        budgetEnforcement: true
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        parsed
      };

    } catch (error) {
      errors.push(`Environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        valid: false,
        errors,
        warnings,
        parsed: {}
      };
    }
  }

  /**
   * 🔒 SAFE ENVIRONMENT VARIABLE ACCESS
   */
  static safeGetEnv(key: string, defaultValue: string = ''): string {
    try {
      const value = process.env[key];
      if (value === undefined || value === null) {
        return defaultValue;
      }
      return typeof value === 'string' ? value : String(value);
    } catch (error) {
      console.warn(`⚠️ Error accessing env var ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * 🔢 SAFE NUMBER PARSING
   */
  static safeGetEnvNumber(key: string, defaultValue: number): number {
    try {
      const value = this.safeGetEnv(key);
      if (!value) return defaultValue;
      
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    } catch (error) {
      console.warn(`⚠️ Error parsing number from ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * 📄 SAFE JSON PARSING
   */
  static safeParseJSON(key: string, defaultValue: any = {}): any {
    try {
      const value = this.safeGetEnv(key);
      if (!value || value.trim().length === 0) {
        return defaultValue;
      }

      // Clean common JSON issues
      let cleanValue = value.trim();
      
      // Remove wrapping quotes if present
      if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
          (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
        cleanValue = cleanValue.slice(1, -1);
      }

      // Attempt to parse
      const parsed = JSON.parse(cleanValue);
      
      // Validate it's an object/array
      if (parsed === null || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
        console.warn(`⚠️ ${key} parsed to non-object, using default`);
        return defaultValue;
      }

      return parsed;

    } catch (error) {
      console.warn(`⚠️ Failed to parse JSON from ${key}:`, error);
      console.warn(`⚠️ Raw value was: ${this.safeGetEnv(key).substring(0, 100)}...`);
      return defaultValue;
    }
  }

  /**
   * 🛡️ SAFE BOOLEAN PARSING
   */
  static safeGetEnvBoolean(key: string, defaultValue: boolean = false): boolean {
    try {
      const value = this.safeGetEnv(key).toLowerCase();
      if (value === 'true' || value === '1' || value === 'yes') return true;
      if (value === 'false' || value === '0' || value === 'no') return false;
      return defaultValue;
    } catch (error) {
      console.warn(`⚠️ Error parsing boolean from ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * 🔄 GET SAFE CONFIGURATION SINGLETON
   */
  private static cachedConfig: SafeEnvConfig | null = null;
  
  static getSafeConfig(): SafeEnvConfig {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    const validation = this.validateEnvironment();
    
    if (!validation.valid) {
      console.error('❌ Environment validation failed:', validation.errors);
      // Return minimal config to prevent crashes
      this.cachedConfig = {
        OPENAI_API_KEY: '',
        TWITTER_API_KEY: '',
        TWITTER_API_SECRET: '',
        TWITTER_ACCESS_TOKEN: '',
        TWITTER_ACCESS_TOKEN_SECRET: '',
        TWITTER_USERNAME: '',
        TWITTER_SCREEN_NAME: '',
        TWITTER_USER_ID: '',
        SUPABASE_URL: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
        NODE_ENV: 'production',
        PORT: 3000,
        DAILY_BUDGET_LIMIT: 7.5,
        MAX_DAILY_POSTS: 17
      };
    } else {
      this.cachedConfig = validation.parsed as SafeEnvConfig;
    }

    return this.cachedConfig;
  }

  /**
   * 🔄 REFRESH CACHED CONFIG
   */
  static refreshConfig(): SafeEnvConfig {
    this.cachedConfig = null;
    return this.getSafeConfig();
  }
}

// Export for convenience
export const safeConfig = ProductionEnvValidator.getSafeConfig();
export const { safeGetEnv, safeGetEnvNumber, safeParseJSON, safeGetEnvBoolean } = ProductionEnvValidator;