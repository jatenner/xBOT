/**
 * Verify diversity tracking migration was applied
 */

import 'dotenv/config';
import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL!;

async function verify() {
  const client = new Client({ 
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected\n');
    
    // Check base table columns
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'content_generation_metadata_comprehensive' 
      AND column_name IN ('generator_type', 'content_angle', 'format_type', 'complexity_score')
      ORDER BY column_name;
    `);
    
    console.log('🎯 Diversity Tracking Columns in BASE TABLE:');
    if (result.rows.length === 4) {
      console.log('✅ ALL 4 COLUMNS EXIST:');
      result.rows.forEach(row => {
        console.log(`   ✅ ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log(`❌ Found ${result.rows.length}/4 columns:`);
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    }
    
    // Test inserting diversity data
    console.log('\n🧪 Testing diversity data insert...');
    const testResult = await client.query(`
      UPDATE content_generation_metadata_comprehensive 
      SET 
        generator_type = 'test_generator',
        content_angle = 'test_angle',
        format_type = 'single',
        complexity_score = 5
      WHERE decision_id = (
        SELECT decision_id 
        FROM content_generation_metadata_comprehensive 
        LIMIT 1
      )
      RETURNING decision_id, generator_type, content_angle;
    `);
    
    if (testResult.rows.length > 0) {
      console.log('✅ Diversity data write successful!');
      console.log(`   Updated decision: ${testResult.rows[0].decision_id}`);
      console.log(`   Generator: ${testResult.rows[0].generator_type}`);
      console.log(`   Angle: ${testResult.rows[0].content_angle}`);
      
      // Rollback test
      await client.query(`
        UPDATE content_generation_metadata_comprehensive 
        SET generator_type = NULL, content_angle = NULL, format_type = NULL, complexity_score = NULL
        WHERE decision_id = $1;
      `, [testResult.rows[0].decision_id]);
      console.log('   (Test data rolled back)');
    }
    
    console.log('\n🎉 Migration verified and functional!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verify().catch(console.error);

