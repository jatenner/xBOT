/**
 * Main Entry Point for xBOT Learning System
 * Routes to appropriate pipeline based on mode
 */

import { plan } from './pipeline/plan';
import { generate } from './pipeline/generate';
import { vet } from './pipeline/vet';
import { publish } from './pipeline/publish';
import { replies } from './pipeline/replies';
import { learn } from './pipeline/learn';

interface RunOptions {
  mode?: 'post' | 'replies' | 'learn' | 'batch';
  dryRun?: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] as RunOptions['mode'] || 'post';
  const dryRun = process.env.DRY_RUN === '1' || args.includes('--dry-run');
  
  console.log(`🚀 xBOT ${mode} mode ${dryRun ? '(DRY RUN)' : '(LIVE)'}`);

  try {
    switch (mode) {
      case 'post':
        await runPostPipeline(dryRun);
        break;
      case 'replies':
        await runRepliesPipeline(dryRun);
        break;
      case 'learn':
        await runLearningPipeline();
        break;
      case 'batch':
        await runBatchGeneration();
        break;
      default:
        throw new Error(`Unknown mode: ${mode}`);
    }
    
    console.log('✅ Pipeline completed successfully');
  } catch (error) {
    console.error('❌ Pipeline failed:', error);
    process.exit(1);
  }
}

async function runPostPipeline(dryRun: boolean) {
  console.log('📋 Planning content...');
  const plan_result = await plan();
  
  console.log('✨ Generating content...');
  const content = await generate(plan_result);
  
  console.log('🔍 Vetting content...');
  const vetted = await vet(content);
  
  if (vetted.approved) {
    console.log('📱 Publishing content...');
    await publish(vetted, { dryRun });
  } else {
    console.log('❌ Content rejected:', vetted.rejection_reason);
  }
}

async function runRepliesPipeline(dryRun: boolean) {
  console.log('💬 Running replies pipeline...');
  await replies({ dryRun });
}

async function runLearningPipeline() {
  console.log('🧠 Running learning cycle...');
  await learn();
}

async function runBatchGeneration() {
  console.log('📦 Running batch generation...');
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`\n--- Batch ${i + 1}/5 ---`);
      await runPostPipeline(true); // Always dry run for batch
    } catch (error) {
      console.error(`Batch ${i + 1} failed:`, error);
    }
  }
}

if (require.main === module) {
  main();
}

export default main;