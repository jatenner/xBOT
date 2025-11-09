/**
 * Check VI database population status
 */

import 'dotenv/config';
import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL!;

if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const SAMPLE_ORDER_COLUMNS: Record<string, string> = {
  vi_collected_tweets: 'scraped_at',
  vi_content_classification: 'classified_at',
  vi_visual_formatting: 'analyzed_at',
  vi_format_intelligence: 'updated_at',
  vi_scrape_targets: 'updated_at'
};

async function checkVIDatabase() {
  const client = new Client({ 
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check VI tables
    const tables = [
      'vi_collected_tweets',
      'vi_content_classification',
      'vi_visual_formatting',
      'vi_format_intelligence',
      'vi_scrape_targets'
    ];
    
    for (const table of tables) {
      const result = await client.query(`
        SELECT COUNT(*) as count 
        FROM ${table};
      `);
      
      const count = parseInt(result.rows[0].count);
      console.log(`📊 ${table}: ${count} rows ${count === 0 ? '❌ EMPTY' : '✅'}`);
      
      if (count > 0) {
        const orderColumn = SAMPLE_ORDER_COLUMNS[table] || 'created_at';
        try {
          // Show sample
          const sample = await client.query(`
            SELECT * FROM ${table} 
            ORDER BY ${orderColumn} DESC NULLS LAST
            LIMIT 1;
          `);
          
          if (sample.rows.length > 0) {
            const row = sample.rows[0];
            console.log(`   Latest: ${JSON.stringify(row).substring(0, 120)}...`);
          }
        } catch (sampleError: any) {
          console.log(`   (Sample unavailable: ${sampleError.message})`);
        }
      }
    }
    
    console.log('\n🔍 VI SYSTEM STATUS:');
    
    // Check when VI scraper last ran
    const scraperCheck = await client.query(`
      SELECT MAX(scraped_at) as last_scrape 
      FROM vi_collected_tweets;
    `);
    
    const lastScrape = scraperCheck.rows[0].last_scrape;
    if (lastScrape) {
      console.log(`✅ Last VI scrape: ${lastScrape}`);
    } else {
      console.log(`❌ No VI scrapes yet - scraper hasn't run`);
    }
    
    // Check classification status
    const classCheck = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE classified = true) as classified,
        COUNT(*) FILTER (WHERE analyzed = true) as analyzed,
        COUNT(*) FILTER (WHERE classified = false) as unclassified,
        COUNT(*) as total
      FROM vi_collected_tweets;
    `);
    
    if (classCheck.rows[0].total > 0) {
      const stats = classCheck.rows[0];
      console.log(`📊 Classification: ${stats.classified} classified, ${stats.unclassified} pending`);
      console.log(`📊 Analysis: ${stats.analyzed} analyzed`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('   Hint: ensure NODE_TLS_REJECT_UNAUTHORIZED=0 when running this script locally.');
  } finally {
    await client.end();
  }
}

checkVIDatabase().catch(console.error);

