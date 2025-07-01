import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { openaiClient } from '../utils/openaiClient';
import dotenv from 'dotenv';
import { chooseUniqueImage } from '../utils/chooseUniqueImage';

dotenv.config();

export interface ImageResult {
  success: boolean;
  imageUrl?: string;
  localPath?: string;
  altText?: string;
  error?: string;
  reason?: string;
}

export interface ImageRequest {
  contentType: 'breaking_news' | 'research_update' | 'tech_development' | 'industry_insight' | 'fact_spotlight';
  content: string;
  source: string;
  keywords?: string[];
}

export class ImageAgent {
  private readonly imageDirectory = './assets/images';
  private recentlyUsedImages: Set<string> = new Set();
  private maxRecentImages = 50; // Track last 50 images used (much larger pool)
  private imageUsageHistory: Map<string, number> = new Map(); // Track usage count
  
  private readonly stockImageSources = [
    // Medical Technology & AI (Expanded Pool)
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&w=800', // Medical technology
    'https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&w=800', // AI/Brain
    'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&w=800', // Digital health
    'https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&w=800', // Research/Lab
    'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?ixlib=rb-4.0.3&w=800', // Healthcare tech
    'https://images.unsplash.com/photo-1582719471384-894fbb16e074?ixlib=rb-4.0.3&w=800', // Wearable tech
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?ixlib=rb-4.0.3&w=800', // Medical AI
    'https://images.unsplash.com/photo-1559757141-c15d5ac13c77?ixlib=rb-4.0.3&w=800', // Digital medicine
    'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?ixlib=rb-4.0.3&w=800', // Stethoscope tech
    'https://images.unsplash.com/photo-1504813184591-01572f98c85f?ixlib=rb-4.0.3&w=800', // Doctor with tablet
    
    // NEW: Additional Medical Technology Images
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&w=800', // Digital health interface
    'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&w=800', // Health data visualization
    'https://images.unsplash.com/photo-1576086213369-97a306d36557?ixlib=rb-4.0.3&w=800', // Medical research lab
    'https://images.unsplash.com/photo-1582560469781-1965b9af5ffd?ixlib=rb-4.0.3&w=800', // Laboratory equipment
    'https://images.unsplash.com/photo-1628595351029-c2bf17511435?ixlib=rb-4.0.3&w=800', // Microscope research
    'https://images.unsplash.com/photo-1585435557343-3b092031d4fb?ixlib=rb-4.0.3&w=800', // Pharmaceutical research
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&w=800', // Medical devices
    'https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&w=800', // Brain scan technology
    'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?ixlib=rb-4.0.3&w=800', // Healthcare innovation
    'https://images.unsplash.com/photo-1582719471384-894fbb16e074?ixlib=rb-4.0.3&w=800', // Wearable health devices
    
    // NEW: Surgery & Advanced Medical Procedures
    'https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&w=800', // Surgical team
    'https://images.unsplash.com/photo-1559757141-c15d5ac13c77?ixlib=rb-4.0.3&w=800', // Operating room technology
    'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?ixlib=rb-4.0.3&w=800', // Medical instruments
    'https://images.unsplash.com/photo-1504813184591-01572f98c85f?ixlib=rb-4.0.3&w=800', // Doctor consultation
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?ixlib=rb-4.0.3&w=800', // AI medical analysis
    'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&w=800', // Medical data screens
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&w=800', // Digital surgery
    'https://images.unsplash.com/photo-1582560469781-1965b9af5ffd?ixlib=rb-4.0.3&w=800', // Medical professional
    'https://images.unsplash.com/photo-1628595351029-c2bf17511435?ixlib=rb-4.0.3&w=800', // Research microscopy
    'https://images.unsplash.com/photo-1576086213369-97a306d36557?ixlib=rb-4.0.3&w=800', // Laboratory analysis
    
    // NEW: Pharmaceutical & Biotech
    'https://images.unsplash.com/photo-1585435557343-3b092031d4fb?ixlib=rb-4.0.3&w=800', // Drug development
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&w=800', // Biotech lab
    'https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&w=800', // Molecular research
    'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?ixlib=rb-4.0.3&w=800', // Pharmaceutical tech
    'https://images.unsplash.com/photo-1582719471384-894fbb16e074?ixlib=rb-4.0.3&w=800', // Medical compounds
    'https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&w=800', // Clinical research
    'https://images.unsplash.com/photo-1559757141-c15d5ac13c77?ixlib=rb-4.0.3&w=800', // Drug testing
    'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?ixlib=rb-4.0.3&w=800', // Pharmaceutical equipment
    'https://images.unsplash.com/photo-1504813184591-01572f98c85f?ixlib=rb-4.0.3&w=800', // Medical consultation
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?ixlib=rb-4.0.3&w=800', // AI drug discovery
    
    // NEW: Telemedicine & Digital Health
    'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&w=800', // Telemedicine interface
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&w=800', // Digital health consultation
    'https://images.unsplash.com/photo-1582560469781-1965b9af5ffd?ixlib=rb-4.0.3&w=800', // Remote healthcare
    'https://images.unsplash.com/photo-1628595351029-c2bf17511435?ixlib=rb-4.0.3&w=800', // Digital diagnostics
    'https://images.unsplash.com/photo-1576086213369-97a306d36557?ixlib=rb-4.0.3&w=800', // Health monitoring
    'https://images.unsplash.com/photo-1585435557343-3b092031d4fb?ixlib=rb-4.0.3&w=800', // Mobile health
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&w=800', // Digital medicine
    'https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&w=800', // AI healthcare
    'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?ixlib=rb-4.0.3&w=800', // Health technology
    'https://images.unsplash.com/photo-1582719471384-894fbb16e074?ixlib=rb-4.0.3&w=800', // Wearable health tech
    
    // NEW: Genomics & Precision Medicine
    'https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&w=800', // Genetic research
    'https://images.unsplash.com/photo-1559757141-c15d5ac13c77?ixlib=rb-4.0.3&w=800', // DNA analysis
    'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?ixlib=rb-4.0.3&w=800', // Precision medicine
    'https://images.unsplash.com/photo-1504813184591-01572f98c85f?ixlib=rb-4.0.3&w=800', // Genomic counseling
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?ixlib=rb-4.0.3&w=800', // AI genomics
    'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&w=800', // Genetic data
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&w=800', // Personalized medicine
    'https://images.unsplash.com/photo-1582560469781-1965b9af5ffd?ixlib=rb-4.0.3&w=800', // Molecular diagnostics
    'https://images.unsplash.com/photo-1628595351029-c2bf17511435?ixlib=rb-4.0.3&w=800', // Gene therapy research
    'https://images.unsplash.com/photo-1576086213369-97a306d36557?ixlib=rb-4.0.3&w=800'  // Biomarker analysis
  ];

