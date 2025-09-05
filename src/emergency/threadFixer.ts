/**
 * 🚨 EMERGENCY THREAD FIXER
 * 
 * This module fixes the thread posting issue by ensuring threads are completed properly
 */

import { SimpleThreadPoster } from '../posting/simpleThreadPoster';
import { ViralContentOrchestrator } from '../ai/viralContentOrchestrator';

export class EmergencyThreadFixer {
  private static instance: EmergencyThreadFixer;
  private threadPoster: SimpleThreadPoster;
  private viralOrchestrator: ViralContentOrchestrator;

  private constructor() {
    this.threadPoster = SimpleThreadPoster.getInstance();
    this.viralOrchestrator = new ViralContentOrchestrator(process.env.OPENAI_API_KEY!);
  }

  public static getInstance(): EmergencyThreadFixer {
    if (!EmergencyThreadFixer.instance) {
      EmergencyThreadFixer.instance = new EmergencyThreadFixer();
    }
    return EmergencyThreadFixer.instance;
  }

  /**
   * 🧵 FORCE COMPLETE THREAD POSTING
   * This method ensures threads are posted as complete threads, not just single tweets
   */
  async forceCompleteThread(): Promise<{
    success: boolean;
    rootTweetId?: string;
    replyIds?: string[];
    totalTweets?: number;
    error?: string;
  }> {
    
    console.log('🚨 EMERGENCY_THREAD_FIXER: Forcing complete thread posting...');

    try {
      // Step 1: Generate thread content with explicit thread format
      console.log('🤖 Generating thread content with explicit thread requirements...');
      
      const threadContent = await this.viralOrchestrator.generateViralContent('thread');
      
      console.log('📊 Thread generation result:');
      console.log(`   - Content: ${threadContent.content?.substring(0, 100)}...`);
      console.log(`   - Thread parts: ${threadContent.threadParts?.length || 0}`);
      console.log(`   - Viral score: ${threadContent.metadata.viralScore}`);

      // Step 2: Ensure we have proper thread parts
      if (!threadContent.threadParts || threadContent.threadParts.length < 2) {
        console.error('❌ THREAD_GENERATION_FAILED: No thread parts generated');
        
        // Emergency fallback: Create thread from content
        if (threadContent.content) {
          const emergencyThread = this.createEmergencyThreadFromContent(threadContent.content);
          console.log(`🔄 EMERGENCY_THREAD_CREATED: ${emergencyThread.length} parts from content`);
          
          const result = await this.threadPoster.postRealThread(emergencyThread);
          return {
            success: result.success,
            rootTweetId: result.rootTweetId,
            replyIds: result.replyIds,
            totalTweets: result.totalTweets,
            error: result.error
          };
        }
        
        return {
          success: false,
          error: 'Failed to generate thread content'
        };
      }

      // Step 3: Validate thread parts
      console.log('✅ THREAD_VALIDATION: Checking thread parts...');
      
      const validatedParts = threadContent.threadParts.map((part, index) => {
        // Clean and validate each part
        let cleanPart = part.trim();
        
        // Remove any numbering if present
        cleanPart = cleanPart.replace(/^\d+[\/\.)]\s*/, '');
        
        // Ensure first tweet has thread indicator
        if (index === 0 && !cleanPart.includes('🧵') && !cleanPart.includes('thread')) {
          cleanPart += ' 🧵';
        }
        
        // Ensure within Twitter limits
        if (cleanPart.length > 280) {
          cleanPart = cleanPart.substring(0, 277) + '...';
        }
        
        return cleanPart;
      });

      console.log(`📝 VALIDATED_THREAD: ${validatedParts.length} parts ready for posting`);
      validatedParts.forEach((part, i) => {
        console.log(`   ${i+1}. ${part.substring(0, 80)}...`);
      });

      // Step 4: Force thread posting
      console.log('🚀 FORCING_THREAD_POST: Using SimpleThreadPoster...');
      
      const result = await this.threadPoster.postRealThread(validatedParts);
      
      if (result.success) {
        console.log('✅ EMERGENCY_THREAD_SUCCESS!');
        console.log(`🔗 Root Tweet: ${result.rootTweetId}`);
        console.log(`📱 Replies: ${result.replyIds?.join(', ') || 'None'}`);
        console.log(`📊 Total: ${result.totalTweets} tweets posted`);
      } else {
        console.error(`❌ EMERGENCY_THREAD_FAILED: ${result.error}`);
      }

      return {
        success: result.success,
        rootTweetId: result.rootTweetId,
        replyIds: result.replyIds,
        totalTweets: result.totalTweets,
        error: result.error
      };

    } catch (error: any) {
      console.error('💥 EMERGENCY_THREAD_CRASHED:', error.message);
      return {
        success: false,
        error: `Emergency thread fixer crashed: ${error.message}`
      };
    }
  }

  /**
   * 🔄 Create emergency thread from single content
   */
  private createEmergencyThreadFromContent(content: string): string[] {
    console.log('🔄 CREATING_EMERGENCY_THREAD from content...');
    
    // Split content into logical thread parts
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    if (sentences.length < 2) {
      // If can't split meaningfully, create a simple thread
      return [
        content + ' 🧵',
        'This is cutting-edge health information most people never learn.',
        'Follow for more evidence-based health insights that actually work.'
      ];
    }
    
    // Group sentences into tweets (max 280 chars each)
    const threadParts: string[] = [];
    let currentTweet = '';
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim() + '.';
      
      if (currentTweet.length + sentence.length < 250) {
        currentTweet += (currentTweet ? ' ' : '') + sentence;
      } else {
        if (currentTweet) {
          threadParts.push(currentTweet);
        }
        currentTweet = sentence;
      }
    }
    
    if (currentTweet) {
      threadParts.push(currentTweet);
    }
    
    // Add thread indicator to first tweet
    if (threadParts.length > 0 && !threadParts[0].includes('🧵')) {
      threadParts[0] += ' 🧵';
    }
    
    // Add thread numbering
    return threadParts.map((part, index) => {
      if (index === 0) return part;
      return `${index + 1}/ ${part}`;
    });
  }

  /**
   * 🩺 DIAGNOSTIC: Check system health
   */
  async runDiagnostic(): Promise<void> {
    console.log('🩺 EMERGENCY_THREAD_DIAGNOSTIC...');
    
    try {
      // Test viral content generation
      console.log('🤖 Testing AI content generation...');
      const testContent = await this.viralOrchestrator.generateViralContent('thread');
      console.log(`✅ AI Generation: ${testContent.threadParts?.length || 0} thread parts`);
      
      // Test thread poster
      console.log('🧵 Testing thread poster...');
      const posterMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.threadPoster));
      console.log(`✅ Thread Poster: ${posterMethods.includes('postRealThread') ? 'Ready' : 'Missing postRealThread'}`);
      
    } catch (error: any) {
      console.error('💥 DIAGNOSTIC_FAILED:', error.message);
    }
  }
}
