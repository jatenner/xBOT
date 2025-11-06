/**
 * Test judge interrogation system
 */

import 'dotenv/config';
import { judgeInterrogation } from '../src/ai/judgeInterrogation';

async function testInterrogation() {
  console.log('🧪 TESTING JUDGE INTERROGATION\n');
  
  const testCases = [
    {
      name: 'Content with strong claims',
      content: {
        text: "Cold showers increase norepinephrine by 250% (University of Prague study, 2000). This triggers brown fat activation and metabolic boost. Works best at 11°C for 3 minutes.",
        topic: 'cold exposure',
        generator: 'dataNerd'
      },
      expectedPass: true
    },
    {
      name: 'Content with weak/vague claims',
      content: {
        text: "Studies show that exercise is good for you. Many people report feeling better. Research suggests benefits.",
        topic: 'exercise',
        generator: 'generic'
      },
      expectedPass: false
    },
    {
      name: 'Content with no specific claims',
      content: {
        text: "Sleep is important for health. Getting enough rest helps your body recover. Most people need 7-9 hours.",
        topic: 'sleep',
        generator: 'generic'
      },
      expectedPass: true // No claims = passes (general content)
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`   Content: "${test.content.text.substring(0, 80)}..."`);
    
    try {
      const result = await judgeInterrogation.interrogateContent(test.content);
      
      console.log(`   ${result.passed ? '✅' : '❌'} ${result.passed ? 'PASSED' : 'FAILED'} - Score: ${result.score}`);
      console.log(`   Claims found: ${result.claims.length}`);
      console.log(`   Feedback: ${result.feedback.join('; ')}`);
      
      if (result.claims.length > 0) {
        console.log(`   Strong defenses: ${result.claims.filter(c => c.strong).length}/${result.claims.length}`);
      }
      
      if (result.passed === test.expectedPass) {
        console.log(`   ✅ Expected outcome`);
        passed++;
      } else {
        console.log(`   ⚠️ Unexpected outcome (expected ${test.expectedPass ? 'pass' : 'fail'})`);
        failed++;
      }
      
    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 RESULTS: ${passed}/${testCases.length} tests matched expectations`);
  
  if (passed === testCases.length) {
    console.log('🎉 INTERROGATION SYSTEM WORKING!');
  }
}

testInterrogation().catch(console.error);

