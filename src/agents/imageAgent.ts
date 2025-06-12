import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { openaiClient } from '../utils/openaiClient';
import dotenv from 'dotenv';

dotenv.config();

export interface ImageResult {
  success: boolean;
  imageUrl?: string;
  localPath?: string;
  altText?: string;
  error?: string;
}

export interface ImageRequest {
  contentType: 'breaking_news' | 'research_update' | 'tech_development' | 'industry_insight' | 'fact_spotlight';
  content: string;
  source: string;
  keywords?: string[];
}

export class ImageAgent {
  private readonly imageDirectory = './assets/images';
  private readonly stockImageSources = [
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&w=800', // Medical technology
    'https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&w=800', // AI/Brain
    'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&w=800', // Digital health
    'https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&w=800', // Research/Lab
    'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?ixlib=rb-4.0.3&w=800', // Healthcare tech
    'https://images.unsplash.com/photo-1582719471384-894fbb16e074?ixlib=rb-4.0.3&w=800', // Wearable tech
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?ixlib=rb-4.0.3&w=800', // Medical AI
    'https://images.unsplash.com/photo-1559757141-c15d5ac13c77?ixlib=rb-4.0.3&w=800'  // Digital medicine
  ];

  private readonly categoryImageMap = {
    breaking_news: [
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&w=800', // Medical breaking news
      'https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&w=800'  // AI news
    ],
    research_update: [
      'https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&w=800', // Lab research
      'https://images.unsplash.com/photo-1582719471384-894fbb16e074?ixlib=rb-4.0.3&w=800'  // Medical research
    ],
    tech_development: [
      'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?ixlib=rb-4.0.3&w=800', // Healthcare tech
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?ixlib=rb-4.0.3&w=800'  // Medical AI
    ],
    industry_insight: [
      'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&w=800', // Digital health analytics
      'https://images.unsplash.com/photo-1559757141-c15d5ac13c77?ixlib=rb-4.0.3&w=800'  // Industry insights
    ],
    fact_spotlight: [
      'https://images.unsplash.com/photo-1582719471384-894fbb16e074?ixlib=rb-4.0.3&w=800', // Wearable facts
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&w=800'  // Health facts
    ]
  };

  constructor() {
    this.ensureImageDirectory();
  }

  async getImageForContent(request: ImageRequest): Promise<ImageResult> {
    try {
      console.log(`🖼️ ImageAgent: Selecting image for ${request.contentType} content...`);

      // Strategy 1: Try AI-generated image (if OpenAI DALL-E available)
      if (process.env.OPENAI_API_KEY && this.shouldUseAIGenerated(request)) {
        const aiImage = await this.generateAIImage(request);
        if (aiImage.success) {
          return aiImage;
        }
      }

      // Strategy 2: Use curated stock images
      const stockImage = await this.getCuratedStockImage(request);
      if (stockImage.success) {
        return stockImage;
      }

      // Strategy 3: Fallback to category-based image
      return await this.getCategoryImage(request);

    } catch (error) {
      console.error('Error getting image for content:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Image generation failed'
      };
    }
  }

  private shouldUseAIGenerated(request: ImageRequest): boolean {
    // Use AI for breaking news and high-priority content
    const aiPriorityTypes = ['breaking_news', 'research_update'];
    return aiPriorityTypes.includes(request.contentType);
  }

  private async generateAIImage(request: ImageRequest): Promise<ImageResult> {
    try {
      // Generate descriptive prompt for DALL-E
      const imagePrompt = await this.generateImagePrompt(request);
      
      console.log(`🎨 Generating AI image with prompt: "${imagePrompt}"`);

      // Note: This would use OpenAI DALL-E API in real implementation
      // For now, return a placeholder response
      return {
        success: false,
        error: 'AI image generation not implemented (would use DALL-E API)'
      };

      /*
      // Real DALL-E implementation would look like:
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
      });

      const imageUrl = response.data[0].url;
      const localPath = await this.downloadImage(imageUrl, `ai_${Date.now()}.png`);
      
      return {
        success: true,
        imageUrl: imageUrl,
        localPath: localPath,
        altText: this.generateAltText(request)
      };
      */

    } catch (error) {
      console.error('Error generating AI image:', error);
      return {
        success: false,
        error: 'AI image generation failed'
      };
    }
  }

  private async generateImagePrompt(request: ImageRequest): Promise<string> {
    const basePrompts = {
      breaking_news: 'Professional medical technology news illustration, modern healthcare setting, clean and authoritative style',
      research_update: 'Scientific research laboratory, medical data visualization, professional academic style',
      tech_development: 'Cutting-edge health technology, futuristic medical devices, innovation concept',
      industry_insight: 'Healthcare analytics dashboard, digital health trends, professional business style',
      fact_spotlight: 'Medical infographic style, health education visual, clear and informative'
    };

    let prompt = basePrompts[request.contentType];
    
    // Add specific keywords if available
    if (request.keywords && request.keywords.length > 0) {
      prompt += `, featuring ${request.keywords.slice(0, 2).join(' and ')}`;
    }

    prompt += ', high quality, professional photography style, no text overlays';

    return prompt;
  }

