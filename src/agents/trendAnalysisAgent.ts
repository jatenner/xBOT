import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';
import { openaiClient } from '../utils/openaiClient';
import * as natural from 'natural';

interface TrendData {
  keyword: string;
  volume: number;
  sentiment: number;
  relevance_score: number;
  sample_tweets: string[];
  related_terms: string[];
}

export class TrendAnalysisAgent {
  private readonly healthKeywords = [
    'health', 'healthcare', 'medical', 'AI', 'artificial intelligence',
    'digital health', 'telemedicine', 'biotech', 'wearable', 'fitness',
    'wellness', 'medicine', 'diagnosis', 'treatment', 'therapy'
  ];

  async run(): Promise<TrendData[]> {
    try {
      console.log('📈 TrendAnalysisAgent: Analyzing current trends...');

      // Analyze trends from multiple sources
      const trends = await this.analyzeTrends();

      // Store trend data
      await this.storeTrendData(trends);

      console.log(`✅ Analyzed ${trends.length} trending topics`);
      return trends;

    } catch (error) {
      console.error('❌ Error in TrendAnalysisAgent:', error);
      return [];
    }
  }

  private async analyzeTrends(): Promise<TrendData[]> {
    const trends: TrendData[] = [];

    try {
      // Search for trending health-related content
      for (const keyword of this.healthKeywords.slice(0, 5)) { // Limit to avoid rate limits
        const trendData = await this.analyzeKeywordTrend(keyword);
        if (trendData) {
          trends.push(trendData);
        }
        
        // Rate limiting
        await this.delay(2000);
      }

      // Sort by relevance and volume
      trends.sort((a, b) => {
        const scoreA = a.relevance_score * Math.log(a.volume + 1);
        const scoreB = b.relevance_score * Math.log(b.volume + 1);
        return scoreB - scoreA;
      });

      return trends.slice(0, 10); // Top 10 trends

    } catch (error) {
      console.error('Error analyzing trends:', error);
      return [];
    }
  }

  private async analyzeKeywordTrend(keyword: string): Promise<TrendData | null> {
    try {
      // Search for recent tweets about this keyword
      const searchResults = await xClient.searchTweets(
        `${keyword} lang:en -is:retweet`,
        20
      );

      if (!searchResults || searchResults.length === 0) {
        return null;
      }

      // Analyze the tweets
      const tweets = searchResults.map(tweet => tweet.text);
      const sentiment = this.analyzeSentiment(tweets);
      const relatedTerms = this.extractRelatedTerms(tweets, keyword);
      const relevanceScore = this.calculateRelevanceScore(tweets, keyword);

      return {
        keyword,
        volume: tweets.length,
        sentiment,
        relevance_score: relevanceScore,
        sample_tweets: tweets.slice(0, 3),
        related_terms: relatedTerms.slice(0, 5)
      };

    } catch (error) {
      console.warn(`Failed to analyze trend for "${keyword}":`, error);
      return null;
    }
  }

  private analyzeSentiment(tweets: string[]): number {
    try {
      const Sentiment = require('sentiment');
      const sentiment = new Sentiment();
      
      let totalScore = 0;
      let count = 0;

      for (const tweet of tweets) {
        const result = sentiment.analyze(tweet);
        totalScore += result.score;
        count++;
      }

      // Normalize to 0-1 scale
      const avgScore = count > 0 ? totalScore / count : 0;
      return Math.max(0, Math.min(1, (avgScore + 5) / 10));

    } catch (error) {
      return 0.5; // Neutral fallback
    }
  }

