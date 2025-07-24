import { openaiClient } from '../utils/openaiClient';
import { supabaseClient } from '../utils/supabaseClient';
import * as crypto from 'crypto';

interface ContentTemplate {
  type: string;
  structure: string;
  examples: string[];
}

interface UsedContent {
  type: string;
  topic: string;
  opening: string;
  timestamp: Date;
}

interface DatabaseContent {
  content: string;
  content_hash: string;
  created_at: string;
  tweet_type: string;
}

export class DiverseContentAgent {
  private recentContent: UsedContent[] = [];
  
  private contentTemplates: ContentTemplate[] = [
    {
      type: 'actionable_tip',
      structure: 'Direct actionable advice with specific steps',
      examples: [
        'Take 2g of magnesium glycinate 30 minutes before bed. Most people are deficient and it improves deep sleep by 40%.',
        'Eat your largest meal at 11 AM, not dinner. Your metabolism is 23% higher in the morning.',
        'Cold shower for 2 minutes = 300% dopamine increase for 4 hours. Better than coffee.'
      ]
    },
    {
      type: 'counterintuitive_fact',
      structure: 'Surprising truth that challenges common beliefs',
      examples: [
        'Drinking water during meals dilutes stomach acid and reduces nutrient absorption by 30%.',
        'Stretching before exercise increases injury risk by 27%. Dynamic warm-ups are superior.',
        'Eating fat with vegetables increases nutrient absorption 15x. Salad without dressing is wasteful.'
      ]
    },
    {
      type: 'research_insight',
      structure: 'Recent study findings with practical application',
      examples: [
        'New Harvard study: 5 minutes of morning sunlight regulates circadian rhythm better than melatonin.',
        'Japanese research: Walking after meals reduces blood sugar spikes by 45%. Even 2 minutes helps.',
        'Stanford findings: Breathing exercises work faster than meditation for stress reduction.'
      ]
    },
    {
      type: 'optimization_hack',
      structure: 'Biohacking technique with measurable benefits',
      examples: [
        'Breathe through your nose during exercise. Increases oxygen efficiency by 20% vs mouth breathing.',
        'Sleep in 67°F room. Core temperature drop triggers deeper sleep and growth hormone release.',
        'Fast for 16 hours but break it with protein + fat. Maintains muscle while burning fat.'
      ]
    },
    {
      type: 'mistake_correction',
      structure: 'Common health mistake and the right way',
      examples: [
        'Most people ice injuries immediately. Heat for first 48 hours actually speeds healing by increasing blood flow.',
        'Taking vitamins on empty stomach reduces absorption. Always take with healthy fats.',
        'Cardio before weights depletes glycogen. Lift first, then cardio for better fat burning.'
      ]
    },
    {
      type: 'timing_optimization',
      structure: 'When to do things for maximum benefit',
      examples: [
        'Exercise between 6-8 AM when cortisol peaks. Testosterone is highest and performance improves 15%.',
        'Eat carbs post-workout only. Insulin sensitivity is 40% higher for 2 hours after exercise.',
        'Take omega-3s at dinner. Absorption increases 300% when taken with evening meal.'
      ]
    },
    {
      type: 'mechanism_explanation',
      structure: 'How something works in your body',
      examples: [
        'Intermittent fasting works by depleting liver glycogen, forcing your body to burn stored fat for energy.',
        'Cold exposure activates brown fat, which burns 300% more calories than regular fat tissue.',
        'Protein synthesis peaks 3 hours post-workout. Miss this window and muscle growth drops 50%.'
      ]
    },
    {
      type: 'dosage_precision',
      structure: 'Exact amounts and timing for supplements/nutrients',
      examples: [
        'Vitamin D: 4000 IU with K2 in the morning. Without K2, calcium goes to arteries instead of bones.',
        'Creatine: 5g daily, timing irrelevant. Loading phases are marketing - just stay consistent.',
        'Caffeine: 1-2mg per pound bodyweight. More causes cortisol spikes and crashes energy.'
      ]
    }
  ];

