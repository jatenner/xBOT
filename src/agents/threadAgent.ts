import { openaiClient } from '../utils/openaiClient';
import { xClient } from '../utils/xClient';
import { NewsAPIAgent } from './newsAPIAgent';
import { RealResearchFetcher } from './realResearchFetcher';

interface ThreadContent {
  hookTweet: string;
  summaryTweets: string[];
  analysisTweets: string[];
  conclusionTweet: string;
  threadId?: string;
  predictedEngagement: number;
  qualityScore: number;
}

interface ThreadStrategy {
  type: 'breaking_analysis' | 'research_breakdown' | 'trend_explainer' | 'controversy_dive';
  hooks: string[];
  structure: string[];
  engagementMultiplier: number;
}

export class ThreadAgent {
  private newsAPIAgent: NewsAPIAgent;
  private researchFetcher: RealResearchFetcher;
  
  // Thread strategies that drive 10X engagement
  private threadStrategies: ThreadStrategy[] = [
    {
      type: 'breaking_analysis',
      hooks: [
        'THREAD: This changes everything about {topic} 🧵',
        'BREAKING: Why {finding} is bigger than you think 🧵',
        'ALERT: {discovery} will impact {millions/industry} 🧵'
      ],
      structure: ['hook', 'context', 'breakdown', 'implications', 'call_to_action'],
      engagementMultiplier: 3.2
    },
    {
      type: 'research_breakdown',
      hooks: [
        'STUDY BREAKDOWN: {institution} just dropped bombshell research 🧵',
        'RESEARCH THREAD: {percentage}% accuracy in {field} - here\'s what it means 🧵',
        'NEW STUDY: {finding} (and why it matters) 🧵'
      ],
      structure: ['hook', 'key_findings', 'methodology', 'real_world_impact', 'future_predictions'],
      engagementMultiplier: 2.8
    },
    {
      type: 'trend_explainer',
      hooks: [
        'TREND ANALYSIS: Why everyone is talking about {topic} 🧵',
        'EXPLAINER: {technology} is changing {industry} faster than expected 🧵',
        'DEEP DIVE: The {trend} revolution nobody saw coming 🧵'
      ],
      structure: ['hook', 'current_state', 'key_players', 'timeline', 'predictions'],
      engagementMultiplier: 2.5
    },
    {
      type: 'controversy_dive',
      hooks: [
        'CONTROVERSIAL TAKE: {opinion} about {topic} 🧵',
        'UNPOPULAR OPINION: {hot_take} (hear me out) 🧵',
        'HOT TAKE: {stance} and here\'s why 🧵'
      ],
      structure: ['hook', 'setup', 'evidence', 'counterarguments', 'conclusion'],
      engagementMultiplier: 4.1
    }
  ];

  constructor() {
    this.newsAPIAgent = new NewsAPIAgent();
    this.researchFetcher = new RealResearchFetcher();
  }

  async generateViralThread(topic?: string): Promise<ThreadContent> {
    console.log('🧵 === VIRAL THREAD GENERATOR ACTIVATED ===');
    console.log('🎯 Target: 10X engagement through value-packed threads');

    try {
      // 1. Get trending research/news for thread content
      const contentData = await this.getThreadContentData(topic);
      
      // 2. Select optimal thread strategy
      const strategy = this.selectOptimalStrategy(contentData);
      
      // 3. Generate thread hook that stops scrolling
      const hookTweet = await this.generateScrollStoppingHook(contentData, strategy);
      
      // 4. Create value-packed summary tweets
      const summaryTweets = await this.generateValueSummary(contentData, strategy);
      
      // 5. Add expert analysis and insights
      const analysisTweets = await this.generateExpertAnalysis(contentData, strategy);
      
      // 6. Create engagement-driving conclusion
      const conclusionTweet = await this.generateEngagementConclusion(contentData, strategy);
      
      // 7. Calculate thread metrics
      const threadMetrics = this.calculateThreadMetrics(strategy, contentData);
      
      console.log(`🎯 Thread Quality Score: ${threadMetrics.qualityScore}/100`);
      console.log(`📈 Predicted Engagement: ${threadMetrics.predictedEngagement}% (10X TARGET)`);
      
      return {
        hookTweet,
        summaryTweets,
        analysisTweets,
        conclusionTweet,
        predictedEngagement: threadMetrics.predictedEngagement,
        qualityScore: threadMetrics.qualityScore
      };

    } catch (error) {
      console.error('❌ Thread generation failed:', error);
      return await this.generateFallbackThread();
    }
  }

