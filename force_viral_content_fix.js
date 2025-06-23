const { UltraViralGenerator } = require('./dist/agents/ultraViralGenerator');

async function testPureViralGeneration() {
  console.log('🚨 === TESTING PURE VIRAL GENERATION (NO API DEPENDENCIES) ===');
  
  const generator = new UltraViralGenerator();
  
  // Test the viral templates without external APIs
  const topics = [
    'AI drug discovery',
    'precision medicine', 
    'brain-computer interfaces',
    'gene therapy',
    'digital therapeutics'
  ];
  
  for (let i = 0; i < topics.length; i++) {
    console.log(`\n🔥 === VIRAL TEST ${i + 1}: ${topics[i]} ===`);
    
    try {
      // Force fallback to direct template generation (no external APIs)
      const result = await generator.generateFallbackTweet(topics[i]);
      
      console.log(`📝 Template: ${result.style}`);
      console.log(`🎯 Viral Score: ${result.viralScore}/100`);
      console.log(`📏 Length: ${result.characterCount} chars`);
      console.log(`\n💬 CONTENT:\n${result.content}\n`);
      console.log('─'.repeat(80));
      
    } catch (error) {
      console.error(`❌ Test ${i + 1} failed:`, error.message);
    }
  }
  
  console.log('\n✅ Pure viral template test complete!');
  console.log('🎯 This should show viral breakthrough content WITHOUT API dependencies');
}

testPureViralGeneration().catch(console.error);