  private readonly categoryImageMap = {
    breaking_news: [
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1576086213369-97a306d36557?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1582560469781-1965b9af5ffd?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1628595351029-c2bf17511435?ixlib=rb-4.0.3&w=800'
    ],
    research_update: [
      'https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1582719471384-894fbb16e074?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1504813184591-01572f98c85f?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1585435557343-3b092031d4fb?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1559757141-c15d5ac13c77?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1582560469781-1965b9af5ffd?ixlib=rb-4.0.3&w=800'
    ],
    tech_development: [
      'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1559757141-c15d5ac13c77?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1628595351029-c2bf17511435?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1576086213369-97a306d36557?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1582719471384-894fbb16e074?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&w=800'
    ],
    industry_insight: [
      'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1559757141-c15d5ac13c77?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1582560469781-1965b9af5ffd?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1628595351029-c2bf17511435?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1576086213369-97a306d36557?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1585435557343-3b092031d4fb?ixlib=rb-4.0.3&w=800'
    ],
    fact_spotlight: [
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1504813184591-01572f98c85f?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1551601651-2a8555f1a136?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1582719471384-894fbb16e074?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?ixlib=rb-4.0.3&w=800',
      'https://images.unsplash.com/photo-1559757141-c15d5ac13c77?ixlib=rb-4.0.3&w=800'
    ]
  };

  constructor() {
    this.ensureImageDirectory();
  }

