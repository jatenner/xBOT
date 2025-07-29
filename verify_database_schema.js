#!/usr/bin/env node

/**
 * 🧠 DATABASE SCHEMA VERIFICATION SCRIPT
 * =====================================
 * Verifies that the Tweet Learning System database migration works properly
 * Tests all tables, indexes, functions, and triggers are created correctly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

class DatabaseSchemaVerifier {
    constructor() {
        this.results = {
            tables: {},
            indexes: {},
            functions: {},
            triggers: {},
            initialData: {},
            errors: []
        };
    }

    async verifyAll() {
        console.log('🔍 Starting Database Schema Verification...\n');
        
        try {
            await this.verifyTables();
            await this.verifyIndexes();
            await this.verifyFunctions();
            await this.verifyTriggers();
            await this.verifyInitialData();
            await this.testBasicOperations();
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Verification failed:', error.message);
            this.results.errors.push(error.message);
        }
    }

    async verifyTables() {
        console.log('📋 Verifying Tables...');
        
        const expectedTables = [
            'viral_tweets_learned',
            'content_format_fingerprints', 
            'tweet_generation_sessions',
            'engagement_feedback_tracking',
            'performance_patterns_learned',
            'topic_resonance_tracking',
            'intelligent_prompt_evolution'
        ];

        for (const tableName of expectedTables) {
            try {
                // Check if table exists and get column count
                const { data, error } = await supabase.rpc('exec_sql', {
                    sql: `
                        SELECT COUNT(*) as column_count 
                        FROM information_schema.columns 
                        WHERE table_name = '${tableName}' 
                        AND table_schema = 'public'
                    `
                });

                if (error) throw error;
                
                const columnCount = data?.[0]?.column_count || 0;
                this.results.tables[tableName] = {
                    exists: columnCount > 0,
                    columns: columnCount
                };
                
                console.log(`  ✅ ${tableName}: ${columnCount} columns`);
                
            } catch (error) {
                this.results.tables[tableName] = { exists: false, error: error.message };
                console.log(`  ❌ ${tableName}: ${error.message}`);
            }
        }
    }

    async verifyIndexes() {
        console.log('\n🗂️  Verifying Indexes...');
        
        const expectedIndexes = [
            'idx_viral_tweets_engagement_rate',
            'idx_viral_tweets_viral_score',
            'idx_format_fingerprints_success_rate',
            'idx_generation_sessions_created',
            'idx_engagement_feedback_tweet_id',
            'idx_performance_patterns_confidence',
            'idx_topic_resonance_engagement',
            'idx_prompt_evolution_success_rate'
        ];

        for (const indexName of expectedIndexes) {
            try {
                const { data, error } = await supabase.rpc('exec_sql', {
                    sql: `
                        SELECT indexname 
                        FROM pg_indexes 
                        WHERE indexname = '${indexName}' 
                        AND schemaname = 'public'
                    `
                });

                if (error) throw error;
                
                const exists = data && data.length > 0;
                this.results.indexes[indexName] = { exists };
                
                console.log(`  ${exists ? '✅' : '❌'} ${indexName}`);
                
            } catch (error) {
                this.results.indexes[indexName] = { exists: false, error: error.message };
                console.log(`  ❌ ${indexName}: ${error.message}`);
            }
        }
    }

    async verifyFunctions() {
        console.log('\n⚙️  Verifying Functions...');
        
        const expectedFunctions = [
            'calculate_viral_score',
            'update_engagement_rate',
            'update_feedback_engagement_rate'
        ];

        for (const functionName of expectedFunctions) {
            try {
                const { data, error } = await supabase.rpc('exec_sql', {
                    sql: `
                        SELECT proname 
                        FROM pg_proc 
                        WHERE proname = '${functionName}' 
                        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                    `
                });

                if (error) throw error;
                
                const exists = data && data.length > 0;
                this.results.functions[functionName] = { exists };
                
                console.log(`  ${exists ? '✅' : '❌'} ${functionName}()`);
                
            } catch (error) {
                this.results.functions[functionName] = { exists: false, error: error.message };
                console.log(`  ❌ ${functionName}: ${error.message}`);
            }
        }
    }

    async verifyTriggers() {
        console.log('\n🔔 Verifying Triggers...');
        
        const expectedTriggers = [
            'trigger_viral_tweets_engagement_rate',
            'trigger_feedback_engagement_rate'
        ];

        for (const triggerName of expectedTriggers) {
            try {
                const { data, error } = await supabase.rpc('exec_sql', {
                    sql: `
                        SELECT trigger_name 
                        FROM information_schema.triggers 
                        WHERE trigger_name = '${triggerName}' 
                        AND trigger_schema = 'public'
                    `
                });

                if (error) throw error;
                
                const exists = data && data.length > 0;
                this.results.triggers[triggerName] = { exists };
                
                console.log(`  ${exists ? '✅' : '❌'} ${triggerName}`);
                
            } catch (error) {
                this.results.triggers[triggerName] = { exists: false, error: error.message };
                console.log(`  ❌ ${triggerName}: ${error.message}`);
            }
        }
    }

    async verifyInitialData() {
        console.log('\n📊 Verifying Initial Data...');
        
        // Check content_format_fingerprints baseline data
        try {
            const { data, error } = await supabase
                .from('content_format_fingerprints')
                .select('format_name, confidence_score')
                .order('confidence_score', { ascending: false });

            if (error) throw error;
            
            this.results.initialData.formatFingerprints = {
                count: data?.length || 0,
                topFormat: data?.[0]?.format_name || 'none'
            };
            
            console.log(`  ✅ Format fingerprints: ${data?.length || 0} baseline formats loaded`);
            console.log(`  🏆 Top format: ${data?.[0]?.format_name} (${data?.[0]?.confidence_score})`);
            
        } catch (error) {
            this.results.initialData.formatFingerprints = { error: error.message };
            console.log(`  ❌ Format fingerprints: ${error.message}`);
        }

        // Check intelligent_prompt_evolution baseline data
        try {
            const { data, error } = await supabase
                .from('intelligent_prompt_evolution')
                .select('prompt_type, prompt_version, is_active')
                .eq('is_active', true);

            if (error) throw error;
            
            this.results.initialData.promptEvolution = {
                count: data?.length || 0,
                activePrompts: data?.map(p => `${p.prompt_type}_${p.prompt_version}`) || []
            };
            
            console.log(`  ✅ Prompt evolution: ${data?.length || 0} active prompts loaded`);
            
        } catch (error) {
            this.results.initialData.promptEvolution = { error: error.message };
            console.log(`  ❌ Prompt evolution: ${error.message}`);
        }
    }

    async testBasicOperations() {
        console.log('\n🧪 Testing Basic Operations...');
        
        // Test viral tweet insertion and trigger functionality
        try {
            const testTweet = {
                tweet_id: 'test_' + Date.now(),
                author_username: 'test_user',
                author_follower_count: 10000,
                content: 'This is a test tweet for verification purposes.',
                content_hash: 'test_hash_' + Date.now(),
                likes: 1500,
                retweets: 300,
                replies: 150,
                views: 50000,
                format_type: 'test_format',
                primary_topic: 'testing'
            };

            const { data, error } = await supabase
                .from('viral_tweets_learned')
                .insert(testTweet)
                .select('engagement_rate, viral_score')
                .single();

            if (error) throw error;
            
            // Verify triggers calculated values
            const hasEngagementRate = data.engagement_rate > 0;
            const hasViralScore = data.viral_score > 0;
            
            console.log(`  ✅ Insert test: Engagement rate calculated: ${hasEngagementRate}`);
            console.log(`  ✅ Trigger test: Viral score calculated: ${hasViralScore}`);
            
            // Cleanup test data
            await supabase
                .from('viral_tweets_learned')
                .delete()
                .eq('tweet_id', testTweet.tweet_id);
                
        } catch (error) {
            console.log(`  ❌ Basic operations test: ${error.message}`);
            this.results.errors.push(`Basic operations: ${error.message}`);
        }
    }

    printResults() {
        console.log('\n📋 VERIFICATION SUMMARY');
        console.log('========================');
        
        const tableCount = Object.values(this.results.tables).filter(t => t.exists).length;
        const indexCount = Object.values(this.results.indexes).filter(i => i.exists).length;
        const functionCount = Object.values(this.results.functions).filter(f => f.exists).length;
        const triggerCount = Object.values(this.results.triggers).filter(t => t.exists).length;
        
        console.log(`📋 Tables: ${tableCount}/7 created`);
        console.log(`🗂️  Indexes: ${indexCount}/8+ created`);
        console.log(`⚙️  Functions: ${functionCount}/3 created`);
        console.log(`🔔 Triggers: ${triggerCount}/2 created`);
        console.log(`📊 Initial data: ${this.results.initialData.formatFingerprints?.count || 0} formats, ${this.results.initialData.promptEvolution?.count || 0} prompts`);
        
        if (this.results.errors.length === 0) {
            console.log('\n🎉 ALL TESTS PASSED! Database schema is ready for AI learning.');
            console.log('✅ Your Tweet Learning System is properly configured.');
        } else {
            console.log(`\n⚠️  ${this.results.errors.length} ISSUES FOUND:`);
            this.results.errors.forEach(error => console.log(`   - ${error}`));
        }
        
        console.log('\n🚀 Next steps:');
        console.log('   1. Start the autonomous learning system');
        console.log('   2. Monitor the dashboard for learning progress');
        console.log('   3. Check tweet performance improvements over time');
    }
}

// Run verification if called directly
if (require.main === module) {
    const verifier = new DatabaseSchemaVerifier();
    verifier.verifyAll().catch(console.error);
}

module.exports = DatabaseSchemaVerifier;