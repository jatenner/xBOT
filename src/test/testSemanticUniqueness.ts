/**
 * 🧪 SEMANTIC UNIQUENESS CHECKER TEST
 * 
 * Test script to verify the semantic uniqueness functionality works correctly.
 * Run with: npm run build && node dist/test/testSemanticUniqueness.js
 */

import { isTweetTooSimilar, getTweetSimilarityReport } from '../utils/semanticUniquenessCheck';

async function testSemanticUniqueness() {
  console.log('🧪 === TESTING SEMANTIC UNIQUENESS CHECKER ===\n');

  // Test cases
  const testCases = [
    {
      name: 'Completely unique content',
      text: 'New breakthrough in quantum computing reveals potential for solving protein folding in minutes instead of years.'
    },
    {
      name: 'Health content - unique angle',
      text: 'Scientists discover that humming for 10 minutes daily can increase nitric oxide production by 15-fold, improving cardiovascular health.'
    },
    {
      name: 'Similar to common health content',
      text: 'Drinking water in the morning can boost your metabolism and help with weight loss. Stay hydrated for better health!'
    },
    {
      name: 'Very similar to above',
      text: 'Starting your day with water consumption can enhance metabolism and support weight management. Hydration is key to wellness!'
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n🔍 Test ${i + 1}: ${testCase.name}`);
    console.log(`📝 Text: "${testCase.text}"`);
    
    try {
      // Test basic uniqueness check
      const isTooSimilar = await isTweetTooSimilar(testCase.text);
      console.log(`🎯 Result: ${isTooSimilar ? '🛑 TOO SIMILAR' : '✅ UNIQUE'}`);
      
      // Get detailed similarity report
      const report = await getTweetSimilarityReport(testCase.text);
      console.log(`📊 Max similarity: ${(report.maxSimilarity * 100).toFixed(2)}%`);
      
      if (report.similarTweetContent) {
        console.log(`📋 Most similar to: "${report.similarTweetContent.substring(0, 100)}..."`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing "${testCase.name}":`, error.message);
    }
    
    console.log('─'.repeat(80));
  }

  console.log('\n✅ Semantic uniqueness testing completed!');
}

// Run the test
if (require.main === module) {
  testSemanticUniqueness().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { testSemanticUniqueness }; 