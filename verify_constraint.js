/**
 * Verify the content_violations constraint
 */

require('dotenv').config();
const { Client } = require('pg');

async function verifyConstraint() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected\n');
    
    // Get the constraint definition
    const result = await client.query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'content_violations_violation_type_check'
      AND conrelid = 'content_violations'::regclass
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Constraint not found!');
    } else {
      console.log('✅ Constraint exists:');
      console.log('==========================================');
      console.log(result.rows[0].definition);
      console.log('\n');
      
      // Check if excessive_emojis is in there
      const def = result.rows[0].definition;
      if (def.includes('excessive_emojis')) {
        console.log('✅ excessive_emojis IS in the constraint');
      } else {
        console.log('❌ excessive_emojis is NOT in the constraint');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyConstraint();

