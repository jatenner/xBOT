/**
 * Test all 21 generators to ensure they work
 */

import 'dotenv/config';
import { generatePopCultureContent } from '../src/generators/popCultureAnalystGenerator';
import { generateTeacherContent } from '../src/generators/teacherGenerator';
import { generateInvestigatorContent } from '../src/generators/investigatorGenerator';
import { generateConnectorContent } from '../src/generators/connectorGenerator';
import { generatePragmatistContent } from '../src/generators/pragmatistGenerator';
import { generateHistorianContent } from '../src/generators/historianGenerator';
import { generateTranslatorContent } from '../src/generators/translatorGenerator';
import { generatePatternFinderContent } from '../src/generators/patternFinderGenerator';
import { generateExperimenterContent } from '../src/generators/experimenterGenerator';

async function testGenerators() {
  console.log('🧪 TESTING NEW GENERATORS\n');
  
  const tests = [
    {
      name: 'Pop Culture Analyst',
      fn: () => generatePopCultureContent({
        topic: "Peter Attia's Zone 2 cardio protocol",
        format: 'single'
      })
    },
    {
      name: 'Teacher',
      fn: () => generateTeacherContent({
        topic: 'how insulin resistance works',
        format: 'single'
      })
    },
    {
      name: 'Investigator',
      fn: () => generateInvestigatorContent({
        topic: 'cold shower research evidence',
        format: 'single'
      })
    },
    {
      name: 'Connector',
      fn: () => generateConnectorContent({
        topic: 'gut-brain axis connection',
        format: 'single'
      })
    },
    {
      name: 'Pragmatist',
      fn: () => generatePragmatistContent({
        topic: 'realistic sleep optimization',
        format: 'single'
      })
    },
    {
      name: 'Historian',
      fn: () => generateHistorianContent({
        topic: 'discovery of vitamins',
        format: 'single'
      })
    },
    {
      name: 'Translator',
      fn: () => generateTranslatorContent({
        topic: 'metabolic syndrome in plain English',
        format: 'single'
      })
    },
    {
      name: 'Pattern Finder',
      fn: () => generatePatternFinderContent({
        topic: 'dose-response in health',
        format: 'single'
      })
    },
    {
      name: 'Experimenter',
      fn: () => generateExperimenterContent({
        topic: 'testing cold exposure protocols',
        format: 'single'
      })
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`\n📝 Testing: ${test.name}...`);
      const result = await test.fn();
      
      if (result.content && result.content.length > 10) {
        console.log(`   ✅ PASS - Generated ${result.content.length} chars`);
        console.log(`   Preview: ${result.content.substring(0, 100)}...`);
        passed++;
      } else {
        console.log(`   ❌ FAIL - Content too short or empty`);
        failed++;
      }
      
    } catch (error: any) {
      console.log(`   ❌ FAIL - ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 RESULTS: ${passed}/9 passed, ${failed}/9 failed`);
  
  if (passed === 9) {
    console.log('🎉 ALL NEW GENERATORS WORKING!');
  } else {
    console.warn('⚠️ Some generators failed - check errors above');
  }
}

testGenerators().catch(console.error);

