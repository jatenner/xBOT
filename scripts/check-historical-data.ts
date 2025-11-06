/**
 * Check what historical data exists for learning
 */

import 'dotenv/config';
import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL!;

async function checkHistoricalData() {
  const client = new Client({ 
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check total posts with metrics
    const totalPosts = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE actual_impressions IS NOT NULL AND actual_impressions > 0) as with_views,
        COUNT(*) FILTER (WHERE actual_likes IS NOT NULL AND actual_likes > 0) as with_likes,
        COUNT(*) FILTER (WHERE posted_at IS NOT NULL) as posted
      FROM content_generation_metadata_comprehensive
      WHERE status = 'posted';
    `);
    
    console.log('📊 HISTORICAL DATA OVERVIEW:');
    console.log(`   Total posted: ${totalPosts.rows[0].total}`);
    console.log(`   With views data: ${totalPosts.rows[0].with_views}`);
    console.log(`   With likes data: ${totalPosts.rows[0].with_likes}`);
    
    // Check if old posts have dimension data
    const dimensionData = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE raw_topic IS NOT NULL) as has_topic,
        COUNT(*) FILTER (WHERE angle IS NOT NULL) as has_angle,
        COUNT(*) FILTER (WHERE tone IS NOT NULL) as has_tone,
        COUNT(*) FILTER (WHERE generator_name IS NOT NULL) as has_generator,
        COUNT(*) FILTER (WHERE format_strategy IS NOT NULL) as has_format_strategy,
        COUNT(*) as total
      FROM content_generation_metadata_comprehensive
      WHERE status = 'posted'
      LIMIT 1;
    `);
    
    console.log('\n📋 DIMENSION DATA (needed for learning):');
    const dims = dimensionData.rows[0];
    console.log(`   Topics: ${dims.has_topic}/${dims.total} (${Math.round(dims.has_topic/dims.total*100)}%)`);
    console.log(`   Angles: ${dims.has_angle}/${dims.total} (${Math.round(dims.has_angle/dims.total*100)}%)`);
    console.log(`   Tones: ${dims.has_tone}/${dims.total} (${Math.round(dims.has_tone/dims.total*100)}%)`);
    console.log(`   Generators: ${dims.has_generator}/${dims.total} (${Math.round(dims.has_generator/dims.total*100)}%)`);
    console.log(`   Format strategies: ${dims.has_format_strategy}/${dims.total} (${Math.round(dims.has_format_strategy/dims.total*100)}%)`);
    
    // Check if performance tables have data
    console.log('\n📈 PERFORMANCE TABLES:');
    
    const tables = [
      'angle_performance',
      'tone_performance', 
      'topic_performance',
      'generator_performance',
      'generator_weights'
    ];
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table};`);
        const count = parseInt(result.rows[0].count);
        console.log(`   ${table}: ${count} rows ${count > 0 ? '✅' : '❌'}`);
      } catch (err: any) {
        console.log(`   ${table}: ❌ ${err.message.substring(0, 50)}`);
      }
    }
    
    // Sample some recent posts with metrics
    console.log('\n📝 SAMPLE RECENT POSTS (with metrics):');
    const samples = await client.query(`
      SELECT 
        raw_topic,
        angle,
        tone,
        generator_name,
        actual_impressions,
        actual_likes,
        actual_retweets,
        posted_at
      FROM content_generation_metadata_comprehensive
      WHERE status = 'posted' 
        AND actual_impressions IS NOT NULL
        AND actual_impressions > 0
      ORDER BY posted_at DESC
      LIMIT 5;
    `);
    
    samples.rows.forEach((row, i) => {
      console.log(`\n   Post ${i+1}:`);
      console.log(`   Topic: ${row.raw_topic?.substring(0, 60) || 'N/A'}`);
      console.log(`   Angle: ${row.angle?.substring(0, 60) || 'N/A'}`);
      console.log(`   Tone: ${row.tone?.substring(0, 60) || 'N/A'}`);
      console.log(`   Generator: ${row.generator_name || 'N/A'}`);
      console.log(`   Metrics: ${row.actual_impressions} views, ${row.actual_likes} likes, ${row.actual_retweets} RTs`);
    });
    
    // Check if data is USABLE for learning
    console.log('\n\n🧠 LEARNING READINESS:');
    
    const usableData = await client.query(`
      SELECT COUNT(*) as count
      FROM content_generation_metadata_comprehensive
      WHERE status = 'posted'
        AND raw_topic IS NOT NULL
        AND angle IS NOT NULL
        AND tone IS NOT NULL
        AND generator_name IS NOT NULL
        AND actual_impressions IS NOT NULL
        AND actual_impressions > 0;
    `);
    
    const usableCount = parseInt(usableData.rows[0].count);
    console.log(`   ✅ Posts with COMPLETE data: ${usableCount}`);
    
    if (usableCount >= 50) {
      console.log(`   ✅ READY FOR LEARNING! (50+ complete posts)`);
    } else {
      console.log(`   ⏳ Need more data (${50 - usableCount} more posts for confidence)`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkHistoricalData().catch(console.error);

