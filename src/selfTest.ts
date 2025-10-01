/**
 * Self-Test Module
 * Validates core system functionality:
 * - Environment variables
 * - OpenAI API access
 * - Database connectivity
 */

import { getEnvConfig, validateEnvOrExit } from './config/envFlags';
import { createBudgetedChatCompletion } from './services/openaiBudgetedClient';
import { getSupabaseClient } from './db/index';

export async function run(): Promise<void> {
  console.log('🧪 Running self-test...');
  console.log('');
  
  let passCount = 0;
  let failCount = 0;
  
  // Test 1: Environment variables
  try {
    console.log('1️⃣  Testing environment variables...');
    const config = getEnvConfig();
    
    if (!config.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
    if (!config.REDIS_URL) throw new Error('REDIS_URL missing');
    if (!config.SUPABASE_URL) throw new Error('SUPABASE_URL missing');
    
    console.log('   ✅ Environment variables validated');
    console.log(`   MODE: ${config.MODE}`);
    passCount++;
  } catch (error: any) {
    console.error('   ❌ Environment validation failed:', error.message);
    failCount++;
  }
  
  // Test 2: OpenAI API
  try {
    console.log('2️⃣  Testing OpenAI API...');
    const response = await createBudgetedChatCompletion(
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "test successful" in 2 words' }],
        max_tokens: 10
      },
      { purpose: 'self_test' }
    );
    
    const content = response.choices[0]?.message?.content || '';
    console.log(`   ✅ OpenAI API accessible (response: "${content}")`);
    passCount++;
  } catch (error: any) {
    console.error('   ❌ OpenAI API test failed:', error.message);
    failCount++;
  }
  
  // Test 3: Database connectivity
  try {
    console.log('3️⃣  Testing database connectivity...');
    const supabase = getSupabaseClient();
    
    // Insert a test record
    const testId = `self_test_${Date.now()}`;
    const { error: insertError } = await supabase
      .from('api_usage')
      .insert({
        intent: 'self_test',
        model: 'test',
        prompt_tokens: 0,
        completion_tokens: 0,
        cost_usd: 0,
        meta: { test: true, timestamp: new Date().toISOString() }
      });
    
    if (insertError) throw insertError;
    
    // Query it back
    const { data, error: selectError } = await supabase
      .from('api_usage')
      .select('*')
      .eq('intent', 'self_test')
      .limit(1)
      .single();
    
    if (selectError) throw selectError;
    
    console.log('   ✅ Database round-trip successful');
    passCount++;
  } catch (error: any) {
    console.error('   ❌ Database test failed:', error.message);
    failCount++;
  }
  
  // Summary
  console.log('');
  console.log('═══════════════════════════════════');
  console.log(`Tests passed: ${passCount}/3`);
  console.log(`Tests failed: ${failCount}/3`);
  console.log('═══════════════════════════════════');
  
  if (failCount > 0) {
    console.error('❌ Self-test FAILED');
    process.exit(1);
  } else {
    console.log('✅ Self-test PASSED');
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  run().catch(error => {
    console.error('Self-test crashed:', error);
    process.exit(1);
  });
}