  private extractRelatedTerms(tweets: string[], keyword: string): string[] {
    try {
      const tokenizer = natural.WordTokenizer;
      const stemmer = natural.PorterStemmer;
      
      const allWords: { [key: string]: number } = {};
      
      for (const tweet of tweets) {
        const words = tokenizer.tokenize(tweet.toLowerCase()) || [];
        
        for (const word of words) {
          if (word.length > 3 && word !== keyword.toLowerCase() && 
              !this.isStopWord(word) && /^[a-z]+$/.test(word)) {
            const stemmed = stemmer.stem(word);
            allWords[stemmed] = (allWords[stemmed] || 0) + 1;
          }
        }
      }

      // Sort by frequency and return top terms
      return Object.entries(allWords)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([word]) => word);

    } catch (error) {
      return [];
    }
  }

  private calculateRelevanceScore(tweets: string[], keyword: string): number {
    let score = 0;
    const totalTweets = tweets.length;

    if (totalTweets === 0) return 0;

    for (const tweet of tweets) {
      const lowerTweet = tweet.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();

      // Exact keyword match
      if (lowerTweet.includes(lowerKeyword)) score += 0.5;

      // Health-related terms
      const healthTerms = ['medical', 'diagnosis', 'treatment', 'patient', 'doctor', 'hospital', 'research'];
      for (const term of healthTerms) {
        if (lowerTweet.includes(term)) score += 0.1;
      }

      // Technology terms
      const techTerms = ['ai', 'algorithm', 'machine learning', 'data', 'digital', 'tech'];
      for (const term of techTerms) {
        if (lowerTweet.includes(term)) score += 0.1;
      }

      // Engagement indicators
      if (lowerTweet.includes('?') || lowerTweet.includes('breakthrough') || 
          lowerTweet.includes('innovation') || lowerTweet.includes('study')) {
        score += 0.2;
      }
    }

    return Math.min(score / totalTweets, 1.0);
  }

  private isStopWord(word: string): boolean {
    const stopWords = [
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as',
      'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might',
      'must', 'shall', 'for', 'of', 'with', 'by', 'from', 'up', 'about',
      'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'among', 'this', 'that', 'these', 'those', 'i', 'me',
      'we', 'us', 'you', 'he', 'him', 'she', 'her', 'it', 'they', 'them'
    ];
    
    return stopWords.includes(word.toLowerCase());
  }

  private async storeTrendData(trends: TrendData[]): Promise<void> {
    try {
      for (const trend of trends) {
        // Store as content theme with high engagement potential
        await supabaseClient.updateContentTheme(
          trend.keyword.toLowerCase().replace(/\s+/g, '_'),
          Math.round(trend.relevance_score * trend.volume),
          trend.sentiment
        );

        // Store as learning insight
        await supabaseClient.storeLearningInsight({
          insight_type: 'trending_topic',
          insight_data: {
            keyword: trend.keyword,
            volume: trend.volume,
            sentiment: trend.sentiment,
            related_terms: trend.related_terms,
            sample_tweets: trend.sample_tweets.map(t => t.substring(0, 100))
          },
          confidence_score: trend.relevance_score,
          performance_impact: trend.volume > 10 ? 0.3 : 0.1,
          sample_size: trend.volume
        });
      }
    } catch (error) {
      console.error('Error storing trend data:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Generate trend-based content suggestions
  async generateTrendInsights(trends: TrendData[]): Promise<string[]> {
    try {
      if (trends.length === 0) return [];

      const topTrends = trends.slice(0, 3);
      const prompt = `Based on these trending health/AI topics, generate 3 content ideas for Twitter:

TRENDING NOW:
${topTrends.map(t => `- ${t.keyword} (${t.volume} mentions, sentiment: ${t.sentiment.toFixed(2)}, related: ${t.related_terms.slice(0, 3).join(', ')})`).join('\n')}

SAMPLE CONTENT:
${topTrends.map(t => `"${t.sample_tweets[0]?.substring(0, 100)}..."`).join('\n')}

Generate 3 specific, engaging tweet ideas that:
1. Address current trending topics
2. Provide valuable health/AI insights
3. Encourage discussion and engagement
4. Sound authoritative but accessible

Format as bullet points with specific angles or data points.`;

      const insights = await openaiClient.generateInsights(prompt);
      return insights || [
        'Current AI trends suggest breakthrough in medical diagnosis accuracy',
        'Health technology adoption accelerating in response to current discussions',
        'Trending topics indicate growing interest in preventive digital health'
      ];

    } catch (error) {
      console.error('Error generating trend insights:', error);
      return [];
    }
  }

  // Test method
  async testTrendAnalysis(): Promise<void> {
    console.log('🧪 Testing trend analysis...');
    
    const trends = await this.run();
    
    console.log(`\n📈 Found ${trends.length} trends:`);
    trends.slice(0, 5).forEach((trend, i) => {
      console.log(`${i + 1}. ${trend.keyword}`);
      console.log(`   Volume: ${trend.volume}, Sentiment: ${trend.sentiment.toFixed(2)}, Relevance: ${trend.relevance_score.toFixed(2)}`);
      console.log(`   Related: ${trend.related_terms.slice(0, 3).join(', ')}`);
      console.log(`   Sample: "${trend.sample_tweets[0]?.substring(0, 80)}..."\n`);
    });

    if (trends.length > 0) {
      console.log('💡 Generating trend-based insights...');
      const insights = await this.generateTrendInsights(trends);
      insights.forEach((insight, i) => {
        console.log(`${i + 1}. ${insight}`);
      });
    }
  }
}

// Allow running as standalone script
if (require.main === module) {
  const agent = new TrendAnalysisAgent();
  agent.testTrendAnalysis();
} 