/**
 * CLI tool to generate detailed schema report
 * 
 * Usage: npm run schema:report
 */

import { generateSchemaReport } from '../src/db/schemaValidator';

async function main() {
  const report = await generateSchemaReport();
  console.log(report);
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});

