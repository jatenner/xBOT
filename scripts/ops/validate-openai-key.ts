#!/usr/bin/env tsx
/**
 * 🔍 OpenAI API Key Validation
 * 
 * Validates OpenAI API key using the same client code path as production.
 * Tests both direct env var access and the budgeted client wrapper.
 * 
 * Usage:
 *   pnpm run ops:validate:openai
 *   P1_MODE=true pnpm run ops:validate:openai
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local first (preferred), then .env (same pattern as daemon)
// MUST load before importing openaiBudgetedClient (it initializes singleton)
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Don't import openaiBudgetedClient at top level - it initializes singleton
// Import dynamically in testApiKey() after env is loaded

/**
 * Mask API key for logging (show first 6 chars + last 4 chars)
 */
function maskApiKey(key: string): string {
  if (!key || key.length < 10) {
    return '***';
  }
  return `${key.substring(0, 6)}…${key.substring(key.length - 4)}`;
}

/**
 * Analyze API key for common issues
 */
function analyzeApiKey(key: string | undefined): {
  present: boolean;
  length: number;
  masked: string;
  hasWhitespace: boolean;
  hasQuotes: boolean;
  prefix: string;
  issues: string[];
} {
  if (!key) {
    return {
      present: false,
      length: 0,
      masked: '***',
      hasWhitespace: false,
      hasQuotes: false,
      prefix: '',
      issues: ['OPENAI_API_KEY not set'],
    };
  }

  const trimmed = key.trim();
  const hasLeadingTrailingWhitespace = key !== trimmed;
  const hasQuotes = (key.startsWith('"') && key.endsWith('"')) || 
                   (key.startsWith("'") && key.endsWith("'"));
  const hasInternalWhitespace = /\s/.test(trimmed);
  const prefix = trimmed.substring(0, 6);

  const issues: string[] = [];
  if (hasLeadingTrailingWhitespace) {
    issues.push('has leading/trailing whitespace');
  }
  if (hasQuotes) {
    issues.push('has surrounding quotes');
  }
  if (hasInternalWhitespace) {
    issues.push('has internal whitespace');
  }
  if (!trimmed.startsWith('sk-')) {
    issues.push('does not start with "sk-"');
  }
  if (trimmed.length < 20) {
    issues.push('too short (expected >= 20 chars)');
  }

  return {
    present: true,
    length: trimmed.length,
    masked: maskApiKey(trimmed),
    hasWhitespace: hasLeadingTrailingWhitespace || hasInternalWhitespace,
    hasQuotes,
    prefix,
    issues,
  };
}

/**
 * Test API key using the same client path as production
 */
async function testApiKey(): Promise<{
  pass: boolean;
  statusCode?: number;
  errorMessage?: string;
  method: string;
}> {
  // Dynamically import after env is loaded to avoid singleton initialization issues
  const { createBudgetedChatCompletion } = await import('../../src/services/openaiBudgetedClient');
  
  try {
    // Use the same client wrapper used in production
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "ok" if you can read this.' },
      ],
      max_tokens: 10,
    }, {
      purpose: 'key_validation',
      requestId: `validate-${Date.now()}`,
    });

    if (response.choices && response.choices.length > 0) {
      return {
        pass: true,
        method: 'createBudgetedChatCompletion',
      };
    }

    return {
      pass: false,
      errorMessage: 'Empty response',
      method: 'createBudgetedChatCompletion',
    };
  } catch (error: any) {
    const statusCode = error.status || error.response?.status || 
                      (error.message?.includes('401') ? 401 : undefined);
    const errorMessage = error.message || String(error);

    return {
      pass: false,
      statusCode,
      errorMessage: errorMessage.substring(0, 200), // Limit length
      method: 'createBudgetedChatCompletion',
    };
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 OpenAI API Key Validation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1: Check env var directly (same as production code)
  const rawKey = process.env.OPENAI_API_KEY;
  const analysis = analyzeApiKey(rawKey);

  console.log('📋 Step 1: Environment Variable Analysis');
  console.log(`   Present: ${analysis.present ? '✅ yes' : '❌ no'}`);
  if (analysis.present) {
    console.log(`   Length: ${analysis.length} chars`);
    console.log(`   Masked: ${analysis.masked}`);
    console.log(`   Prefix: ${analysis.prefix}`);
    console.log(`   Has whitespace: ${analysis.hasWhitespace ? '⚠️  yes' : '✅ no'}`);
    console.log(`   Has quotes: ${analysis.hasQuotes ? '⚠️  yes' : '✅ no'}`);
    
    if (analysis.issues.length > 0) {
      console.log(`   ⚠️  Issues detected:`);
      analysis.issues.forEach(issue => {
        console.log(`      - ${issue}`);
      });
    } else {
      console.log(`   ✅ No formatting issues detected`);
    }
  }
  console.log();

  if (!analysis.present) {
    console.log('❌ FAIL: OPENAI_API_KEY not set');
    console.log('\n   Check:');
    console.log('   - .env.local file exists');
    console.log('   - OPENAI_API_KEY is defined');
    console.log('   - dotenv/config is imported');
    process.exit(1);
  }

  // Step 2: Test API key using production client path
  console.log('📋 Step 2: API Key Validation Test');
  console.log(`   Method: ${analysis.hasQuotes || analysis.hasWhitespace ? 'cleaned (trimmed/quotes removed)' : 'direct'}`);
  console.log(`   Client: createBudgetedChatCompletion (production path)`);
  console.log('   Testing...\n');

  const testResult = await testApiKey();

  if (testResult.pass) {
    console.log('✅ PASS: OpenAI API key is valid');
    console.log(`   Method: ${testResult.method}`);
    console.log(`   Status: 200 OK`);
    console.log('\n   The API key works correctly in the production client path.');
    process.exit(0);
  } else {
    console.log('❌ FAIL: OpenAI API key validation failed');
    console.log(`   Method: ${testResult.method}`);
    if (testResult.statusCode) {
      console.log(`   Status: ${testResult.statusCode}`);
    }
    if (testResult.errorMessage) {
      // Mask any potential secrets in error message
      const safeMessage = testResult.errorMessage
        .replace(/sk-[A-Za-z0-9]{20,}/g, 'sk-***')
        .substring(0, 300);
      console.log(`   Error: ${safeMessage}`);
    }

    console.log('\n   Troubleshooting:');
    if (testResult.statusCode === 401) {
      console.log('   - API key is invalid or expired');
      console.log('   - Check key at https://platform.openai.com/account/api-keys');
      if (analysis.hasQuotes || analysis.hasWhitespace) {
        console.log('   - Key was cleaned (quotes/whitespace removed) - verify original key');
      }
    } else if (testResult.statusCode === 429) {
      console.log('   - Rate limit exceeded (temporary)');
    } else {
      console.log('   - Check network connectivity');
      console.log('   - Verify OpenAI API status');
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ FATAL: Validation script error:', error.message);
  process.exit(1);
});
