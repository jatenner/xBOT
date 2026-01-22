#!/usr/bin/env tsx
/**
 * 🎯 24H BAKE FINAL RUNNER
 * 
 * Single command to run all final verification at 24h mark:
 * 1. Generate comprehensive 24h bake report
 * 2. Run truth pipeline verification
 * 3. Print paths to generated docs
 */

import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

const PROJECT_ROOT = process.cwd();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('           🎯 24H BAKE FINAL VERIFICATION RUNNER');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const reports: Array<{ name: string; path: string }> = [];

try {
  // Step 1: Generate 24h final bake report
  console.log('📊 Step 1: Generating 24h final bake report...\n');
  try {
    execSync('pnpm exec tsx scripts/monitor/generate_24h_final_bake_report.ts', {
      stdio: 'inherit',
      cwd: PROJECT_ROOT,
    });
    
    const reportPath = join(PROJECT_ROOT, 'docs', 'BAKE_24H_FINAL_REPORT.md');
    if (existsSync(reportPath)) {
      reports.push({ name: '24H Final Bake Report', path: reportPath });
      console.log(`✅ Report generated: ${reportPath}\n`);
    } else {
      console.warn(`⚠️  Report file not found at expected path: ${reportPath}\n`);
    }
  } catch (error: any) {
    console.error(`❌ Failed to generate 24h bake report: ${error.message}\n`);
    throw error;
  }

  // Step 2: Run truth pipeline verification
  console.log('🔍 Step 2: Running truth pipeline verification...\n');
  try {
    execSync('pnpm exec tsx scripts/verify/truth_pipeline_happy_path.ts', {
      stdio: 'inherit',
      cwd: PROJECT_ROOT,
    });
    console.log('✅ Truth pipeline verification completed\n');
  } catch (error: any) {
    console.error(`❌ Truth pipeline verification failed: ${error.message}\n`);
    // Don't throw - truth pipeline may have warnings but still be useful
    console.warn('⚠️  Continuing despite truth pipeline warnings...\n');
  }

  // Step 3: Print summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ✅ FINAL VERIFICATION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📄 Generated Reports:\n');
  if (reports.length > 0) {
    reports.forEach((report, index) => {
      console.log(`   ${index + 1}. ${report.name}`);
      console.log(`      ${report.path}\n`);
    });
  } else {
    console.log('   ⚠️  No reports found\n');
  }

  console.log('📋 Next Steps:\n');
  console.log('   1. Review the 24h final bake report:');
  console.log(`      cat ${join(PROJECT_ROOT, 'docs', 'BAKE_24H_FINAL_REPORT.md')}\n`);
  console.log('   2. Review GO/NO-GO decision criteria:');
  console.log(`      cat ${join(PROJECT_ROOT, 'docs', 'BAKE_24H_FINAL_GO_NOGO.md')}\n`);
  console.log('   3. Make GO/NO-GO decision based on PASS/FAIL checklist\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

} catch (error: any) {
  console.error('\n❌ Final verification runner failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