  async generateDiverseContent(): Promise<{ content: string; type: string; success: boolean; error?: string }> {
    try {
      // Clean old content (remove entries older than 24 hours)
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      this.recentContent = this.recentContent.filter(item => item.timestamp > cutoff);

      // 🔍 DATABASE CONTENT CHECK: Get all recent content from database
      const databaseContent = await this.getRecentDatabaseContent();
      console.log(`🔍 Database content check: ${databaseContent.length} recent tweets found`);

      // AGGRESSIVE UNIQUENESS: Get detailed blacklist from both memory and database
      const recentTopics = this.recentContent.map(item => item.topic.toLowerCase());
      const recentOpenings = this.recentContent.map(item => item.opening.toLowerCase());
      const recentKeywords = this.extractAllKeywords(this.recentContent);
      
      // Extract keywords and topics from database content
      const databaseKeywords = this.extractDatabaseKeywords(databaseContent);
      const databaseTopics = this.extractDatabaseTopics(databaseContent);
      
      // Combine memory and database blacklists
      const allKeywords = [...new Set([...recentKeywords, ...databaseKeywords])];
      const allTopics = [...new Set([...recentTopics, ...databaseTopics])];

      console.log(`🚫 Complete blacklist: ${allTopics.length} topics, ${allKeywords.length} keywords blocked`);
      console.log(`🚫 Recent database topics: ${databaseTopics.slice(0, 5).join(', ')}...`);
      
      // Try up to 7 different attempts to ensure uniqueness
      let attempts = 0;
      const maxAttempts = 7;
      
      while (attempts < maxAttempts) {
        attempts++;
        
        // Select a template type we haven't used recently (prioritize unused ones)
        const availableTemplates = this.contentTemplates.filter(template => 
          !this.recentContent.some(recent => recent.type === template.type)
        );

        const selectedTemplate = availableTemplates.length > 0 
          ? availableTemplates[Math.floor(Math.random() * availableTemplates.length)]
          : this.contentTemplates[Math.floor(Math.random() * this.contentTemplates.length)];

        console.log(`🎯 Attempt ${attempts}: Using template '${selectedTemplate.type}'`);

        // Generate content with strict uniqueness requirements
        const prompt = this.buildUniquePrompt(selectedTemplate, allTopics, allKeywords, attempts);
        
        const content = await openaiClient.generateCompletion(prompt, {
          maxTokens: 120,
          temperature: 0.95, // Higher temperature for more variation
          model: 'gpt-4o-mini'
        });

        if (!content || content.length < 50) {
          console.warn(`⚠️ Generated content too short on attempt ${attempts}`);
          continue;
        }

        // STRICT UNIQUENESS CHECK (memory + database)
        const isUnique = await this.isContentCompletelyUnique(content, allTopics, allKeywords, databaseContent);
        if (!isUnique.unique) {
          console.warn(`🚫 Content rejected (attempt ${attempts}): ${isUnique.reason}`);
          continue;
        }

        // Content is unique - process and return
        const finalContent = content.length <= 280 ? content : content.substring(0, 277) + '...';
        const topic = this.extractTopic(finalContent);
        const opening = finalContent.split(' ').slice(0, 4).join(' '); // Track more words

        // Store to prevent repetition
        this.recentContent.push({
          type: selectedTemplate.type,
          topic,
          opening,
          timestamp: new Date()
        });

        // Log to database for tracking
        await this.logContentGeneration(finalContent, selectedTemplate.type);

        console.log(`✅ Unique content generated after ${attempts} attempts`);
        console.log(`📊 Final content: "${finalContent.substring(0, 100)}..."`);
        return {
          content: finalContent,
          type: selectedTemplate.type,
          success: true
        };
      }

      // If we get here, all attempts failed
      throw new Error(`Failed to generate unique content after ${maxAttempts} attempts`);

    } catch (error) {
      console.error('❌ Diverse content generation error:', error);
      return {
        content: '',
        type: 'error',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private extractAllKeywords(recentContent: UsedContent[]): string[] {
    const keywords = new Set<string>();
    
    recentContent.forEach(item => {
      // Extract keywords from topic and opening
      const words = (item.topic + ' ' + item.opening).toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3) // Only meaningful words
        .map(word => word.replace(/[^\w]/g, '')); // Clean punctuation
      
      words.forEach(word => keywords.add(word));
    });
    
    return Array.from(keywords);
  }

  private async getRecentDatabaseContent(): Promise<DatabaseContent[]> {
    try {
      // Get recent tweets from the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const { data, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('content, created_at, tweet_type, content_type')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50) || { data: null, error: null };

      if (error) {
        console.warn('⚠️ Could not fetch recent database content:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log('📭 No recent content found in database');
        return [];
      }

      return data.map(item => ({
        content: item.content || '',
        content_hash: this.generateContentHash(item.content || ''),
        created_at: item.created_at || '',
        tweet_type: item.tweet_type || 'unknown'
      }));

    } catch (error) {
      console.warn('⚠️ Database content fetch failed:', error);
      return [];
    }
  }

  private extractDatabaseKeywords(databaseContent: DatabaseContent[]): string[] {
    const keywords = new Set<string>();
    
    databaseContent.forEach(item => {
      // Extract meaningful keywords from database content
      const words = item.content.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4) // Only longer, meaningful words
        .map(word => word.replace(/[^\w]/g, '')) // Clean punctuation
        .filter(word => word.length > 3); // Filter again after cleaning
      
      words.forEach(word => keywords.add(word));
    });
    
    return Array.from(keywords);
  }

  private extractDatabaseTopics(databaseContent: DatabaseContent[]): string[] {
    const topics = new Set<string>();
    
    databaseContent.forEach(item => {
      // Extract topics from content - focus on key phrases
      const content = item.content.toLowerCase();
      
      // Extract specific health topics that commonly appear
      const healthTopics = [
        'sleep', 'nutrition', 'exercise', 'metabolism', 'hormone', 'stress',
        'vitamin', 'mineral', 'supplement', 'diet', 'fasting', 'breathing',
        'recovery', 'muscle', 'fat', 'energy', 'focus', 'brain', 'heart',
        'immune', 'gut', 'microbiome', 'antioxidant', 'inflammation'
      ];
      
      healthTopics.forEach(topic => {
        if (content.includes(topic)) {
          topics.add(topic);
        }
      });
      
      // Extract compound topics (e.g., "organic vegetables", "cold exposure")
      const phrases = content.match(/\b\w+\s+\w+\b/g) || [];
      phrases.forEach(phrase => {
        if (phrase.length > 8) { // Only meaningful phrases
          topics.add(phrase);
        }
      });
    });
    
    return Array.from(topics);
  }

  private async isContentCompletelyUnique(
    content: string, 
    allTopics: string[], 
    allKeywords: string[], 
    databaseContent: DatabaseContent[]
  ): Promise<{ unique: boolean; reason?: string }> {
    const contentLower = content.toLowerCase();
    const contentWords = contentLower.split(/\s+/).map(word => word.replace(/[^\w]/g, ''));
    
    // 1. Check for topic similarity (any recent topic keywords)
    for (const topic of allTopics) {
      if (contentLower.includes(topic)) {
        return { unique: false, reason: `Contains recent topic: "${topic}"` };
      }
    }
    
    // 2. Check for keyword overlap (more than 3 recent keywords)
    const keywordMatches = allKeywords.filter(keyword => 
      contentWords.some(word => word.includes(keyword) || keyword.includes(word))
    );
    
    if (keywordMatches.length > 3) {
      return { unique: false, reason: `Too many keyword matches: ${keywordMatches.slice(0, 3).join(', ')}...` };
    }
    
    // 3. Check for content similarity with database content (fuzzy matching)
    for (const dbContent of databaseContent) {
      const similarity = this.calculateContentSimilarity(content, dbContent.content);
      if (similarity > 0.6) { // 60% similarity threshold
        return { unique: false, reason: `Too similar to previous tweet (${Math.round(similarity * 100)}% match)` };
      }
    }
    
    // 4. Check for specific content patterns that were repeated
    const problematicPatterns = [
      'organic vegetables',
      'selenium-rich soil',
      'depleted soil',
      'analyzing.*cases',
      'antioxidants.*grown',
      'organic farms',
      'caloric restriction.*lifespan',
      'muscle mass.*aging',
      'autophagy.*igf'
    ];
    
    for (const pattern of problematicPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(content)) {
        return { unique: false, reason: `Contains banned pattern: "${pattern}"` };
      }
    }
    
    // 5. Check content hash against database
    const contentHash = this.generateContentHash(content);
    for (const dbContent of databaseContent) {
      if (dbContent.content_hash === contentHash) {
        return { unique: false, reason: 'Identical content hash found in database' };
      }
    }
    
    return { unique: true };
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    // Simple similarity calculation based on shared words
    const words1 = new Set(content1.toLowerCase().split(/\s+/).map(w => w.replace(/[^\w]/g, '')));
    const words2 = new Set(content2.toLowerCase().split(/\s+/).map(w => w.replace(/[^\w]/g, '')));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private generateContentHash(content: string): string {
    // Generate a hash for content comparison
    return crypto.createHash('md5').update(content.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex');
  }

  private buildUniquePrompt(template: ContentTemplate, allTopics: string[], allKeywords: string[], attempt: number): string {
    // Create focused avoid lists for the prompt
    const keyTopicsToAvoid = allTopics.slice(0, 10).join(', ');
    const keyKeywordsToAvoid = allKeywords.slice(0, 15).join(', ');
    
    const basePrompt = `Generate a unique health/wellness tweet using this structure: "${template.structure}"

CRITICAL: This content must be COMPLETELY DIFFERENT from all previous posts.

🚫 FORBIDDEN TOPICS: ${keyTopicsToAvoid}
🚫 FORBIDDEN KEYWORDS: ${keyKeywordsToAvoid}
🚫 BANNED PATTERNS: organic vegetables, soil minerals, selenium, caloric restriction, muscle loss, autophagy, IGF-1

MUST BE UNIQUE:
- Different scientific mechanism/pathway
- Different health domain entirely  
- Different numbers/percentages
- Different biological system
- Different research angle

TOPIC FOR ATTEMPT #${attempt}: ${this.getRandomUnusedTopic(allTopics)}

REQUIREMENTS:
- Include specific data/percentages
- Make it immediately actionable
- Under 280 characters
- Professional but engaging tone
- Zero similarity to previous content

Generate ONE completely unique tweet:`;

    return basePrompt;
  }

  private getRandomUnusedTopic(usedTopics: string[]): string {
    const allPossibleTopics = [
      'sleep optimization', 'exercise timing', 'nutrient absorption', 'stress management',
      'cognitive enhancement', 'metabolic health', 'hydration science', 'breathing techniques',
      'hormonal balance', 'recovery methods', 'longevity research', 'immune system',
      'gut health', 'mental clarity', 'energy levels', 'blood sugar control',
      'circulation improvement', 'memory enhancement', 'fat burning', 'muscle building',
      'bone health', 'skin health', 'eye health', 'liver detox', 'kidney function',
      'thyroid optimization', 'adrenal health', 'neurotransmitter balance',
      'inflammation reduction', 'oxidative stress', 'cellular repair', 'DNA protection',
      'mitochondrial function', 'protein synthesis', 'enzyme activation',
      'micronutrient timing', 'meal frequency', 'fasting windows', 'circadian rhythm',
      'light therapy', 'cold therapy', 'heat therapy', 'sound therapy',
      'posture correction', 'movement patterns', 'flexibility training',
      'balance improvement', 'coordination enhancement', 'reaction time'
    ];
    
    // Filter out used topics
    const availableTopics = allPossibleTopics.filter(topic => 
      !usedTopics.some(used => topic.toLowerCase().includes(used.toLowerCase()) || used.toLowerCase().includes(topic.toLowerCase()))
    );
    
    if (availableTopics.length === 0) {
      return 'advanced health optimization';
    }
    
    return availableTopics[Math.floor(Math.random() * availableTopics.length)];
  }

  private buildPrompt(template: ContentTemplate, recentTopics: string[], recentOpenings: string[]): string {
    const avoidTopics = recentTopics.length > 0 ? `\nAVOID these recent topics: ${recentTopics.join(', ')}` : '';
    const avoidOpenings = recentOpenings.length > 0 ? `\nDON'T start with: ${recentOpenings.join(', ')}` : '';

    return `Generate a ${template.type} health tweet following this structure: ${template.structure}

REQUIREMENTS:
- Under 280 characters
- Specific, actionable information
- Include numbers/percentages when possible
- Avoid generic phrases like "This will change everything"
- Be direct and valuable
- Target health enthusiasts and biohackers

EXAMPLES of this type:
${template.examples.slice(0, 2).join('\n')}

${avoidTopics}${avoidOpenings}

Generate ONE unique ${template.type} tweet:`;
  }

  private extractTopic(content: string): string {
    // Extract main topic from content
    const healthKeywords = [
      'sleep', 'metabolism', 'exercise', 'nutrition', 'supplements', 'fasting',
      'protein', 'vitamins', 'omega', 'magnesium', 'vitamin d', 'creatine',
      'cardio', 'strength', 'recovery', 'stress', 'cortisol', 'insulin',
      'blood sugar', 'fat burning', 'muscle', 'longevity', 'biohacking'
    ];

    const lowerContent = content.toLowerCase();
    for (const keyword of healthKeywords) {
      if (lowerContent.includes(keyword)) {
        return keyword;
      }
    }

    return 'general health';
  }

  private async logContentGeneration(content: string, type: string): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      await supabaseClient.supabase
        .from('content_generation_log')
        .insert({
          content_type: type,
          content_preview: content.substring(0, 100),
          generated_at: new Date().toISOString()
        });

    } catch (error) {
      // Fail silently - logging shouldn't break content generation
      console.warn('⚠️ Content logging failed:', error);
    }
  }

  async getContentVariety(): Promise<{ 
    recentTypes: string[]; 
    recentTopics: string[]; 
    varietyScore: number;
  }> {
    const recentTypes = [...new Set(this.recentContent.map(item => item.type))];
    const recentTopics = [...new Set(this.recentContent.map(item => item.topic))];
    
    // Calculate variety score (higher = more diverse)
    const typeVariety = recentTypes.length / Math.max(this.recentContent.length, 1);
    const topicVariety = recentTopics.length / Math.max(this.recentContent.length, 1);
    const varietyScore = (typeVariety + topicVariety) / 2;

    return {
      recentTypes,
      recentTopics,
      varietyScore
    };
  }
} 