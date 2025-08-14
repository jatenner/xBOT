#!/usr/bin/env ts-node

/**
 * TEST GROWTH ENGINE
 * 
 * Command-line tool to test the Human-Grade Growth Engine
 * Usage: npx ts-node tools/testGrowthEngine.ts
 */

import { testGrowthEngineSimple, executeSimulatedGrowthCycle } from '../src/agents/growthEngineIntegrationSimple';

async function main() {
  try {
    console.log('🧪 TESTING HUMAN-GRADE GROWTH ENGINE');
    console.log('=====================================\n');
    
    console.log('📋 Test 1: Mock Data Test');
    console.log('-------------------------');
    const mockResult = await testGrowthEngineSimple();
    
    console.log('\n📋 Test 2: Simulated Real-Time Test');
    console.log('-----------------------------------');
    const simulatedResult = await executeSimulatedGrowthCycle();
    
    // Use the simulated result for final output
    const result = simulatedResult;
    
    console.log('\n📊 GROWTH ENGINE OUTPUT:');
    console.log('========================');
    console.log('📋 Full JSON Output:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}