  private async getCuratedStockImage(request: ImageRequest): Promise<ImageResult> {
    try {
      const categoryImages = this.categoryImageMap[request.contentType];
      
      if (!categoryImages || categoryImages.length === 0) {
        return { success: false, error: 'No curated images for category' };
      }

      // Select image based on content keywords
      const selectedImageUrl = this.selectBestImage(categoryImages, request);
      
      // Check if we already have this image cached
      const imageFileName = this.getImageFileName(selectedImageUrl);
      const localPath = path.join(this.imageDirectory, imageFileName);

      if (fs.existsSync(localPath)) {
        console.log(`✅ Using cached image: ${imageFileName}`);
        return {
          success: true,
          imageUrl: selectedImageUrl,
          localPath: localPath,
          altText: this.generateAltText(request)
        };
      }

      // Download and cache the image
      const downloadedPath = await this.downloadImage(selectedImageUrl, imageFileName);
      
      if (downloadedPath) {
        return {
          success: true,
          imageUrl: selectedImageUrl,
          localPath: downloadedPath,
          altText: this.generateAltText(request)
        };
      }

      return { success: false, error: 'Failed to download image' };

    } catch (error) {
      console.error('Error getting curated stock image:', error);
      return {
        success: false,
        error: 'Curated image selection failed'
      };
    }
  }

  private async getCategoryImage(request: ImageRequest): Promise<ImageResult> {
    // Fallback to first available image in category
    const fallbackImages = this.categoryImageMap[request.contentType];
    
    if (!fallbackImages || fallbackImages.length === 0) {
      return {
        success: false,
        error: 'No fallback images available'
      };
    }

    const imageUrl = fallbackImages[0];
    const fileName = this.getImageFileName(imageUrl);
    const localPath = await this.downloadImage(imageUrl, fileName);

    if (localPath) {
      return {
        success: true,
        imageUrl: imageUrl,
        localPath: localPath,
        altText: this.generateAltText(request)
      };
    }

    return {
      success: false,
      error: 'Failed to get category fallback image'
    };
  }

  private selectBestImage(images: string[], request: ImageRequest): string {
    // Simple selection - could be enhanced with ML-based selection
    const content = request.content.toLowerCase();
    
    // Basic keyword matching for image selection
    if (content.includes('ai') || content.includes('artificial intelligence')) {
      return images.find(img => img.includes('49000212a370')) || images[0]; // AI brain image
    }
    
    if (content.includes('research') || content.includes('study')) {
      return images.find(img => img.includes('551601651')) || images[0]; // Lab research image
    }
    
    if (content.includes('wearable') || content.includes('watch')) {
      return images.find(img => img.includes('582719471384')) || images[0]; // Wearable tech image
    }

    // Default to first image
    return images[0];
  }

  private async downloadImage(url: string, fileName: string): Promise<string | null> {
    try {
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 10000,
        headers: {
          'User-Agent': 'Snap2Health-Bot/1.0'
        }
      });

      const localPath = path.join(this.imageDirectory, fileName);
      const writer = fs.createWriteStream(localPath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(localPath));
        writer.on('error', reject);
      });

    } catch (error) {
      console.error(`Failed to download image from ${url}:`, error);
      return null;
    }
  }

  private generateAltText(request: ImageRequest): string {
    const altTextMap = {
      breaking_news: `Breaking news illustration related to ${request.source} health technology announcement`,
      research_update: `Medical research visualization depicting ${request.content.substring(0, 50)}...`,
      tech_development: `Healthcare technology development image showing innovation in medical devices`,
      industry_insight: `Digital health industry analytics and trends visualization`,
      fact_spotlight: `Health technology fact illustration highlighting key medical data`
    };

    return altTextMap[request.contentType] || 'Health technology related image';
  }

  private getImageFileName(url: string): string {
    const urlParts = url.split('/');
    const photoId = urlParts.find(part => part.includes('photo-')) || 'unknown';
    return `health_tech_${photoId.split('?')[0]}.jpg`;
  }

  private ensureImageDirectory(): void {
    if (!fs.existsSync(this.imageDirectory)) {
      fs.mkdirSync(this.imageDirectory, { recursive: true });
      console.log(`📁 Created image directory: ${this.imageDirectory}`);
    }
  }

  // Test method
  async testImageGeneration(): Promise<void> {
    console.log('🧪 Testing image generation...');

    const testRequests: ImageRequest[] = [
      {
        contentType: 'breaking_news',
        content: 'FDA approves first AI system for autonomous diagnosis',
        source: 'FDA.gov',
        keywords: ['AI', 'FDA', 'diagnosis']
      },
      {
        contentType: 'research_update',
        content: 'Smartwatches predict COVID-19 symptoms with 78% accuracy',
        source: 'Nature Medicine',
        keywords: ['wearable', 'prediction', 'COVID']
      },
      {
        contentType: 'tech_development',
        content: 'Healthcare AI startups raise $2.1B in funding',
        source: 'TechCrunch',
        keywords: ['funding', 'startups', 'AI']
      }
    ];

    for (const request of testRequests) {
      console.log(`\n🖼️ Testing ${request.contentType}:`);
      const result = await this.getImageForContent(request);
      
      if (result.success) {
        console.log(`✅ Image selected: ${result.localPath}`);
        console.log(`Alt text: ${result.altText}`);
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
    }
  }

  // Get engagement-optimized image based on performance data
  async getOptimizedImage(request: ImageRequest, performanceData?: any): Promise<ImageResult> {
    // This would analyze which types of images get better engagement
    // and select accordingly - enhancement for future versions
    return await this.getImageForContent(request);
  }
}

// Allow running as standalone script
if (require.main === module) {
  const agent = new ImageAgent();
  agent.testImageGeneration();
} 