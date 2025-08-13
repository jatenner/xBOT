import OpenAI from 'openai';
import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

export interface ContentGenerationRequest {
  contentType: 'thread' | 'single' | 'reply';
  topic?: string;
  mood?: 'informative' | 'engaging' | 'funny' | 'controversial';
  targetLength?: 'short' | 'medium' | 'long';
}

export interface GeneratedContent {
  content: string;
  isThread: boolean;
  threadParts?: string[];
  hashtags: string[];
  estimatedEngagement: number;
  contentScore: number;
}

export interface SignalSynapseThreadData {
  topic: string;
  hook_type: "stat" | "myth_bust" | "how_to" | "story";
  cta: "follow_for_series" | "reply_with_goal" | "bookmark_checklist";
  hashtags: string[];
  source_urls: string[];
  tags: string[];
  predicted_scores: {
    hook_clarity: number;
    novelty: number;
    evidence: number;
    cta_strength: number;
  };
  content_notes: string;
  tweets: string[];
}

export class IntelligentContentGenerator {
  private static instance: IntelligentContentGenerator;
  private openai: OpenAI;
  private db: AdvancedDatabaseManager;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.db = AdvancedDatabaseManager.getInstance();
  }

  public static getInstance(): IntelligentContentGenerator {
    if (!IntelligentContentGenerator.instance) {
      IntelligentContentGenerator.instance = new IntelligentContentGenerator();
    }
    return IntelligentContentGenerator.instance;
  }

  public async generateContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
    try {
      console.log('🧠 Generating intelligent content...', request);

      // Get content style from database
      const contentStyle = await this.getContentStyle();
      
      // Generate content based on request
      const prompt = this.buildPrompt(request, contentStyle);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a viral content creator who builds massive followings. Create engaging, human-like content that gets shared.
            
            RULES:
            - Sound like a real person, not a brand or corporate account
            - NO hashtags unless absolutely necessary (hashtags kill reach)
            - If creating a thread, number it properly (1/, 2/, etc.)
            - Make it shareable, relatable, and valuable
            - Cover diverse topics: productivity, life hacks, science, relationships, career, finance, tech
            - Write like you're texting a friend or sharing something you just learned
            - Each thread part should be under 280 characters
            - Start with hooks like "Just realized...", "Pro tip:", "Anyone else...", "Fun fact:"
            - Avoid quote-like formatting - make it conversational`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.8
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Analyze the generated content
      const analysis = this.analyzeContent(content);
      
      // Store generation data for learning
      await this.storeGenerationData(request, content, analysis);
      
      return analysis;
    } catch (error: any) {
      console.error('❌ Content generation failed:', error.message);
      throw error;
    }
  }

  public async generateSignalSynapseThread(topic?: string): Promise<SignalSynapseThreadData> {
    try {
      console.log('🧬 Generating Signal_Synapse health thread...', { topic });

      const prompt = this.buildSignalSynapsePrompt(topic);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are the Content Director and Data Ops for @Signal_Synapse (x.com/Signal_Synapse).
Your job: produce high-engagement, science-grounded Twitter/X threads AND return
machine-readable JSON the bot can post and learn from.

OUTPUT RULES (IMPORTANT)
- Return JSON ONLY, conforming exactly to the schema below. No prose, no markdown.
- Each tweet ≤ 260 chars. One emoji max per tweet. 0–2 hashtags TOTAL (never in T1).
- Include 2–3 credible sources with direct URLs (CDC, NIH, WHO, Cochrane, PubMed,
  NHS, Harvard T.H. Chan, etc.). Avoid blogs and commercial pages.
- Tone: friendly, concise, practical; avoid hype ("insane", "crazy"). Use "may/can"
  for health claims; add brief non-medical-advice disclaimer if needed.
- Vary angle from day to day. Do not repeat prior claims verbatim if similar topic.

THREAD STRUCTURE
1) HOOK (T1): curiosity + clear benefit. No hashtags in the hook.
2) BODY (T2–T5/6): short lines or bullets; each tweet delivers one idea or micro-step.
3) SOURCES (penultimate): list 2–3 credible links.
4) CTA (final): soft call-to-action (follow/bookmark/reply). Keep human, not salesy.

LEARNING LABELS YOU MUST PROVIDE
- hook_type: one of ["stat","myth_bust","how_to","story"].
- cta: one of ["follow_for_series","reply_with_goal","bookmark_checklist"].
- tags: 3–6 single-word labels describing angle (e.g., ["hydration","habit","morning"]).
- predicted_scores: integers 0–100 for {hook_clarity, novelty, evidence, cta_strength}.
- content_notes: 1–2 sentences on the key claim + why it should work.

SCHEMA YOU MUST FOLLOW (return this shape exactly):
{
  "topic": "string",
  "hook_type": "stat | myth_bust | how_to | story",
  "cta": "follow_for_series | reply_with_goal | bookmark_checklist",
  "hashtags": ["string", "..."],          // max 2; can be empty
  "source_urls": ["https://...", "..."],  // 2–3 credible links
  "tags": ["string","string","string"],   // 3–6 labels
  "predicted_scores": {
    "hook_clarity": 0,
    "novelty": 0,
    "evidence": 0,
    "cta_strength": 0
  },
  "content_notes": "string",
  "tweets": ["T1 text", "T2 text", "T3 text", "T4 text", "T5 text", "T6 text (optional)", "T7 text (optional)"]
}

SELF-CRITIQUE BEFORE YOU ANSWER
- Tighten the hook; delete filler; keep ≤260 chars per tweet.
- Ensure sources are credible and match claims; if not, soften language or swap claim.
- Enforce ONE emoji max per tweet and ≤2 hashtags total.
- Ensure the final tweet is a clean CTA matching the selected "cta" value.

IF THE USER BRIEF IS VAGUE
- Choose a timely or evergreen micro-topic within health/wellness (hydration, sleep,
  light exposure, step count, protein spacing, stress downshifts) that you can defend
  with credible sources.

IF THE REQUEST WOULD REQUIRE MEDICAL ADVICE
- Keep general, non-diagnostic guidance and include a short final disclaimer line in
  the sources or CTA tweet (e.g., "Not medical advice; general info only.")

RETURN JSON ONLY. NO EXTRA TEXT.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Parse the JSON response
      let threadData: SignalSynapseThreadData;
      try {
        threadData = JSON.parse(content);
      } catch (parseError) {
        console.error('❌ Failed to parse Signal_Synapse JSON response:', parseError);
        throw new Error('Invalid JSON response from AI');
      }

      // Validate the response structure
      this.validateSignalSynapseThread(threadData);
      
      // Store the thread data for learning
      await this.storeSignalSynapseThread(threadData);
      
      console.log('✅ Generated Signal_Synapse thread:', {
        topic: threadData.topic,
        hook_type: threadData.hook_type,
        tweet_count: threadData.tweets.length,
        predicted_scores: threadData.predicted_scores
      });
      
      return threadData;
    } catch (error: any) {
      console.error('❌ Signal_Synapse thread generation failed:', error.message);
      throw error;
    }
  }

  private buildPrompt(request: ContentGenerationRequest, style: string): string {
    const topics = [
      'productivity hacks', 'life optimization', 'surprising facts', 'career insights', 
      'money tips', 'relationship advice', 'tech discoveries', 'psychology insights',
      'time management', 'personal growth', 'science breakthroughs', 'learning techniques',
      'creativity tips', 'health optimization', 'wellness hacks', 'success principles'
    ];
    
    const randomTopic = request.topic || topics[Math.floor(Math.random() * topics.length)];
    
    const prompts = {
      thread: `Create a viral Twitter thread about ${randomTopic}. 
              Start with a hook, then break down insights. Make it ${request.mood || 'engaging'}.
              Number each part (1/, 2/, etc.). Sound human and shareable.`,
      
      single: `Create a viral tweet about ${randomTopic}. 
               Make it ${request.mood || 'engaging'} and relatable.
               Start with "Just learned...", "Pro tip:", "Fun fact:", or "Anyone else...".
               No hashtags. Sound like a real person.`,
               
      reply: `Create a helpful reply about ${randomTopic}. 
              Be conversational and add value. 
              Sound like you're genuinely helping a friend.`
    };

    return prompts[request.contentType] || prompts.single;
  }

  private analyzeContent(content: string): GeneratedContent {
    // Detect if it's a thread
    const isThread = /\d+\//.test(content);
    
    // Split into thread parts if it's a thread
    let threadParts: string[] = [];
    if (isThread) {
      threadParts = content.split('\n\n').filter(part => part.trim().length > 0);
    }

    // Extract hashtags
    const hashtags = content.match(/#\w+/g) || [];

    // Calculate engagement score (simplified)
    const engagementScore = this.calculateEngagementScore(content);
    
    // Calculate content quality score
    const contentScore = this.calculateContentScore(content);

    return {
      content: isThread ? threadParts.join('\n\n') : content,
      isThread,
      threadParts: isThread ? threadParts : undefined,
      hashtags,
      estimatedEngagement: engagementScore,
      contentScore
    };
  }

  private calculateEngagementScore(content: string): number {
    let score = 50; // Base score
    
    // Length optimization
    if (content.length > 100 && content.length < 250) score += 10;
    
    // Question marks increase engagement
    if (content.includes('?')) score += 15;
    
    // Emojis (but not too many)
    const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
    if (emojiCount > 0 && emojiCount <= 3) score += 5;
    
    // Hashtags (but penalize too many)
    const hashtagCount = (content.match(/#\w+/g) || []).length;
    if (hashtagCount === 0) score += 10; // No hashtags is more human
    if (hashtagCount > 3) score -= 15; // Too many hashtags
    
    // Thread bonus
    if (/\d+\//.test(content)) score += 20;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateContentScore(content: string): number {
    let score = 50;
    
    // Value indicators
    if (content.includes('tip') || content.includes('hack') || content.includes('secret')) score += 10;
    if (content.includes('study') || content.includes('research')) score += 5;
    if (content.includes('myth') || content.includes('truth')) score += 8;
    
    // Readability
    const sentences = content.split(/[.!?]+/).length;
    if (sentences >= 2 && sentences <= 5) score += 10;
    
    // Personal tone
    if (content.includes('you') || content.includes('your')) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }

  private async getContentStyle(): Promise<string> {
    try {
      const result = await this.db.executeQuery(
        'get_content_style',
        async (client) => {
          const { data, error } = await client
            .from('bot_config')
            .select('config_value')
            .eq('config_key', 'content_style')
            .single();
          if (error) throw error;
          return data;
        }
      );
      return result?.config_value || 'health_focused';
    } catch (error) {
      console.warn('Failed to get content style, using default');
      return 'health_focused';
    }
  }

  private async storeGenerationData(
    request: ContentGenerationRequest, 
    content: string, 
    analysis: GeneratedContent
  ): Promise<void> {
    try {
      await this.db.executeQuery(
        'store_generation_data',
        async (client) => {
          const { error } = await client
            .from('content_generations')
            .insert({
              content_type: request.contentType,
              topic: request.topic || 'general',
              mood: request.mood || 'informative',
              content: content,
              engagement_score: analysis.estimatedEngagement,
              content_score: analysis.contentScore
            });
          if (error) throw error;
          return { success: true };
        }
      );
    } catch (error) {
      // Non-critical error - content generation should continue
      console.warn('Failed to store generation data:', error);
    }
  }

  private buildSignalSynapsePrompt(topic?: string): string {
    const healthTopics = [
      'protein timing for muscle recovery',
      'hydration myths and science',
      'sleep optimization techniques',
      'vitamin D deficiency signs',
      'stress reduction methods',
      'exercise timing benefits',
      'nutrition timing strategies',
      'mental health awareness',
      'preventive health screening',
      'micronutrient absorption',
      'circadian rhythm optimization',
      'inflammation reduction',
      'gut health fundamentals',
      'bone density preservation',
      'cognitive enhancement naturally'
    ];
    
    const selectedTopic = topic || healthTopics[Math.floor(Math.random() * healthTopics.length)];
    
    return `Generate a science-based Twitter thread about "${selectedTopic}" following the exact JSON format specified. Focus on practical, evidence-based health information with credible sources.`;
  }

  private validateSignalSynapseThread(data: SignalSynapseThreadData): void {
    if (!data.topic || typeof data.topic !== 'string') {
      throw new Error('Invalid topic in Signal_Synapse thread');
    }
    
    if (!['stat', 'myth_bust', 'how_to', 'story'].includes(data.hook_type)) {
      throw new Error('Invalid hook_type in Signal_Synapse thread');
    }
    
    if (!['follow_for_series', 'reply_with_goal', 'bookmark_checklist'].includes(data.cta)) {
      throw new Error('Invalid cta in Signal_Synapse thread');
    }
    
    if (!Array.isArray(data.tweets) || data.tweets.length < 4) {
      throw new Error('Invalid tweets array in Signal_Synapse thread');
    }
    
    if (!Array.isArray(data.source_urls) || data.source_urls.length < 2) {
      throw new Error('Invalid source_urls in Signal_Synapse thread');
    }
    
    if (!Array.isArray(data.tags) || data.tags.length < 3) {
      throw new Error('Invalid tags in Signal_Synapse thread');
    }
    
    // Validate tweet character limits
    for (let i = 0; i < data.tweets.length; i++) {
      if (data.tweets[i].length > 260) {
        throw new Error(`Tweet ${i + 1} exceeds 260 character limit: ${data.tweets[i].length} chars`);
      }
    }
    
    // Validate hashtag limit
    if (data.hashtags.length > 2) {
      throw new Error('Too many hashtags (max 2 allowed)');
    }
  }

  private async storeSignalSynapseThread(data: SignalSynapseThreadData): Promise<void> {
    try {
      await this.db.executeQuery(
        'store_signal_synapse_thread',
        async (client) => {
          const { error } = await client
            .from('signal_synapse_threads')
            .insert({
              topic: data.topic,
              hook_type: data.hook_type,
              cta: data.cta,
              hashtags: data.hashtags,
              source_urls: data.source_urls,
              tags: data.tags,
              predicted_scores: data.predicted_scores,
              content_notes: data.content_notes,
              tweets: data.tweets,
              tweet_count: data.tweets.length,
              created_at: new Date().toISOString()
            });
          if (error) throw error;
          return { success: true };
        }
      );
    } catch (error) {
      // Non-critical error - thread generation should continue
      console.warn('Failed to store Signal_Synapse thread data:', error);
    }
  }

  public async getTopPerformingTopics(limit: number = 10): Promise<Array<{topic: string, avgScore: number}>> {
    try {
      const result = await this.db.executeQuery(
        'get_top_performing_topics',
        async (client) => {
          const { data, error } = await client
            .rpc('get_top_performing_topics', { 
              topic_limit: limit,
              days_back: 30,
              min_count: 3 
            });
          if (error) throw error;
          return data || [];
        }
      );
      
      return result.map((row: any) => ({
        topic: row.topic,
        avgScore: parseFloat(row.avg_score)
      }));
    } catch (error) {
      console.warn('Failed to get top performing topics:', error);
      return [];
    }
  }
}