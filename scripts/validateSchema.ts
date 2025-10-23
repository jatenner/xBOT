/**
 * CLI tool to validate database schema
 * 
 * Usage: npm run validate:schema
 */

import { validateDatabaseSchema } from '../src/db/schemaValidator';

async function main() {
  console.log('🔍 Validating database schema...\n');
  
  const result = await validateDatabaseSchema();
  
  if (result.valid) {
    console.log('\n✅ SUCCESS: Database schema is valid!');
    process.exit(0);
  } else {
    console.log('\n❌ FAILURE: Database schema has issues!');
    console.log(`   Errors: ${result.errors.length}`);
    console.log(`   Missing tables: ${result.missingTables.length}`);
    console.log(`   Missing columns: ${result.missingColumns.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n🔴 Errors:');
      result.errors.forEach(err => console.log(`   • ${err}`));
    }
    
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});

