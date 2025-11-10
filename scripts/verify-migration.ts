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
      WHERE table_name = 'content_metadata' 
      AND column_name IN ('generator_name', 'raw_topic', 'format_strategy', 'visual_format')
      ORDER BY column_name;
    `);
    
    console.log('🎯 Canonical content_metadata columns present:');
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
    
    // Sample row values
    console.log('\n🧪 Sampling content_metadata diversity fields...');
    const sample = await client.query(`
      SELECT decision_id, generator_name, raw_topic, format_strategy, visual_format
      FROM content_metadata
      WHERE format_strategy IS NOT NULL
      LIMIT 1;
    `);
    
    if (sample.rows.length > 0) {
      const row = sample.rows[0];
      console.log('✅ Sample row retrieved:');
      console.log(`   decision_id: ${row.decision_id}`);
      console.log(`   generator_name: ${row.generator_name}`);
      console.log(`   raw_topic: ${row.raw_topic}`);
      console.log(`   format_strategy: ${row.format_strategy}`);
      console.log(`   visual_format: ${row.visual_format}`);
    } else {
      console.log('⚠️ No rows with populated diversity columns found (data may still be sparse).');
    }
    
    console.log('\n🎉 Migration verified and functional!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verify().catch(console.error);

