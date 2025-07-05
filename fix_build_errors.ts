/**
 * 🔧 BUILD ERROR FIXES
 * 
 * This file contains type fixes and compatibility adjustments
 * to ensure the Expert Intelligence System builds successfully
 */

// Export any missing types that might be needed
export interface BuildConfig {
  fallbackStaggerMinutes: number;
  maxPostsPerHour: number;
  maxPostsPerDay: number;
  minInterval: number;
  quality: {
    readabilityMin: number;
    credibilityMin: number;
  };
  postingStrategy: string;
  emergencyMode: boolean;
  disableLearning: boolean;
  dailyBudgetLimit: number;
  startupThrottling: boolean;
  respectOnlyRealTwitterLimits: boolean;
}

// Ensure all required types are available
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
      OPENAI_API_KEY: string;
      TWITTER_API_KEY: string;
      TWITTER_API_SECRET: string;
      TWITTER_ACCESS_TOKEN: string;
      TWITTER_ACCESS_TOKEN_SECRET: string;
      TWITTER_BEARER_TOKEN: string;
      PEXELS_API_KEY: string;
      NEWS_API_KEY: string;
      NODE_ENV?: string;
    }
  }
}

// Type compatibility fixes
export type CompatibilityFix = {
  // Add any missing type definitions here
  [key: string]: any;
};

// Ensure proper module exports
export default {}; 