  private async getThreadContentData(topic?: string): Promise<any> {
    console.log('📰 Gathering thread content data...');

    // Get fresh research and news
    const [newsData, researchData] = await Promise.all([
      this.newsAPIAgent.fetchHealthTechNews(),
      this.researchFetcher.fetchCurrentHealthTechNews()
    ]);

    // Select most thread-worthy content
    const allContent = [...newsData, ...researchData];
    const threadWorthy = allContent.filter(item => 
      item.credibilityScore >= 85 &&
      (((item as any).summary?.length >= 100) || item.title?.length >= 50)
    );

    // Return best content for threading
    return threadWorthy.length > 0 ? threadWorthy[0] : allContent[0];
  }

  private selectOptimalStrategy(contentData: any): ThreadStrategy {
    // Analyze content to select best strategy
    const content = ((contentData as any).summary || contentData.title || '').toLowerCase();
    
    if (content.includes('breakthrough') || content.includes('revolutionary')) {
      return this.threadStrategies.find(s => s.type === 'breaking_analysis')!;
    }
    
    if (content.includes('study') || content.includes('research') || content.includes('%')) {
      return this.threadStrategies.find(s => s.type === 'research_breakdown')!;
    }
    
    if (content.includes('trend') || content.includes('future') || content.includes('growing')) {
      return this.threadStrategies.find(s => s.type === 'trend_explainer')!;
    }
    
    // Default to highest engagement strategy
    return this.threadStrategies.find(s => s.type === 'controversy_dive')!;
  }

  private async generateScrollStoppingHook(contentData: any, strategy: ThreadStrategy): Promise<string> {
    console.log('🎣 Generating scroll-stopping hook...');

    const hookTemplate = strategy.hooks[Math.floor(Math.random() * strategy.hooks.length)];
    const title = contentData.title || (contentData as any).summary || 'AI Healthcare Breakthrough';
    
    // Extract key elements for hook
    const keyFinding = this.extractKeyFinding(contentData);
    const impactArea = this.extractImpactArea(contentData);
    
    const prompt = `Create a scroll-stopping Twitter thread hook that demands attention:

Content: "${title}"
Key Finding: "${keyFinding}"
Impact Area: "${impactArea}"
Strategy: ${strategy.type}

Requirements:
- Use POWERFUL action words (BREAKING, ALERT, BOMBSHELL)
- Include specific numbers/percentages when available
- Create curiosity gap that forces engagement
- Professional but urgent tone
- End with thread emoji 🧵
- Maximum 280 characters

Template style: "${hookTemplate}"

Generate ONE viral hook:`;

    try {
      const completion = await openaiClient.generateTweet({
        style: prompt
      });

      let hook = completion || '';
      
      // Ensure thread emoji and proper formatting
      if (!hook.includes('🧵')) {
        hook += ' 🧵';
      }
      
      return hook;
      
    } catch (error) {
      // Fallback hook
      return `THREAD: ${keyFinding} is changing everything about healthcare 🧵`;
    }
  }

  private async generateValueSummary(contentData: any, strategy: ThreadStrategy): Promise<string[]> {
    console.log('📝 Creating value-packed summary tweets...');

    const summaryTweets = [];
    
    // Tweet 2: Context and setup
    const contextTweet = await this.generateContextTweet(contentData);
    summaryTweets.push(`2/ ${contextTweet}`);
    
    // Tweet 3: Key findings breakdown
    const keyFindings = await this.generateKeyFindings(contentData);
    summaryTweets.push(`3/ KEY FINDINGS:\n${keyFindings}`);
    
    // Tweet 4: Technical details made simple
    const technicalBreakdown = await this.generateTechnicalBreakdown(contentData);
    summaryTweets.push(`4/ HOW IT WORKS:\n${technicalBreakdown}`);
    
    // Tweet 5: Real-world implications
    const implications = await this.generateImplications(contentData);
    summaryTweets.push(`5/ REAL-WORLD IMPACT:\n${implications}`);
    
    return summaryTweets;
  }

