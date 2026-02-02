#!/usr/bin/env tsx
/**
 * Verify OpenAI API Key
 * 
 * Tests the OpenAI API key by making a simple API call.
 */

import 'dotenv/config';
import OpenAI from 'openai';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is not set');
    process.exit(1);
  }
  
  console.log(`🔍 Testing OpenAI API key (length: ${apiKey.length}, prefix: ${apiKey.substring(0, 20)}...)`);
  
  try {
    const client = new OpenAI({ apiKey });
    
    // Simple API call: list models
    const models = await client.models.list();
    
    if (models.data && models.data.length > 0) {
      console.log(`✅ OpenAI API key is valid`);
      console.log(`   Found ${models.data.length} models`);
      console.log(`   Sample models: ${models.data.slice(0, 3).map(m => m.id).join(', ')}`);
      process.exit(0);
    } else {
      console.error('❌ Unexpected response: no models found');
      process.exit(1);
    }
  } catch (error: any) {
    if (error.status === 401 || error.message?.includes('401') || error.message?.includes('Incorrect API key')) {
      console.error('❌ OpenAI API key is invalid (401 Unauthorized)');
      console.error(`   Error: ${error.message}`);
      process.exit(1);
    } else {
      console.error(`❌ Error testing OpenAI API key: ${error.message}`);
      process.exit(1);
    }
  }
}

main().catch(console.error);
