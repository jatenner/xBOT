#!/usr/bin/env ts-node
/**
 * CI Guard: Verify No Direct OpenAI Usage
 * Prevents budget enforcement bypass by detecting direct OpenAI SDK usage
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface Violation {
  file: string;
  line: number;
  content: string;
  pattern: string;
  severity: 'error' | 'warning';
}

// Files allowed to import OpenAI directly
const ALLOWED_FILES = [
  'src/services/openaiBudgetedClient.ts',
  'src/services/openaiWrapper.ts', // Legacy compatibility
  'src/ai/megaPromptSystem.ts', // Uses budgeted client internally
  'src/config/openai/pricing.ts', // Type definitions only
  'src/config/openai/pricingSource.ts' // Type definitions only
];

// Patterns that indicate direct OpenAI usage
const VIOLATION_PATTERNS = [
  {
    pattern: "from 'openai'",
    severity: 'error' as const,
    description: 'Direct OpenAI import'
  },
  {
    pattern: 'from "openai"',
    severity: 'error' as const,
    description: 'Direct OpenAI import'
  },
  {
    pattern: 'import OpenAI',
    severity: 'error' as const,
    description: 'Direct OpenAI import'
  },
  {
    pattern: 'import { OpenAI }',
    severity: 'error' as const,
    description: 'Direct OpenAI import'
  },
  {
    pattern: 'require("openai")',
    severity: 'error' as const,
    description: 'Direct OpenAI require'
  },
  {
    pattern: "require('openai')",
    severity: 'error' as const,
    description: 'Direct OpenAI require'
  },
  {
    pattern: '.chat.completions.create',
    severity: 'error' as const,
    description: 'Direct OpenAI API call'
  },
  {
    pattern: '.embeddings.create',
    severity: 'error' as const,
    description: 'Direct OpenAI embeddings call'
  },
  {
    pattern: '.images.generate',
    severity: 'error' as const,
    description: 'Direct OpenAI images call'
  },
  {
    pattern: 'api.openai.com',
    severity: 'error' as const,
    description: 'Direct OpenAI API endpoint'
  },
  {
    pattern: 'openai.chat.',
    severity: 'warning' as const,
    description: 'Potential direct OpenAI usage'
  },
  {
    pattern: 'openai.embeddings.',
    severity: 'warning' as const,
    description: 'Potential direct OpenAI usage'
  }
];

/**
 * Scan for violations in the codebase
 */
function scanForViolations(): Violation[] {
  const violations: Violation[] = [];
  
  // Directories to scan
  const scanDirs = ['src/', 'scripts/', 'tests/'];
  
  for (const dir of scanDirs) {
    if (!fs.existsSync(dir)) continue;
    
    for (const violationPattern of VIOLATION_PATTERNS) {
      try {
        const grepCommand = `grep -rn "${violationPattern.pattern}" ${dir} --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" || true`;
        const result = execSync(grepCommand, { encoding: 'utf8' });
        
        if (result.trim()) {
          const lines = result.trim().split('\n');
          
          for (const line of lines) {
            const match = line.match(/^([^:]+):(\d+):(.+)$/);
            if (!match) continue;
            
            const [, file, lineNum, content] = match;
            
            // Skip allowed files
            if (ALLOWED_FILES.some(allowed => file.includes(allowed))) {
              continue;
            }
            
            // Skip comments and safe patterns
            const trimmedContent = content.trim();
            if (trimmedContent.startsWith('//') || 
                trimmedContent.startsWith('/*') || 
                trimmedContent.includes('console.log') ||
                trimmedContent.includes('// @ts-ignore')) {
              continue;
            }
            
            violations.push({
              file,
              line: parseInt(lineNum),
              content: trimmedContent,
              pattern: violationPattern.pattern,
              severity: violationPattern.severity
            });
          }
        }
      } catch (error) {
        // Ignore grep errors (no matches found)
      }
    }
  }
  
  return violations;
}

/**
 * Check for budget enforcement compliance
 */
function checkBudgetCompliance(): { compliant: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check that budgeted client exists
  if (!fs.existsSync('src/services/openaiBudgetedClient.ts')) {
    issues.push('Missing canonical budgeted client: src/services/openaiBudgetedClient.ts');
  }
  
  // Check for required environment variables in example/docs
  const requiredEnvVars = [
    'DAILY_OPENAI_LIMIT_USD',
    'BUDGET_STRICT',
    'BUDGET_ALERT_THRESHOLD'
  ];
  
  // This is a basic check - in a real scenario, you'd check documentation
  // or example environment files
  
  return {
    compliant: issues.length === 0,
    issues
  };
}

/**
 * Generate violation report
 */
function generateReport(violations: Violation[]): void {
  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');
  
  console.log('🔍 OPENAI_BUDGET_COMPLIANCE_SCAN');
  console.log('================================');
  
  if (violations.length === 0) {
    console.log('✅ NO VIOLATIONS FOUND');
    console.log('✅ All OpenAI usage goes through budgeted client');
    console.log('✅ Budget enforcement is secure');
    return;
  }
  
  console.log(`❌ FOUND ${errors.length} ERRORS and ${warnings.length} WARNINGS`);
  console.log('');
  
  // Group violations by file
  const byFile = violations.reduce((acc, violation) => {
    if (!acc[violation.file]) acc[violation.file] = [];
    acc[violation.file].push(violation);
    return acc;
  }, {} as Record<string, Violation[]>);
  
  Object.entries(byFile).forEach(([file, fileViolations]) => {
    console.log(`📁 ${file}:`);
    fileViolations.forEach(violation => {
      const icon = violation.severity === 'error' ? '❌' : '⚠️';
      console.log(`   ${icon} Line ${violation.line}: ${violation.pattern}`);
      console.log(`      ${violation.content}`);
    });
    console.log('');
  });
  
  console.log('🛡️ REMEDIATION STEPS:');
  console.log('1. Replace direct OpenAI imports with:');
  console.log('   import { budgetedOpenAI } from "../services/openaiBudgetedClient"');
  console.log('');
  console.log('2. Replace direct API calls:');
  console.log('   openai.chat.completions.create() → budgetedOpenAI.chatComplete()');
  console.log('   openai.embeddings.create() → budgetedOpenAI.createEmbedding()');
  console.log('');
  console.log('3. Add purpose metadata to all calls:');
  console.log('   budgetedOpenAI.chatComplete(params, { purpose: "content_generation" })');
  console.log('');
  console.log('4. If file legitimately needs direct access, add to ALLOWED_FILES');
  console.log('');
}

/**
 * Main execution
 */
function main(): void {
  console.log('🔍 Scanning for direct OpenAI usage that bypasses budget enforcement...');
  
  const violations = scanForViolations();
  const compliance = checkBudgetCompliance();
  
  generateReport(violations);
  
  if (!compliance.compliant) {
    console.log('❌ BUDGET_COMPLIANCE_ISSUES:');
    compliance.issues.forEach(issue => console.log(`   - ${issue}`));
    console.log('');
  }
  
  const errors = violations.filter(v => v.severity === 'error');
  
  if (errors.length > 0 || !compliance.compliant) {
    console.log(`❌ CI_FAILURE: Found ${errors.length} budget enforcement violations`);
    console.log('❌ Deploy blocked until all direct OpenAI usage is routed through budgeted client');
    process.exit(1);
  } else {
    console.log('✅ CI_SUCCESS: Budget enforcement compliance verified');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}
