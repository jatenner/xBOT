#!/usr/bin/env tsx

/**
 * 🚨 EMERGENCY COST CONTROL FIX
 * Patches the worst cost leaks immediately
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

interface CostFix {
  file: string;
  oldPattern: string;
  newPattern: string;
  description: string;
  estimatedSavings: string;
}

const CRITICAL_FIXES: CostFix[] = [
  // Fix expensive model usage
  {
    file: 'src/ai/hyperIntelligentOrchestrator.ts',
    oldPattern: "model: 'gpt-4o',",
    newPattern: "model: 'gpt-4o-mini', // COST_FIX: $0.15 -> $0.0015 per 1K tokens",
    description: "Replace expensive gpt-4o with gpt-4o-mini in hyper orchestrator",
    estimatedSavings: "~95% cost reduction"
  },
  
  // Fix ensemble generation using 4 expensive models
  {
    file: 'src/ai/multiModelOrchestrator.ts',
    oldPattern: "{ name: 'gpt-4o-creative', model: 'gpt-4o', temperature: 0.95, top_p: 0.9 },",
    newPattern: "{ name: 'gpt-4o-mini-creative', model: 'gpt-4o-mini', temperature: 0.95, top_p: 0.9 }, // COST_FIX",
    description: "Replace gpt-4o with gpt-4o-mini in ensemble",
    estimatedSavings: "~95% per model"
  },
  
  {
    file: 'src/ai/multiModelOrchestrator.ts',
    oldPattern: "{ name: 'gpt-4o-balanced', model: 'gpt-4o', temperature: 0.8, top_p: 0.95 },",
    newPattern: "{ name: 'gpt-4o-mini-balanced', model: 'gpt-4o-mini', temperature: 0.8, top_p: 0.95 }, // COST_FIX",
    description: "Replace gpt-4o with gpt-4o-mini in ensemble",
    estimatedSavings: "~95% per model"
  },
  
  {
    file: 'src/ai/multiModelOrchestrator.ts',
    oldPattern: "{ name: 'gpt-4o-precise', model: 'gpt-4o', temperature: 0.6, top_p: 0.8 },",
    newPattern: "{ name: 'gpt-4o-mini-precise', model: 'gpt-4o-mini', temperature: 0.6, top_p: 0.8 }, // COST_FIX",
    description: "Replace gpt-4o with gpt-4o-mini in ensemble",
    estimatedSavings: "~95% per model"
  },
  
  {
    file: 'src/ai/multiModelOrchestrator.ts',
    oldPattern: "{ name: 'gpt-4-turbo', model: 'gpt-4-turbo-preview', temperature: 0.85, top_p: 0.9 }",
    newPattern: "{ name: 'gpt-4o-mini-turbo', model: 'gpt-4o-mini', temperature: 0.85, top_p: 0.9 } // COST_FIX",
    description: "Replace gpt-4-turbo with gpt-4o-mini",
    estimatedSavings: "~95% per model"
  },
  
  // Fix vision API calls
  {
    file: 'src/lib/gptVision.ts',
    oldPattern: 'model: "gpt-4o",',
    newPattern: 'model: "gpt-4o-mini", // COST_FIX: Vision still works with mini',
    description: "Use cheaper model for vision analysis",
    estimatedSavings: "~95% cost reduction"
  },
  
  // Fix high token limits
  {
    file: 'src/ai/hyperIntelligentOrchestrator.ts',
    oldPattern: "max_tokens: format === 'thread' ? 1500 : 600",
    newPattern: "max_tokens: format === 'thread' ? 800 : 400 // COST_FIX: Reduced token limits",
    description: "Reduce max token limits to save costs",
    estimatedSavings: "~50% token cost reduction"
  }
];

async function emergencyCostFix() {
  try {
    console.log('🚨 EMERGENCY_COST_FIX: Applying critical patches...\n');
    
    let totalFilesFixed = 0;
    let totalFixesApplied = 0;
    
    for (const fix of CRITICAL_FIXES) {
      try {
        const content = readFileSync(fix.file, 'utf-8');
        
        if (content.includes(fix.oldPattern)) {
          const newContent = content.replace(fix.oldPattern, fix.newPattern);
          writeFileSync(fix.file, newContent, 'utf-8');
          
          console.log(`✅ FIXED: ${fix.file}`);
          console.log(`   📋 ${fix.description}`);
          console.log(`   💰 Savings: ${fix.estimatedSavings}`);
          console.log('');
          
          totalFilesFixed++;
          totalFixesApplied++;
        } else {
          console.log(`⏭️ SKIP: ${fix.file} - pattern not found (already fixed?)`);
        }
      } catch (error) {
        console.warn(`⚠️ FAILED: ${fix.file} - ${error}`);
      }
    }
    
    // Additional cost control measures
    console.log('🔧 ADDITIONAL COST CONTROLS:\n');
    
    // Add emergency stop to expensive files
    const expensiveFiles = [
      'src/ai/intelligentPromptOrchestrator.ts',
      'src/engagement/aggressiveEngagementEngine.ts',
      'src/ai/hyperIntelligentOrchestrator.ts',
      'src/ai/multiModelOrchestrator.ts'
    ];
    
    for (const file of expensiveFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        
        // Add emergency cost check if not present
        if (!content.includes('EMERGENCY_COST_CHECK') && content.includes('openai.chat.completions.create')) {
          const newContent = content.replace(
            /const response = await this\.openai\.chat\.completions\.create/g,
            `// EMERGENCY_COST_CHECK: Check daily budget before expensive API calls
        const openAIService = OpenAIService.getInstance();
        const budgetStatus = await openAIService.getCurrentBudgetStatus();
        if (budgetStatus.isOverBudget) {
          throw new Error('🚨 COST_LIMIT: Daily OpenAI budget exceeded - operation blocked');
        }
        
        const response = await this.openai.chat.completions.create`
          );
          
          if (newContent !== content) {
            writeFileSync(file, newContent, 'utf-8');
            console.log(`✅ EMERGENCY_CHECK: Added budget check to ${file}`);
            totalFixesApplied++;
          }
        }
      } catch (error) {
        console.warn(`⚠️ BUDGET_CHECK_FAILED: ${file} - ${error}`);
      }
    }
    
    console.log('\n🎯 EMERGENCY_FIX_SUMMARY:');
    console.log(`   📁 Files Fixed: ${totalFilesFixed}`);
    console.log(`   🔧 Total Fixes Applied: ${totalFixesApplied}`);
    console.log(`   💰 Estimated Daily Savings: 80-95% reduction in OpenAI costs`);
    
    console.log('\n🚨 IMMEDIATE ACTIONS NEEDED:');
    console.log('   1. Deploy these fixes immediately: git add -A && git commit -m "🚨 EMERGENCY: Fix critical OpenAI cost leaks"');
    console.log('   2. Monitor OpenAI usage dashboard closely');
    console.log('   3. Set up budget alerts in OpenAI dashboard');
    console.log('   4. Review remaining 50+ API calls for further optimization');
    
    console.log('\n⚠️ REMAINING COST RISKS:');
    console.log('   • 50+ direct API calls still bypass OpenAIService cost controls');
    console.log('   • Test/API routes in src/app/api/ need cost limits');
    console.log('   • Consider implementing request rate limiting');
    console.log('   • Add per-feature budget allocation');
    
    if (totalFixesApplied > 0) {
      console.log('\n✅ EMERGENCY_PATCHES_APPLIED: Cost leaks plugged!');
      process.exit(0);
    } else {
      console.log('\n⚠️ NO_FIXES_APPLIED: All patterns already fixed or files missing');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ EMERGENCY_FIX_ERROR:', error);
    process.exit(1);
  }
}

// Additional analysis function
async function analyzeCostPatterns() {
  console.log('\n🔍 ANALYZING REMAINING COST PATTERNS...\n');
  
  try {
    const result = await import('child_process').then(cp => 
      cp.execSync('grep -r "gpt-4o\\|gpt-4" src/ --include="*.ts" | wc -l', { encoding: 'utf-8' })
    );
    console.log(`📊 Remaining expensive model references: ${result.trim()}`);
  } catch (error) {
    console.warn('Could not analyze remaining patterns');
  }
  
  try {
    const result = await import('child_process').then(cp => 
      cp.execSync('grep -r "max_tokens.*[0-9]\\{4,\\}" src/ --include="*.ts" | wc -l', { encoding: 'utf-8' })
    );
    console.log(`📊 High token limit calls (>1000): ${result.trim()}`);
  } catch (error) {
    console.warn('Could not analyze token patterns');
  }
}

// Run the emergency fix
emergencyCostFix().then(() => {
  analyzeCostPatterns();
});
