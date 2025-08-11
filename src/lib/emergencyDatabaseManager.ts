import { createClient } from '@supabase/supabase-js';

export class EmergencyDatabaseManager {
    private supabase: any;
    private isConnected = false;

    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }

    async initialize(): Promise<void> {
        try {
            // Test Supabase connection
            const { data, error } = await this.supabase
                .from('bot_config')
                .select('count')
                .limit(1);
            
            if (!error) {
                this.isConnected = true;
                console.log('✅ Emergency database manager initialized (Supabase only)');
            }
        } catch (error: any) {
            console.warn('⚠️ Database connection issue:', error.message);
            this.isConnected = false;
        }
    }

    async getBotConfig(key: string): Promise<any> {
        try {
            const { data, error } = await this.supabase
                .from('bot_config')
                .select('config_value')
                .eq('config_key', key)
                .single();
            
            if (error) throw error;
            return data?.config_value;
        } catch (error) {
            console.warn(`⚠️ Could not get config ${key}`, error);
            return null;
        }
    }

    async storeTweet(content: string, tweetId: string): Promise<void> {
        try {
            const { error } = await this.supabase
                .from('tweets')
                .insert({
                    content,
                    tweet_id: tweetId,
                    posted_at: new Date().toISOString(),
                    platform: 'twitter',
                    status: 'posted'
                });
            
            if (error) throw error;
            console.log('✅ Tweet stored in database');
        } catch (error: any) {
            console.warn('⚠️ Could not store tweet:', error.message);
        }
    }

    isHealthy(): boolean {
        return this.isConnected;
    }
}

export const emergencyDb = new EmergencyDatabaseManager();