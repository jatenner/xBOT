// Direct PostgreSQL schema inspection
require('dotenv').config();
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL in .env');
  process.exit(1);
}

const client = new Client({ 
  connectionString,
  ssl: { rejectUnauthorized: false }  // Fix for Supabase SSL
});

console.log('🔍 INSPECTING TABLE SCHEMAS (Direct PostgreSQL)\n');
console.log('='.repeat(80));

async function inspectTable(tableName) {
  console.log(`\n📊 ${tableName}`);
  console.log('-'.repeat(80));

  try {
    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = $1
      ORDER BY ordinal_position;
    `;

    const result = await client.query(query, [tableName]);

    if (result.rows.length === 0) {
      console.log('   ❌ Table not found');
      return null;
    }

    console.log(`   ✅ ${result.rows.length} columns:`);
    
    result.rows.forEach((col, idx) => {
      const nullable = col.is_nullable === 'YES' ? '' : 'NOT NULL';
      console.log(`   ${(idx + 1).toString().padStart(2)}. ${col.column_name.padEnd(35)} ${col.data_type.padEnd(20)} ${nullable}`);
    });

    // Critical columns check
    const cols = result.rows.map(r => r.column_name);
    const checks = {
      decision_id: cols.includes('decision_id'),
      tweet_id: cols.includes('tweet_id'),
      generator_name: cols.includes('generator_name'),
      raw_topic: cols.includes('raw_topic'),
      topic_cluster: cols.includes('topic_cluster'),
      angle: cols.includes('angle'),
      tone: cols.includes('tone'),
      format_strategy: cols.includes('format_strategy'),
      visual_format: cols.includes('visual_format'),
      target_tweet_id: cols.includes('target_tweet_id'),
      target_username: cols.includes('target_username'),
      decision_type: cols.includes('decision_type'),
      likes: cols.includes('likes'),
      retweets: cols.includes('retweets'),
      engagement_rate: cols.includes('engagement_rate')
    };

    console.log('\n   🔍 Critical columns:');
    Object.entries(checks).forEach(([col, exists]) => {
      if (exists) console.log(`      ✅ ${col}`);
    });

    const missing = Object.entries(checks).filter(([, exists]) => !exists).map(([col]) => col);
    if (missing.length > 0) {
      console.log('\n   ❌ Missing:');
      missing.forEach(col => console.log(`      - ${col}`));
    }

    return { tableName, columns: result.rows, columnNames: cols, checks };

  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return null;
  }
}

async function main() {
  await client.connect();

  const criticalTables = [
    'content_metadata',
    'content_generation_metadata_comprehensive',
    'posted_decisions',
    'tweets',
    'posts',
    'outcomes',
    'real_tweet_metrics',
    'tweet_analytics',
    'tweet_metrics',
    'reply_opportunities',
    'reply_conversions',
    'learning_posts',
    'follower_snapshots'
  ];

  const schemas = {};

  for (const table of criticalTables) {
    const schema = await inspectTable(table);
    if (schema) {
      schemas[table] = schema;
    }
  }

  // Save results
  const fs = require('fs');
  fs.writeFileSync('TABLE_SCHEMAS_ACTUAL.json', JSON.stringify(schemas, null, 2));

  console.log('\n\n' + '='.repeat(80));
  console.log('✅ Schema inspection complete!');
  console.log('📄 Saved to: TABLE_SCHEMAS_ACTUAL.json');
  console.log('='.repeat(80) + '\n');

  await client.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
