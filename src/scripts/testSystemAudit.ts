#!/usr/bin/env ts-node

/**
 * Test the system audit locally with TypeScript
 */

import { runSystemAudit } from '../utils/systemAudit';

async function main() {
  try {
    const results = await runSystemAudit();
    
    // Exit with appropriate code
    if (results.overall === 'error') {
      process.exit(1);
    } else if (results.overall === 'warning') {
      process.exit(2);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ System audit failed:', error);
    process.exit(1);
  }
}

main();
