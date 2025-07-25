import { OpenAIService } from '../utils/openaiService';
import { SecureSupabaseClient } from '../utils/secureSupabaseClient';

interface TrendData {
    topic: string;
    momentum: 'rising' | 'peak' | 'declining';
    healthRelevance: number;
    opportunityScore: number;
    entryStrategy: string;
    contentAngles: string[];
}

export class TrendMonitorAI {
    private openaiService: OpenAIService;
    private supabaseClient: SecureSupabaseClient;

    readonly TREND_SOURCES = {
        health_news: ['Reuters Health', 'WebMD News', 'Healthline News'],
        wellness_trends: ['Mind Body Green', 'Well+Good', 'Goop'],
        social_signals: ['Twitter trending', 'Reddit health discussions', 'TikTok wellness trends'],
        research_updates: ['PubMed recent', 'Medical journals', 'Health studies']
    };

    constructor() {
        this.openaiService = new OpenAIService();
        this.supabaseClient = new SecureSupabaseClient();
    }

    async monitorTrends(): Promise<TrendData[]> {
        // Simulate trend detection with AI analysis
        const prompt = `Identify current health and wellness trends with Twitter opportunity potential:
        
        Sources: ${JSON.stringify(this.TREND_SOURCES)}
        
        Find trends that offer health/wellness angle opportunities for Twitter content.`;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are a trend analyst identifying Twitter content opportunities.' },
            { role: 'user', content: prompt }
        ]);

        try {
            const parsed = JSON.parse(response);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [{
                topic: 'Digital wellness trends',
                momentum: 'rising',
                healthRelevance: 85,
                opportunityScore: 90,
                entryStrategy: 'Share practical screen time tips',
                contentAngles: ['Work-life balance', 'Mental health', 'Productivity']
            }];
        }
    }
} 