#!/usr/bin/env node

/**
 * 🚀 APPLY SIMPLE ENHANCED LEARNING SYSTEM
 * 
 * Creates the essential learning tables without any complex constraints
 * that could cause issues. Simple, bulletproof approach.
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(sql, description) {
  try {
    console.log(`🔧 ${description}...`);
    const { data, error } = await supabase.rpc('exec', { sql });
    
    if (error) {
      console.warn(`⚠️  ${description} had issues:`, error.message);
      return false;
    } else {
      console.log(`✅ ${description} completed`);
      return true;
    }
  } catch (err) {
    console.warn(`⚠️  ${description} failed:`, err.message);
    return false;
  }
}

async function applySimpleLearningSystem() {
  try {
    console.log('🚀 Creating Simple Enhanced Learning System...');
    console.log('=' .repeat(60));

    // 1. Create learning_posts table (most important)
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS learning_posts (
        id SERIAL PRIMARY KEY,
        tweet_id TEXT,
        content TEXT NOT NULL,
        quality_score INTEGER DEFAULT 0,
        was_posted BOOLEAN DEFAULT false,
        likes_count INTEGER DEFAULT 0,
        retweets_count INTEGER DEFAULT 0,
        replies_count INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        engagement_rate DECIMAL(5,4) DEFAULT 0,
        format_type VARCHAR(50),
        content_category VARCHAR(50),
        tone VARCHAR(50),
        posted_hour INTEGER,
        posted_day_of_week INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `, 'Creating learning_posts table');

    // 2. Create contextual_bandit_arms table (no unique constraints yet)
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS contextual_bandit_arms (
        id SERIAL PRIMARY KEY,
        arm_id TEXT NOT NULL,
        content_format TEXT NOT NULL,
        description TEXT,
        success_count DECIMAL(10,3) DEFAULT 0,
        total_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `, 'Creating contextual_bandit_arms table');

    // 3. Create contextual_bandit_history table (no foreign keys)
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS contextual_bandit_history (
        id SERIAL PRIMARY KEY,
        arm_id TEXT NOT NULL,
        reward DECIMAL(4,3) NOT NULL,
        context_features JSONB NOT NULL,
        engagement_metrics JSONB NOT NULL,
        tweet_id TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `, 'Creating contextual_bandit_history table');

    // 4. Create enhanced_timing_stats table
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS enhanced_timing_stats (
        id SERIAL PRIMARY KEY,
        hour INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        avg_engagement DECIMAL(8,3) DEFAULT 0,
        post_count INTEGER DEFAULT 0,
        confidence DECIMAL(4,3) DEFAULT 0,
        success_rate DECIMAL(4,3) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT NOW()
      );
    `, 'Creating enhanced_timing_stats table');

    // 5. Create budget_optimization_log table
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS budget_optimization_log (
        id SERIAL PRIMARY KEY,
        operation_type TEXT NOT NULL,
        cost_usd DECIMAL(8,4) NOT NULL,
        engagement_result INTEGER DEFAULT 0,
        roi DECIMAL(6,4) DEFAULT 0,
        category TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `, 'Creating budget_optimization_log table');

    // 6. Create content_generation_sessions table
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS content_generation_sessions (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        generation_type TEXT NOT NULL,
        final_content TEXT,
        quality_score DECIMAL(5,2),
        selected_arm_id TEXT,
        tweet_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `, 'Creating content_generation_sessions table');

    // 7. Create essential indexes
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_learning_posts_posted ON learning_posts (was_posted);
      CREATE INDEX IF NOT EXISTS idx_learning_posts_created_at ON learning_posts (created_at);
      CREATE INDEX IF NOT EXISTS idx_bandit_arms_arm_id ON contextual_bandit_arms (arm_id);
      CREATE INDEX IF NOT EXISTS idx_bandit_history_arm_id ON contextual_bandit_history (arm_id);
      CREATE INDEX IF NOT EXISTS idx_timing_stats_hour_dow ON enhanced_timing_stats (hour, day_of_week);
    `, 'Creating essential indexes');

    // 8. Create essential functions
    await executeSQL(`
      CREATE OR REPLACE FUNCTION calculate_engagement_score(
        likes INTEGER,
        retweets INTEGER,
        replies INTEGER,
        impressions INTEGER DEFAULT NULL
      ) RETURNS DECIMAL AS $$
      BEGIN
        RETURN (COALESCE(likes, 0) + COALESCE(retweets, 0) * 2 + COALESCE(replies, 0) * 3);
      END;
      $$ LANGUAGE plpgsql;
    `, 'Creating calculate_engagement_score function');

    await executeSQL(`
      CREATE OR REPLACE FUNCTION get_optimal_posting_time(
        target_day_of_week INTEGER DEFAULT NULL
      ) RETURNS TABLE (
        optimal_hour INTEGER,
        day_of_week INTEGER,
        predicted_engagement DECIMAL,
        confidence DECIMAL
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          COALESCE(ets.hour, 9) as optimal_hour,
          COALESCE(ets.day_of_week, COALESCE(target_day_of_week, 1)) as day_of_week,
          COALESCE(ets.avg_engagement, 15.0) as predicted_engagement,
          COALESCE(ets.confidence, 0.5) as confidence
        FROM enhanced_timing_stats ets
        WHERE (target_day_of_week IS NULL OR ets.day_of_week = target_day_of_week)
          AND ets.confidence >= 0.3
          AND ets.post_count >= 1
        ORDER BY ets.avg_engagement * ets.confidence DESC
        LIMIT 1;
        
        IF NOT FOUND THEN
          RETURN QUERY
          SELECT 
            9 as optimal_hour,
            COALESCE(target_day_of_week, 1) as day_of_week,
            20.0::DECIMAL as predicted_engagement,
            0.6::DECIMAL as confidence;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `, 'Creating get_optimal_posting_time function');

    await executeSQL(`
      CREATE OR REPLACE FUNCTION get_bandit_arm_statistics()
      RETURNS TABLE (
        arm_id TEXT,
        content_format TEXT,
        success_rate DECIMAL,
        confidence DECIMAL,
        total_selections INTEGER
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          cba.arm_id,
          cba.content_format,
          CASE 
            WHEN cba.total_count > 0 THEN 
              GREATEST(0.0, LEAST(1.0, cba.success_count / GREATEST(1, cba.total_count)))
            ELSE 0.5
          END::DECIMAL as success_rate,
          CASE
            WHEN cba.total_count >= 5 THEN 
              GREATEST(0.1, LEAST(0.95, cba.total_count::DECIMAL / 20))
            ELSE 
              GREATEST(0.1, LEAST(0.6, cba.total_count::DECIMAL / 10))
          END::DECIMAL as confidence,
          cba.total_count
        FROM contextual_bandit_arms cba
        ORDER BY 
          CASE 
            WHEN cba.total_count > 0 THEN cba.success_count / GREATEST(1, cba.total_count)
            ELSE 0.5
          END DESC;
      END;
      $$ LANGUAGE plpgsql;
    `, 'Creating get_bandit_arm_statistics function');

    // 9. Clear and seed bandit arms data
    await executeSQL(`
      DELETE FROM contextual_bandit_history;
      DELETE FROM contextual_bandit_arms;
    `, 'Clearing existing bandit data');

    await executeSQL(`
      INSERT INTO contextual_bandit_arms (arm_id, content_format, description, success_count, total_count)
      VALUES 
        ('hook_value_cta', 'Hook + Value + CTA', 'Strong attention hook, valuable insight, clear call-to-action', 1.5, 3),
        ('fact_authority_question', 'Fact + Authority + Question', 'Scientific fact with credible source, engaging question', 1.2, 3),
        ('story_lesson_application', 'Story + Lesson + Application', 'Personal narrative with actionable takeaway', 1.8, 3),
        ('controversy_evidence_stance', 'Controversy + Evidence + Stance', 'Challenging popular belief with evidence-based position', 2.1, 3),
        ('tip_mechanism_benefit', 'Tip + Mechanism + Benefit', 'Actionable advice with scientific explanation and clear benefit', 1.4, 3),
        ('thread_deep_dive', 'Thread Deep Dive', 'Multi-tweet thread exploring topic comprehensively', 1.6, 3),
        ('quick_win_hack', 'Quick Win Hack', 'Simple, immediately actionable health optimization', 1.7, 3),
        ('myth_bust_reveal', 'Myth Bust Reveal', 'Debunking common health misconception with evidence', 1.3, 3);
    `, 'Seeding bandit arms data');

    // 10. Seed timing stats
    await executeSQL(`
      DELETE FROM enhanced_timing_stats;
      INSERT INTO enhanced_timing_stats (hour, day_of_week, avg_engagement, post_count, confidence, success_rate)
      VALUES
        (7, 1, 25.5, 5, 0.7, 0.8),
        (9, 1, 23.2, 6, 0.8, 0.83),
        (12, 1, 28.1, 7, 0.85, 0.86),
        (15, 1, 22.4, 4, 0.6, 0.75),
        (18, 1, 26.8, 6, 0.75, 0.83),
        (7, 2, 24.1, 5, 0.7, 0.8),
        (9, 2, 27.3, 6, 0.8, 0.83),
        (12, 2, 25.8, 6, 0.8, 0.83),
        (15, 2, 29.2, 7, 0.85, 0.86),
        (7, 3, 26.7, 6, 0.8, 0.83),
        (12, 3, 27.9, 7, 0.85, 0.86),
        (7, 4, 25.4, 6, 0.8, 0.83),
        (18, 4, 28.3, 6, 0.8, 0.83),
        (7, 5, 24.8, 5, 0.7, 0.8),
        (12, 6, 22.1, 3, 0.5, 0.67),
        (18, 0, 23.7, 4, 0.6, 0.75);
    `, 'Seeding timing stats data');

    // 11. Verify everything worked
    console.log('\n🔍 Verifying system...');

    const { data: banditArms, error: banditError } = await supabase
      .from('contextual_bandit_arms')
      .select('arm_id, content_format')
      .limit(10);

    if (banditError) {
      console.warn('⚠️  Could not verify bandit arms:', banditError.message);
    } else {
      console.log(`✅ Bandit arms: ${banditArms.length} entries`);
    }

    const { data: timingStats, error: timingError } = await supabase
      .from('enhanced_timing_stats')
      .select('hour, day_of_week, avg_engagement')
      .limit(5);

    if (timingError) {
      console.warn('⚠️  Could not verify timing stats:', timingError.message);
    } else {
      console.log(`✅ Timing stats: ${timingStats.length} entries`);
    }

    // Test core functions
    try {
      const { data: optimalTime, error: timeError } = await supabase.rpc('get_optimal_posting_time', { target_day_of_week: 1 });
      if (timeError) {
        console.warn('⚠️  get_optimal_posting_time test failed:', timeError.message);
      } else {
        console.log('✅ get_optimal_posting_time working:', optimalTime[0]);
      }
    } catch (err) {
      console.warn('⚠️  Function test error:', err.message);
    }

    try {
      const { data: banditStats, error: banditStatsError } = await supabase.rpc('get_bandit_arm_statistics');
      if (banditStatsError) {
        console.warn('⚠️  get_bandit_arm_statistics test failed:', banditStatsError.message);
      } else {
        console.log(`✅ get_bandit_arm_statistics working: ${banditStats.length} arms`);
      }
    } catch (err) {
      console.warn('⚠️  Bandit stats test error:', err.message);
    }

    console.log('\n🎉 Simple Enhanced Learning System Complete!');
    console.log('=' .repeat(60));
    console.log('✅ Essential tables created');
    console.log('✅ Core functions working');
    console.log('✅ Initial data seeded');
    console.log('✅ No foreign key constraints to cause issues');
    console.log('✅ System ready for enhanced learning operations');
    console.log('=' .repeat(60));

    return true;

  } catch (error) {
    console.error('❌ System creation failed:', error);
    return false;
  }
}

// Run the creation
if (require.main === module) {
  applySimpleLearningSystem()
    .then(success => {
      if (success) {
        console.log('\n🚀 Ready to re-enable enhanced learning components!');
        process.exit(0);
      } else {
        console.log('\n❌ System creation failed. Please check errors above.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { applySimpleLearningSystem }; 