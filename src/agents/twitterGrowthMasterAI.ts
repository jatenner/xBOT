import { OpenAIService } from '../utils/openaiService';
import { SecureSupabaseClient } from '../utils/secureSupabaseClient';

interface FollowerMagnet {
    magnetType: 'controversy' | 'utility' | 'insight' | 'entertainment';
    content: string;
    deploymentStrategy: string;
    followUpSequence: string[];
    expectedResults: string;
}

interface FollowerConversion {
    bioOptimization: string;
    pinnedTweetStrategy: string;
    contentMix: ContentRatio;
    engagementTactics: string[];
}

interface ContentRatio {
    educational: number;
    personal: number;
    controversial: number;
    entertainment: number;
}

export class TwitterGrowthMasterAI {
    private openaiService: OpenAIService;
    private supabaseClient: SecureSupabaseClient;

    readonly GROWTH_PSYCHOLOGY = {
        why_people_follow: [
            "Consistent valuable content in their interest area",
            "Unique perspective they can't get elsewhere", 
            "Authority and expertise in topics they care about",
            "Entertainment value and engaging personality",
            "Community feeling and belonging",
            "Status signaling and identity alignment"
        ],
        follower_conversion_triggers: [
            "Bio that immediately communicates value",
            "Pinned tweet that hooks and demonstrates worth",
            "Recent content that shows consistent quality",
            "Engagement that feels personal and authentic",
            "Social proof from other followers/engagement",
            "Promise of ongoing valuable content"
        ]
    };

    constructor() {
        this.openaiService = new OpenAIService();
        this.supabaseClient = new SecureSupabaseClient();
    }

    async createFollowerMagnet(magnetType: 'controversy' | 'utility' | 'insight' | 'entertainment' = 'utility'): Promise<FollowerMagnet> {
        const prompt = `Create a powerful follower magnet for Twitter growth:
        
        Type: ${magnetType}
        Psychology: ${JSON.stringify(this.GROWTH_PSYCHOLOGY)}
        
        Generate content that instantly makes people want to follow for more.`;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are a Twitter growth expert creating follower magnets.' },
            { role: 'user', content: prompt }
        ]);

        try {
            return JSON.parse(response);
        } catch {
            return {
                magnetType,
                content: "Most people get this wrong about health...",
                deploymentStrategy: "Post during peak hours with engagement hook",
                followUpSequence: ["Engage with comments", "Follow up with related content"],
                expectedResults: "Increased followers and engagement"
            };
        }
    }

    async optimizeFollowerConversion(): Promise<FollowerConversion> {
        const prompt = `Optimize profile for maximum follower conversion:
        
        Growth Psychology: ${JSON.stringify(this.GROWTH_PSYCHOLOGY)}
        
        Create conversion optimization strategy.`;

        const response = await this.openaiService.generateCompletion([
            { role: 'system', content: 'You are optimizing Twitter profiles for follower conversion.' },
            { role: 'user', content: prompt }
        ]);

        try {
            return JSON.parse(response);
        } catch {
            return {
                bioOptimization: "Clear value proposition + personality + credibility",
                pinnedTweetStrategy: "High-value content that demonstrates expertise",
                contentMix: { educational: 40, personal: 30, controversial: 20, entertainment: 10 },
                engagementTactics: ["Reply thoughtfully", "Ask questions", "Share experiences"]
            };
        }
    }
} 