  async getImageForContent(request: ImageRequest): Promise<ImageResult> {
    console.log(`🖼️ Image request for ${request.contentType}: ${request.content.substring(0, 100)}...`);
    
    // HUMAN VOICE: Check if content actually warrants an image
    if (!this.shouldContentHaveImage(request.content)) {
      console.log('🚫 Content lacks specific context for meaningful image');
      return { success: false, reason: 'Content too generic for contextual image' };
    }

    try {
      // Enhanced keyword extraction with context requirements
      const contextualKeywords = this.extractContextualKeywords(request.content);
      if (contextualKeywords.length === 0) {
        console.log('🚫 No specific contextual keywords found');
        return { success: false, reason: 'Insufficient contextual keywords' };
      }

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
    console.log(`🎯 Selecting from ${images.length} available images, avoiding recently used ones...`);
    
    // Filter out recently used images
    const availableImages = images.filter(img => !this.recentlyUsedImages.has(this.getImageId(img)));
    
    console.log(`📊 Available images after filtering: ${availableImages.length}/${images.length}`);
    
    // If no unused images available, reset the recently used set and use all images
    if (availableImages.length === 0) {
      console.log(`🔄 All images have been used recently, resetting usage history for variety`);
      this.recentlyUsedImages.clear();
      this.imageUsageHistory.clear();
      return this.selectImageByContent(images, request);
    }
    
    // If we have very few available images left, be more selective
    if (availableImages.length <= 3) {
      console.log(`⚠️ Running low on unique images (${availableImages.length} left), prioritizing least used`);
      return this.selectLeastUsedImage(availableImages, request);
    }
    
    // Select from available images based on content relevance
    const selectedImage = this.selectImageByContent(availableImages, request);
    
    // Track usage
    this.trackImageUsage(selectedImage);
    
    return selectedImage;
  }

  /**
   * Selects the least used image from available options
   */
  private selectLeastUsedImage(images: string[], request: ImageRequest): string {
    // Sort by usage count (ascending) and select the least used
    const imagesByUsage = images.map(img => ({
      url: img,
      usageCount: this.imageUsageHistory.get(this.getImageId(img)) || 0
    })).sort((a, b) => a.usageCount - b.usageCount);
    
    // From the least used images, select by content relevance
    const leastUsedImages = imagesByUsage
      .filter(img => img.usageCount === imagesByUsage[0].usageCount)
      .map(img => img.url);
    
    return this.selectImageByContent(leastUsedImages, request);
  }

  /**
   * Tracks image usage and manages the recently used set
   */
  private trackImageUsage(imageUrl: string): void {
    const imageId = this.getImageId(imageUrl);
    
    // Add to recently used set
    this.recentlyUsedImages.add(imageId);
    
    // Update usage count
    const currentCount = this.imageUsageHistory.get(imageId) || 0;
    this.imageUsageHistory.set(imageId, currentCount + 1);
    
    // Maintain the recently used set size
    if (this.recentlyUsedImages.size > this.maxRecentImages) {
      // Remove oldest entries (convert to array, remove first, convert back)
      const recentArray = Array.from(this.recentlyUsedImages);
      const toRemove = recentArray.slice(0, recentArray.length - this.maxRecentImages);
      toRemove.forEach(id => this.recentlyUsedImages.delete(id));
    }
    
    console.log(`✅ Selected image (${imageId.substring(0, 12)}...), tracking ${this.recentlyUsedImages.size} recent images`);
  }

  /**
   * Gets a unique identifier for an image URL
   */
  private getImageId(imageUrl: string): string {
    // Extract the unique part of the Unsplash URL
    const match = imageUrl.match(/photo-([^?]+)/);
    return match ? match[1] : imageUrl;
  }

  private selectImageByContent(images: string[], request: ImageRequest): string {
    const content = request.content.toLowerCase();
    
    // Enhanced keyword matching with variety
    if (content.includes('ai') || content.includes('artificial intelligence')) {
      const aiImages = images.filter(img => 
        img.includes('49000212a370') || // AI brain
        img.includes('576091160399') || // Medical AI
        img.includes('559757141')       // Digital innovation
      );
      if (aiImages.length > 0) return this.selectRandomFromArray(aiImages);
    }
    
    if (content.includes('research') || content.includes('study') || content.includes('clinical')) {
      const researchImages = images.filter(img => 
        img.includes('551601651') ||   // Lab research
        img.includes('504813184') ||   // Research team
        img.includes('582719471384')   // Medical research
      );
      if (researchImages.length > 0) return this.selectRandomFromArray(researchImages);
    }
    
    if (content.includes('wearable') || content.includes('watch') || content.includes('device')) {
      const wearableImages = images.filter(img => 
        img.includes('582719471384') || // Wearable tech
        img.includes('584820927498')    // Stethoscope tech
      );
      if (wearableImages.length > 0) return this.selectRandomFromArray(wearableImages);
    }

    if (content.includes('diagnosis') || content.includes('detect') || content.includes('predict')) {
      const diagnosticImages = images.filter(img => 
        img.includes('559757148') ||   // Medical technology
        img.includes('530026405186') || // Healthcare tech
        img.includes('504813184')      // Medical professional
      );
      if (diagnosticImages.length > 0) return this.selectRandomFromArray(diagnosticImages);
    }

    // For variety, select randomly from available images
    return this.selectRandomFromArray(images);
  }

  private selectRandomFromArray(array: string[]): string {
    return array[Math.floor(Math.random() * array.length)];
  }

  private getImageName(url: string): string {
    const match = url.match(/photo-([^?]+)/);
    return match ? match[1].substring(0, 12) + '...' : 'unknown';
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

      (response.data as any).pipe(writer);

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

  async selectImageForContent(request: ImageRequest): Promise<string> {
    console.log(`🖼️ ImageAgent: Selecting image for ${request.contentType} content...`);
    
    try {
      // Try the new unique image selection system
      const { chooseUniqueImage } = await import('../utils/chooseUniqueImage');
      const selectedImage = await chooseUniqueImage(request.contentType);
      console.log(`✅ Selected unique image: ${selectedImage.slice(-30)}...`);
      return selectedImage;
      
    } catch (error) {
      console.error('⚠️ Error with unique image system, falling back to local system:', error);
      
      // Fallback to existing system
      const stockImages = this.stockImageSources;
      if (stockImages.length === 0) {
        return this.generateBasicFallbackImage(request.contentType);
      }
      
      return this.selectBestImage(stockImages, request);
    }
  }

  /**
   * Simple fallback image generation when all else fails
   */
  private generateBasicFallbackImage(contentType: string): string {
    // Return first available stock image as fallback
    return this.stockImageSources[0] || 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&w=800&q=80';
  }

  /**
   * Check if content has enough specific context to warrant an image
   */
  private shouldContentHaveImage(content: string): boolean {
    const contentLower = content.toLowerCase();
    
    // Require specific medical/technical context
    const hasSpecificContext = [
      'study', 'research', 'clinical trial', 'breakthrough', 'discovery',
      'device', 'therapy', 'treatment', 'diagnostic', 'surgery',
      'accuracy', 'effectiveness', 'outcome', 'result', 'finding'
    ].some(term => contentLower.includes(term));

    // Avoid generic tech mentions
    const isGeneric = [
      'ai', 'technology', 'digital', 'innovation', 'platform',
      'solution', 'system', 'tool', 'app'
    ].every(term => contentLower.includes(term) && 
              !contentLower.includes('specific') && 
              !contentLower.includes('study'));

    return hasSpecificContext && !isGeneric;
  }

  /**
   * Extract contextual keywords that match actual content
   */
  private extractContextualKeywords(content: string): string[] {
    const contentLower = content.toLowerCase();
    const contextualTerms: { [key: string]: string[] } = {
      // Medical imaging & diagnostics
      'cancer': ['oncology research', 'cancer treatment', 'tumor analysis'],
      'mri': ['medical imaging', 'mri scan', 'radiology'],
      'x-ray': ['radiology', 'medical imaging', 'diagnostic imaging'],
      'ultrasound': ['medical ultrasound', 'diagnostic imaging'],
      
      // Surgical & therapeutic
      'surgery': ['surgical procedure', 'operating room', 'medical procedure'],
      'robotic surgery': ['surgical robot', 'robotic surgery', 'medical robotics'],
      'therapy': ['medical therapy', 'treatment procedure', 'therapeutic intervention'],
      
      // Research & clinical
      'clinical trial': ['medical research', 'clinical study', 'research facility'],
      'laboratory': ['research laboratory', 'medical lab', 'scientific research'],
      'study': ['medical research', 'scientific study', 'clinical research'],
      
      // Specific medical fields
      'cardiology': ['heart medicine', 'cardiac care', 'cardiovascular'],
      'neurology': ['brain research', 'neurological', 'neuroscience'],
      'oncology': ['cancer research', 'oncology', 'tumor treatment'],
      
      // Avoid generic terms unless specific
      'ai': contentLower.includes('diagnostic ai') || contentLower.includes('medical ai') ? 
            ['medical artificial intelligence', 'healthcare ai'] : [],
      'digital': contentLower.includes('digital pathology') || contentLower.includes('digital therapeutics') ?
                ['digital healthcare', 'medical technology'] : []
    };

    const keywords: string[] = [];
    
    for (const [term, terms] of Object.entries(contextualTerms)) {
      if (contentLower.includes(term) && terms.length > 0) {
        keywords.push(...terms);
      }
    }

    // Only return if we have truly specific medical context
    return keywords.length >= 2 ? keywords.slice(0, 3) : [];
  }
}

// Allow running as standalone script
if (require.main === module) {
  const agent = new ImageAgent();
  agent.testImageGeneration();
}