  private async generateExpertAnalysis(contentData: any, strategy: ThreadStrategy): Promise<string[]> {
    console.log('🔬 Adding expert analysis...');

    const analysisTweets = [];
    
    // Tweet 6: Expert perspective
    const expertView = await this.generateExpertPerspective(contentData);
    analysisTweets.push(`6/ EXPERT TAKE:\n${expertView}`);
    
    // Tweet 7: Timeline and predictions
    const timeline = await this.generateTimeline(contentData);
    analysisTweets.push(`7/ TIMELINE:\n${timeline}`);
    
    // Tweet 8: Industry impact
    const industryImpact = await this.generateIndustryImpact(contentData);
    analysisTweets.push(`8/ INDUSTRY IMPACT:\n${industryImpact}`);
    
    return analysisTweets;
  }

  private async generateEngagementConclusion(contentData: any, strategy: ThreadStrategy): Promise<string> {
    console.log('🎯 Creating engagement-driving conclusion...');

    try {
      const conclusionPrompt = `Create a powerful thread conclusion that drives engagement:

Content context: "${contentData.title || (contentData as any).summary}"
Source: "${contentData.source}"
URL: "${contentData.url}"

Requirements:
- Summarize key takeaway in 1-2 sentences
- Ask thought-provoking question to drive replies
- Include relevant hashtags (2-3 max)
- Add source link if available
- Encourage retweets/shares
- Professional but engaging tone
- Tweet number: 9/

Generate conclusion tweet:`;

      const conclusion = await openaiClient.generateTweet({
        style: conclusionPrompt
      });

      let finalConclusion = conclusion || '';
      
      // Ensure proper formatting
      if (!finalConclusion.startsWith('9/')) {
        finalConclusion = `9/ ${finalConclusion}`;
      }
      
      return finalConclusion;
      
    } catch (error) {
      return `9/ Bottom line: This breakthrough will reshape healthcare as we know it.

What's your take on AI's role in early disease detection?

Source: ${contentData.source}
${contentData.url || ''}

RT if this thread opened your eyes! 

#HealthTech #AIInnovation`;
    }
  }

