import { supabaseClient } from './supabaseClient';

interface CachedContent {
  id: string;
  content_type: string;
  content: string;
  keywords: string[];
  usage_count: number;
  last_used: string;
  created_at: string;
  quality_score: number;
  engagement_score?: number;
}

interface ContentTemplate {
  template: string;
  placeholders: string[];
  category: string;
}

export class ContentCache {
  private cache: Map<string, CachedContent> = new Map();
  private templates: ContentTemplate[] = [];
  private maxCacheSize = 500;
  private maxUsageCount = 3; // Prevent overuse of same content

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // High-performing tweet templates to reduce API calls
    this.templates = [
      {
        template: "🚨 BREAKTHROUGH: {discovery}\n\n{analysis}\n\nThis could change {field} forever.\n\nSource: {source}",
        placeholders: ['discovery', 'analysis', 'field', 'source'],
        category: 'breakthrough'
      },
      {
        template: "📊 NEW STUDY: {finding}\n\n{implication}\n\nPublished: {source}",
        placeholders: ['finding', 'implication', 'source'],
        category: 'research'
      },
      {
        template: "🔥 GAME CHANGER: {innovation}\n\n{impact}\n\nvia {source}",
        placeholders: ['innovation', 'impact', 'source'],
        category: 'innovation'
      },
      {
        template: "💡 INSIGHT: {fact}\n\n{analysis}\n\n{hashtags}",
        placeholders: ['fact', 'analysis', 'hashtags'],
        category: 'insight'
      },
      {
        template: "🚀 FUTURE ALERT: {prediction}\n\n{reasoning}\n\nThoughts? 🤔",
        placeholders: ['prediction', 'reasoning'],
        category: 'prediction'
      }
    ];
  }

  async getCachedContent(
    contentType: string, 
    keywords: string[] = [], 
    minQualityScore: number = 0.7
  ): Promise<CachedContent | null> {
    const cacheKey = this.generateCacheKey(contentType, keywords);
    
    // Check memory cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (cached.usage_count < this.maxUsageCount && cached.quality_score >= minQualityScore) {
        return cached;
      }
    }

    // Check database cache
    try {
      const { data, error } = await supabaseClient.supabase
        ?.from('content_cache')
        .select('*')
        .eq('content_type', contentType)
        .gte('quality_score', minQualityScore)
        .lt('usage_count', this.maxUsageCount)
        .order('quality_score', { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        this.cache.set(cacheKey, data);
        return data;
      }
    } catch (error) {
      console.log('📦 Cache miss for:', contentType);
    }

    return null;
  }

  async generateFromTemplate(
    category: string, 
    placeholders: Record<string, string>
  ): Promise<string | null> {
    const template = this.templates.find(t => t.category === category);
    if (!template) return null;

    let content = template.template;
    for (const [key, value] of Object.entries(placeholders)) {
      content = content.replace(new RegExp(`{${key}}`, 'g'), value);
    }

    // Check if all placeholders were filled
    if (content.includes('{') && content.includes('}')) {
      return null; // Some placeholders not filled
    }

    console.log(`🎨 Generated from template: ${category}`);
    return content;
  }

  async cacheContent(
    content: string,
    contentType: string,
    keywords: string[] = [],
    qualityScore: number = 0.8
  ): Promise<void> {
    const id = this.generateContentId(content);
    
    const cachedItem: CachedContent = {
      id,
      content_type: contentType,
      content,
      keywords,
      usage_count: 0,
      last_used: new Date().toISOString(),
      created_at: new Date().toISOString(),
      quality_score: qualityScore
    };

    // Store in memory cache
    this.cache.set(id, cachedItem);

    // Store in database
    try {
      await supabaseClient.supabase
        ?.from('content_cache')
        .upsert(cachedItem);
      
      console.log(`💾 Cached content: ${contentType}`);
    } catch (error) {
      console.warn('Cache storage failed:', error);
    }

    // Cleanup if cache is too large
    if (this.cache.size > this.maxCacheSize) {
      this.cleanupCache();
    }
  }

  async markContentUsed(contentId: string, engagementScore?: number): Promise<void> {
    const cached = this.cache.get(contentId);
    if (cached) {
      cached.usage_count++;
      cached.last_used = new Date().toISOString();
      if (engagementScore) {
        cached.engagement_score = engagementScore;
      }

      // Update in database
      try {
        await supabaseClient.supabase
          ?.from('content_cache')
          .update({
            usage_count: cached.usage_count,
            last_used: cached.last_used,
            engagement_score: cached.engagement_score
          })
          .eq('id', contentId);
      } catch (error) {
        console.warn('Failed to update content usage:', error);
      }
    }
  }

  private generateCacheKey(contentType: string, keywords: string[]): string {
    return `${contentType}_${keywords.sort().join('_')}`;
  }

  private generateContentId(content: string): string {
    // Simple hash function for content ID
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `content_${Math.abs(hash)}`;
  }

  private cleanupCache(): void {
    // Remove least recently used items
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => new Date(a[1].last_used).getTime() - new Date(b[1].last_used).getTime());
    
    const toRemove = entries.slice(0, 100); // Remove oldest 100 items
    toRemove.forEach(([key]) => this.cache.delete(key));
    
    console.log(`🧹 Cleaned up ${toRemove.length} cached items`);
  }

  getCacheStats(): {
    memorySize: number;
    hitRate: number;
    totalTemplates: number;
  } {
    return {
      memorySize: this.cache.size,
      hitRate: 0.85, // Placeholder - would need actual tracking
      totalTemplates: this.templates.length
    };
  }

  // Emergency fallback content for when APIs are down
  getEmergencyContent(contentType: string): string {
    const emergency = {
      breaking_news: "🚨 Health tech industry continues rapid innovation. New developments emerging daily. What breakthrough are you most excited about? #HealthTech #Innovation",
      research_update: "📊 Latest research shows promising advances in digital health solutions. The future of healthcare is being written now. #Research #DigitalHealth",
      tech_development: "🚀 Technology is revolutionizing healthcare delivery. From AI diagnostics to telemedicine, innovation is everywhere. #TechInHealth",
      insight: "💡 The intersection of technology and healthcare creates unprecedented opportunities for improving human health. #HealthInnovation",
      prediction: "🔮 Prediction: The next decade will see healthcare become more personalized, accessible, and effective through technology. Agree? #FutureOfHealth"
    };

    return emergency[contentType as keyof typeof emergency] || emergency.insight;
  }
}

export const contentCache = new ContentCache(); 