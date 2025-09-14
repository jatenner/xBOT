#!/usr/bin/env node
/**
 * CI Guardrail: Check for direct OpenAI imports outside the budgeted client
 * This prevents bypassing budget enforcement
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Files that are allowed to import OpenAI directly
const ALLOWED_FILES = [
  'src/services/openaiBudgetedClient.ts',
  'src/services/openaiWrapper.ts', // Legacy compatibility wrapper
  'src/ai/megaPromptSystem.ts' // Has import but uses budgeted client
];

// Patterns to search for
const DIRECT_IMPORT_PATTERNS = [
  "from 'openai'",
  'from "openai"',
  'import OpenAI',
  'require("openai")',
  "require('openai')"
];

const DIRECT_USAGE_PATTERNS = [
  '.chat.completions.create',
  '.embeddings.create',
  '.images.generate',
  'openai.chat.',
  'openai.embeddings.',
  'openai.images.'
];

function findViolations() {
  const violations = [];
  
  try {
    // Search for direct imports
    for (const pattern of DIRECT_IMPORT_PATTERNS) {
      try {
        const result = execSync(`grep -r "${pattern}" src/ --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" || true`, { encoding: 'utf8' });
        
        if (result.trim()) {
          const lines = result.trim().split('\n');
          for (const line of lines) {
            const [file, ...contentParts] = line.split(':');
            const content = contentParts.join(':');
            
            // Skip allowed files
            if (ALLOWED_FILES.some(allowed => file.includes(allowed))) {
              continue;
            }
            
            violations.push({
              type: 'DIRECT_IMPORT',
              file,
              content: content.trim(),
              pattern
            });
          }
        }
      } catch (error) {
        // Ignore grep errors (no matches)
      }
    }
    
    // Search for direct usage patterns
    for (const pattern of DIRECT_USAGE_PATTERNS) {
      try {
        const result = execSync(`grep -r "${pattern}" src/ --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" || true`, { encoding: 'utf8' });
        
        if (result.trim()) {
          const lines = result.trim().split('\n');
          for (const line of lines) {
            const [file, ...contentParts] = line.split(':');
            const content = contentParts.join(':');
            
            // Skip allowed files
            if (ALLOWED_FILES.some(allowed => file.includes(allowed))) {
              continue;
            }
            
            // Skip comments and certain safe patterns
            if (content.includes('//') || content.includes('/*') || content.includes('console.log')) {
              continue;
            }
            
            violations.push({
              type: 'DIRECT_USAGE',
              file,
              content: content.trim(),
              pattern
            });
          }
        }
      } catch (error) {
        // Ignore grep errors (no matches)
      }
    }
    
  } catch (error) {
    console.error('❌ Error running OpenAI import check:', error.message);
    process.exit(1);
  }
  
  return violations;
}

function main() {
  console.log('🔍 Checking for direct OpenAI imports outside budgeted client...');
  
  const violations = findViolations();
  
  if (violations.length === 0) {
    console.log('✅ All OpenAI usage goes through budgeted client - budget enforcement is secure!');
    process.exit(0);
  }
  
  console.error('❌ Found direct OpenAI usage that bypasses budget enforcement:');
  console.error('');
  
  const groupedViolations = violations.reduce((acc, violation) => {
    if (!acc[violation.file]) {
      acc[violation.file] = [];
    }
    acc[violation.file].push(violation);
    return acc;
  }, {});
  
  Object.entries(groupedViolations).forEach(([file, fileViolations]) => {
    console.error(`📁 ${file}:`);
    fileViolations.forEach(violation => {
      console.error(`   ${violation.type}: ${violation.content}`);
      console.error(`   Pattern: ${violation.pattern}`);
    });
    console.error('');
  });
  
  console.error('🛡️ To fix this:');
  console.error('1. Replace direct OpenAI imports with:');
  console.error('   import { createBudgetedChatCompletion } from "./services/openaiBudgetedClient"');
  console.error('');
  console.error('2. Replace direct API calls with budgeted equivalents:');
  console.error('   openai.chat.completions.create() → createBudgetedChatCompletion()');
  console.error('   openai.embeddings.create() → createBudgetedEmbedding()');
  console.error('');
  console.error('3. If this file legitimately needs direct access, add it to ALLOWED_FILES in:');
  console.error('   scripts/check-openai-imports.js');
  console.error('');
  
  process.exit(1);
}

if (require.main === module) {
  main();
}