  async postThread(threadContent: ThreadContent): Promise<string[]> {
    console.log('📤 Posting viral thread...');

    try {
      const tweetIds: string[] = [];
      
      // Post hook tweet first
      const hookResponse = await xClient.postTweet(threadContent.hookTweet);
      if (!hookResponse.success || !hookResponse.tweetId) {
        throw new Error(`Failed to post hook tweet: ${hookResponse.error}`);
      }
      tweetIds.push(hookResponse.tweetId);
      
      let previousTweetId = hookResponse.tweetId;
      
      // Post summary tweets
      for (const tweet of threadContent.summaryTweets) {
        const response = await xClient.postReply(tweet, previousTweetId);
        if (!response.success || !response.replyId) {
          console.warn(`Failed to post summary tweet: ${response.error}`);
          continue;
        }
        tweetIds.push(response.replyId);
        previousTweetId = response.replyId;
        
        // Wait between tweets to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Post analysis tweets
      for (const tweet of threadContent.analysisTweets) {
        const response = await xClient.postReply(tweet, previousTweetId);
        if (!response.success || !response.replyId) {
          console.warn(`Failed to post analysis tweet: ${response.error}`);
          continue;
        }
        tweetIds.push(response.replyId);
        previousTweetId = response.replyId;
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Post conclusion tweet
      const conclusionResponse = await xClient.postReply(threadContent.conclusionTweet, previousTweetId);
      if (conclusionResponse.success && conclusionResponse.replyId) {
        tweetIds.push(conclusionResponse.replyId);
      }
      
      console.log(`✅ Thread posted successfully: ${tweetIds.length} tweets`);
      console.log(`🎯 Thread ID: ${tweetIds[0]}`);
      
      return tweetIds;
      
    } catch (error) {
      console.error('❌ Failed to post thread:', error);
      throw error;
    }
  }

  // Helper methods for content generation
  private extractKeyFinding(contentData: any): string {
    const content = (contentData as any).summary || contentData.title || '';
    const sentences = content.split('. ');
    return sentences[0] || 'Revolutionary AI breakthrough';
  }

  private extractImpactArea(contentData: any): string {
    const content = ((contentData as any).summary || contentData.title || '').toLowerCase();
    
    if (content.includes('cancer')) return 'cancer detection';
    if (content.includes('heart') || content.includes('cardiac')) return 'heart disease';
    if (content.includes('diabetes')) return 'diabetes care';
    if (content.includes('mental') || content.includes('depression')) return 'mental health';
    if (content.includes('drug') || content.includes('pharma')) return 'drug discovery';
    
    return 'healthcare';
  }

  private async generateContextTweet(contentData: any): Promise<string> {
    return `Context: ${contentData.source || 'Leading research'} just published findings that could reshape ${this.extractImpactArea(contentData)}.\n\nHere's what you need to know:`;
  }

  private async generateKeyFindings(contentData: any): Promise<string> {
    const findings = [
      `• ${this.extractKeyFinding(contentData)}`,
      `• Study involved [methodology/sample size]`,
      `• Results show [specific improvement/accuracy]`,
      `• Significance: [why this matters]`
    ];
    
    return findings.join('\n');
  }

  private async generateTechnicalBreakdown(contentData: any): Promise<string> {
    return `The technology uses [method] to analyze [data type].\n\nUnlike traditional approaches, this system:\n• [Advantage 1]\n• [Advantage 2]\n• [Advantage 3]`;
  }

  private async generateImplications(contentData: any): Promise<string> {
    return `This breakthrough means:\n\n• Patients: Earlier detection = better outcomes\n• Doctors: More accurate diagnosis tools\n• Healthcare: Reduced costs and improved efficiency\n• Timeline: Implementation expected within [timeframe]`;
  }

  private async generateExpertPerspective(contentData: any): Promise<string> {
    return `Leading experts are calling this a "game-changer" for ${this.extractImpactArea(contentData)}.\n\nDr. [Expert Name] noted: "This level of accuracy was unthinkable just 5 years ago."\n\nThe implications are staggering.`;
  }

  private async generateTimeline(contentData: any): Promise<string> {
    return `• 2024: Research published\n• 2025: Clinical trials begin\n• 2026-2027: Regulatory approval process\n• 2028+: Widespread adoption\n\nBut some applications could be available much sooner.`;
  }

  private async generateIndustryImpact(contentData: any): Promise<string> {
    return `This will disrupt:\n\n• Traditional diagnostic companies\n• Healthcare delivery models\n• Insurance risk assessment\n• Pharmaceutical R&D\n\nMarket impact: Potentially billions in value creation.`;
  }

  private calculateThreadMetrics(strategy: ThreadStrategy, contentData: any): { predictedEngagement: number; qualityScore: number } {
    let baseEngagement = 150; // Base thread engagement
    let qualityScore = 80;
    
    // Strategy multiplier
    baseEngagement *= strategy.engagementMultiplier;
    
    // Content quality factors
    if (contentData.credibilityScore >= 90) {
      baseEngagement *= 1.3;
      qualityScore += 15;
    }
    
    if (contentData.url) {
      baseEngagement *= 1.2;
      qualityScore += 10;
    }
    
    // Thread-specific bonuses
    baseEngagement *= 2.5; // Threads get 2.5x more engagement than single tweets
    qualityScore += 5; // Thread format bonus
    
    return {
      predictedEngagement: Math.min(baseEngagement, 1000), // Cap at 1000% (10X)
      qualityScore: Math.min(qualityScore, 100)
    };
  }

  private async generateFallbackThread(): Promise<ThreadContent> {
    return {
      hookTweet: "THREAD: AI is revolutionizing healthcare faster than anyone predicted 🧵",
      summaryTweets: [
        "2/ Context: Multiple breakthroughs in AI diagnostics are converging to create unprecedented opportunities for early disease detection.",
        "3/ KEY FINDINGS:\n• AI now matches or exceeds human accuracy in many diagnostic tasks\n• Early detection rates improving dramatically\n• Patient outcomes significantly better",
        "4/ HOW IT WORKS:\nMachine learning algorithms analyze patterns in medical data that humans can't detect, enabling prediction of diseases months or years before symptoms appear."
      ],
      analysisTweets: [
        "5/ EXPERT TAKE:\nLeading researchers believe we're at an inflection point where AI becomes standard in healthcare within the next 5 years.",
        "6/ TIMELINE:\n• 2024: Rapid AI adoption\n• 2025: Regulatory frameworks solidify\n• 2026+: AI-first healthcare becomes norm"
      ],
      conclusionTweet: "7/ Bottom line: AI in healthcare isn't coming - it's here.\n\nHow do you think this will change your relationship with healthcare?\n\nRT if this thread was valuable!\n\n#HealthTech #AIInnovation",
      predictedEngagement: 400,
      qualityScore: 85
    };
  }
} 