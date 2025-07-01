import { supabase } from '../utils/supabaseClient';
import { embeddingService } from '../utils/embeddingService';
import { NewsAPIAgent } from './newsAPIAgent';

interface TopicScore {
  topic: string;
  score: number;
  recency: number;
  engagement: number;
  trending: number;
  embedding: number[];
}

interface EngagementMetrics {
  likes: number;
  retweets: number;
  replies: number;
  timestamp: Date;
}

export class LearningAgent {
  private newsAPI: NewsAPIAgent;
  
  constructor() {
    this.newsAPI = NewsAPIAgent.getInstance();
  }

  async rankTopics(candidateTopics: string[]): Promise<TopicScore[]> {
    const scores: TopicScore[] = [];
    
    for (const topic of candidateTopics) {
      const embedding = await embeddingService.generateEmbedding(topic);
      
      const recencyScore = await this.calculateRecencyScore(topic);
      const engagementScore = await this.calculateEngagementScore(topic, embedding);
      const trendingScore = await this.calculateTrendingScore(topic);
      
      const totalScore = (recencyScore * 0.3) + (engagementScore * 0.5) + (trendingScore * 0.2);
      
      scores.push({
        topic,
        score: totalScore,
        recency: recencyScore,
        engagement: engagementScore,
        trending: trendingScore,
        embedding
      });
    }
    
    return scores.sort((a, b) => b.score - a.score);
  }

  private async calculateRecencyScore(topic: string): Promise<number> {
    const { data: recentArticles } = await supabase
      .from('knowledge_store')
      .select('created_at')
      .textSearch('text', topic)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!recentArticles?.length) return 0.1;
    
    const avgAge = recentArticles.reduce((sum, article) => {
      const ageHours = (Date.now() - new Date(article.created_at).getTime()) / (1000 * 60 * 60);
      return sum + ageHours;
    }, 0) / recentArticles.length;
    
    return Math.max(0.1, 1 - (avgAge / 24));
  }

  private async calculateEngagementScore(topic: string, topicEmbedding: number[]): Promise<number> {
    const { data: highEngagementTweets } = await supabase
      .from('tweets')
      .select('content, id')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!highEngagementTweets?.length) return 0.1;
    
    let maxSimilarity = 0;
    
    for (const tweet of highEngagementTweets) {
      const { data: engagementData } = await supabase
        .from('engagement_history')
        .select('likes, retweets, replies')
        .eq('tweet_id', tweet.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
      
      if (engagementData) {
        const totalEngagement = engagementData.likes + engagementData.retweets + engagementData.replies;
        if (totalEngagement > 5) {
          const tweetEmbedding = await embeddingService.generateEmbedding(tweet.content);
          const similarity = this.cosineSimilarity(topicEmbedding, tweetEmbedding);
          
          const weightedSimilarity = similarity * Math.log(totalEngagement + 1) / 10;
          maxSimilarity = Math.max(maxSimilarity, weightedSimilarity);
        }
      }
    }
    
    return Math.min(1, maxSimilarity);
  }

  private async calculateTrendingScore(topic: string): Promise<number> {
    const { data: trendingMentions } = await supabase
      .from('knowledge_store')
      .select('created_at')
      .textSearch('text', topic)
      .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });
    
    const mentionCount = trendingMentions?.length || 0;
    return Math.min(1, mentionCount / 10);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async updateTopicPriors(): Promise<void> {
    const { data: recentTweets } = await supabase
      .from('tweets')
      .select('id, content, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });
    
    if (!recentTweets?.length) return;
    
    const topicPerformance: { [topic: string]: EngagementMetrics[] } = {};
    
    for (const tweet of recentTweets) {
      const { data: engagement } = await supabase
        .from('engagement_history')
        .select('likes, retweets, replies, timestamp')
        .eq('tweet_id', tweet.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
      
      if (engagement) {
        const extractedTopics = await this.extractTopicsFromContent(tweet.content);
        
        for (const topic of extractedTopics) {
          if (!topicPerformance[topic]) {
            topicPerformance[topic] = [];
          }
          topicPerformance[topic].push({
            likes: engagement.likes,
            retweets: engagement.retweets,
            replies: engagement.replies,
            timestamp: new Date(engagement.timestamp)
          });
        }
      }
    }
    
    await this.saveTopicPriors(topicPerformance);
  }

  private async extractTopicsFromContent(content: string): Promise<string[]> {
    const healthTechKeywords = [
      'AI', 'artificial intelligence', 'machine learning', 'deep learning',
      'telemedicine', 'telehealth', 'digital health', 'mHealth',
      'wearables', 'sensors', 'IoT', 'blockchain',
      'genomics', 'precision medicine', 'personalized medicine',
      'drug discovery', 'clinical trials', 'biotech',
      'EMR', 'EHR', 'interoperability', 'FHIR',
      'mental health', 'therapy', 'wellness',
      'diagnostics', 'imaging', 'radiology'
    ];
    
    const contentLower = content.toLowerCase();
    return healthTechKeywords.filter(keyword => 
      contentLower.includes(keyword.toLowerCase())
    );
  }

  private async saveTopicPriors(topicPerformance: { [topic: string]: EngagementMetrics[] }): Promise<void> {
    const priors = Object.entries(topicPerformance).map(([topic, metrics]) => {
      const avgEngagement = metrics.reduce((sum, m) => sum + m.likes + m.retweets + m.replies, 0) / metrics.length;
      return { topic, avgEngagement, sampleSize: metrics.length };
    });
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'topic_priors',
        value: { priors, updated_at: new Date().toISOString() }
      });
  }
} 