/**
 * 🔍 COMPETITIVE ANALYSIS JOB
 * 
 * Scrapes top health accounts and learns from their best-performing content
 * Runs daily to discover patterns that drive viral growth
 */

import { competitiveAnalysisService } from '../intelligence/competitiveAnalysisService';

export async function competitiveAnalysisJob(): Promise<void> {
  console.log('[COMPETITIVE_JOB] 🔍 Starting competitive analysis...');
  
  try {
    // 1. Scrape top posts from competitor accounts
    console.log('[COMPETITIVE_JOB] 📥 Scraping top health accounts...');
    await competitiveAnalysisService.scrapeCompetitorBestPosts();
    
    // 2. Analyze patterns from scraped data
    console.log('[COMPETITIVE_JOB] 🧠 Analyzing competitive patterns...');
    await competitiveAnalysisService.analyzeCompetitorPatterns();
    
    // 3. Log insights
    const insights = await competitiveAnalysisService.getTopPerformingPatterns(5);
    
    if (insights.length > 0) {
      console.log('[COMPETITIVE_JOB] 📊 Top performing patterns discovered:');
      insights.forEach((insight, i) => {
        console.log(
          `  ${i + 1}. ${insight.pattern}: ${Math.round(insight.effectiveness_score)} avg score ` +
          `(${insight.sample_size} samples, ${(insight.confidence * 100).toFixed(0)}% confidence)`
        );
      });
    }
    
    console.log('[COMPETITIVE_JOB] ✅ Competitive analysis completed');
    
  } catch (error: any) {
    console.error('[COMPETITIVE_JOB] ❌ Competitive analysis failed:', error.message);
  }
}

