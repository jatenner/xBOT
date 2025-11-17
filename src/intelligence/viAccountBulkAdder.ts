/**
 * 🔧 VISUAL INTELLIGENCE: Bulk Account Adder
 * 
 * Analyzes and adds multiple accounts to vi_scrape_targets
 * - Uses AI to analyze account bios and categorize
 * - Auto-tiers based on follower count
 * - Groups by generator type
 * - Inserts into database with proper categorization
 * 
 * Usage:
 *   const adder = new VIAccountBulkAdder();
 *   await adder.addAccounts([
 *     { username: 'account1', followers: 50000 },
 *     { username: 'account2', followers: 5000 },
 *     // ... 100 more
 *   ]);
 */

import { getSupabaseClient } from '../db/index';
import { log } from '../lib/logger';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import type { GeneratorType } from './generatorMatcher';

interface AccountInput {
  username: string;
  followers?: number; // Optional - will scrape if not provided
  bio?: string; // Optional - will scrape if not provided
}

interface AnalyzedAccount {
  username: string;
  followers_count: number;
  tier: 'viral_unknown' | 'micro' | 'growth' | 'established';
  tier_weight: number;
  discovery_method: string;
  is_active: boolean;
  // ✅ NEW: Generator categorization
  primary_generators?: GeneratorType[]; // Top 3 generators this account matches
  niche?: string; // e.g., 'sleep', 'nutrition', 'longevity'
  content_style?: string; // e.g., 'research_heavy', 'practical', 'provocative'
}

export class VIAccountBulkAdder {
  private supabase = getSupabaseClient();
  
  /**
   * Main entry point: Analyze and add accounts
   */
  async addAccounts(accounts: AccountInput[]): Promise<{
    added: number;
    skipped: number;
    errors: number;
    byTier: Record<string, number>;
    byGenerator: Record<string, number>;
  }> {
    log({ op: 'vi_bulk_add_start', count: accounts.length });
    
    const results = {
      added: 0,
      skipped: 0,
      errors: 0,
      byTier: {} as Record<string, number>,
      byGenerator: {} as Record<string, number>
    };
    
    // Process in batches of 20 to avoid overwhelming OpenAI
    const BATCH_SIZE = 20;
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      const batch = accounts.slice(i, i + BATCH_SIZE);
      log({ op: 'vi_bulk_add_batch', batch: i / BATCH_SIZE + 1, total: Math.ceil(accounts.length / BATCH_SIZE) });
      
      for (const account of batch) {
        try {
          const analyzed = await this.analyzeAccount(account);
          
          if (!analyzed) {
            results.skipped++;
            continue;
          }
          
          // Check if already exists
          const { data: existing } = await this.supabase
            .from('vi_scrape_targets')
            .select('username')
            .eq('username', analyzed.username)
            .single();
          
          if (existing) {
            log({ op: 'vi_bulk_add_exists', username: analyzed.username });
            results.skipped++;
            continue;
          }
          
          // Insert into database
          const { error } = await this.supabase
            .from('vi_scrape_targets')
            .insert({
              username: analyzed.username,
              tier: analyzed.tier,
              tier_weight: analyzed.tier_weight,
              followers_count: analyzed.followers_count,
              discovery_method: analyzed.discovery_method,
              is_active: analyzed.is_active,
              // ✅ Store generator categorization in inclusion_reason (JSON string)
              inclusion_reason: JSON.stringify({
                primary_generators: analyzed.primary_generators || [],
                niche: analyzed.niche,
                content_style: analyzed.content_style
              })
            });
          
          if (error) {
            log({ op: 'vi_bulk_add_error', username: analyzed.username, error: error.message });
            results.errors++;
            continue;
          }
          
          results.added++;
          results.byTier[analyzed.tier] = (results.byTier[analyzed.tier] || 0) + 1;
          
          // Count by generator
          (analyzed.primary_generators || []).forEach(gen => {
            results.byGenerator[gen] = (results.byGenerator[gen] || 0) + 1;
          });
          
          log({ op: 'vi_bulk_add_success', username: analyzed.username, tier: analyzed.tier });
          
          // Small delay between inserts
          await this.sleep(100);
          
        } catch (error: any) {
          log({ op: 'vi_bulk_add_error', username: account.username, error: error.message });
          results.errors++;
        }
      }
      
      // Delay between batches
      await this.sleep(2000);
    }
    
    log({ 
      op: 'vi_bulk_add_complete', 
      added: results.added,
      skipped: results.skipped,
      errors: results.errors,
      byTier: results.byTier,
      byGenerator: results.byGenerator
    });
    
    return results;
  }
  
  /**
   * Analyze a single account using AI
   */
  private async analyzeAccount(account: AccountInput): Promise<AnalyzedAccount | null> {
    // Get follower count and bio if not provided
    let followers = account.followers || 0;
    let bio = account.bio || '';
    
    // If missing, try to get from database or scrape (for now, use provided or default)
    if (!followers) {
      // Could scrape here, but for bulk add, assume user provides
      followers = 0;
    }
    
    // Auto-tier based on follower count
    const { tier, tier_weight } = this.calculateTier(followers);
    
    // Use AI to analyze account and match to generators
    const aiAnalysis = await this.analyzeWithAI(account.username, bio, followers);
    
    return {
      username: account.username,
      followers_count: followers,
      tier,
      tier_weight,
      discovery_method: 'manual_bulk_add',
      is_active: true,
      primary_generators: aiAnalysis.generators,
      niche: aiAnalysis.niche,
      content_style: aiAnalysis.content_style
    };
  }
  
  /**
   * Use AI to analyze account and match to generators
   */
  private async analyzeWithAI(
    username: string,
    bio: string,
    followers: number
  ): Promise<{
    generators: GeneratorType[];
    niche: string;
    content_style: string;
  }> {
    const prompt = `Analyze this Twitter account and categorize it:

Username: ${username}
Bio: ${bio || 'Not provided'}
Followers: ${followers.toLocaleString()}

Categorize this account:

1. PRIMARY GENERATORS (top 3 that would match this account's style):
   Options: contrarian, culturalBridge, dataNerd, storyteller, coach, explorer, thoughtLeader, mythBuster, newsReporter, philosopher, provocateur, interestingContent, dynamicContent, popCultureAnalyst, teacher, investigator, connector, pragmatist, historian, translator, patternFinder, experimenter
   
   Match based on:
   - newsReporter: Breaking news, "NEW STUDY:", journal-style
   - historian: Historical context, evolution over time
   - storyteller: Narratives, case studies, personal stories
   - dataNerd: Heavy data, statistics, research citations
   - mythBuster: Debunks misconceptions
   - contrarian: Challenges mainstream, questions systems
   - coach: How-to, protocols, step-by-step
   - provocateur: Bold questions, controversial
   - philosopher: Deep meaning, wisdom
   - teacher: Educational, explains step-by-step
   - investigator: Deep research synthesis
   - connector: Systems thinking, interconnections
   - pragmatist: Practical, realistic, 80/20
   - translator: Simple language, explains complex science
   - patternFinder: Identifies patterns across research
   - experimenter: Self-experimentation
   - culturalBridge: Books, influencers, cultural connections
   - thoughtLeader: Big picture, future insights
   - explorer: Novel ideas, experimental
   - interestingContent: Surprising, counterintuitive
   - popCultureAnalyst: Trends, viral, pop culture
   - dynamicContent: Versatile, adaptive

2. NICHE (main focus):
   Options: sleep, exercise, supplements, nutrition, longevity, mental_health, biohacking, peptides, hormones, gut_health, research, policy, women_health, men_health, neuroscience, other

3. CONTENT STYLE:
   Options: research_heavy, practical, provocative, educational, narrative, data_driven, controversial, inspirational, other

Return ONLY valid JSON:
{
  "generators": ["generator1", "generator2", "generator3"],
  "niche": "string",
  "content_style": "string"
}`;
    
    try {
      const completion = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      }, {
        purpose: 'vi_account_analysis'
      });
      
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return { generators: ['dynamicContent'], niche: 'other', content_style: 'other' };
      }
      
      const result = JSON.parse(content);
      return {
        generators: (result.generators || ['dynamicContent']).slice(0, 3) as GeneratorType[],
        niche: result.niche || 'other',
        content_style: result.content_style || 'other'
      };
    } catch (error: any) {
      log({ op: 'vi_ai_analysis_error', username, error: error.message });
      return { generators: ['dynamicContent'], niche: 'other', content_style: 'other' };
    }
  }
  
  /**
   * Calculate tier based on follower count
   */
  private calculateTier(followers: number): {
    tier: 'viral_unknown' | 'micro' | 'growth' | 'established';
    tier_weight: number;
  } {
    if (followers < 1000) {
      return { tier: 'viral_unknown', tier_weight: 3.0 };
    } else if (followers < 10000) {
      return { tier: 'micro', tier_weight: 2.0 };
    } else if (followers < 100000) {
      return { tier: 'growth', tier_weight: 1.0 };
    } else {
      return { tier: 'established', tier_weight: 0.5 };
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Export function for easy use
 */
export async function bulkAddVIAccounts(accounts: AccountInput[]): Promise<void> {
  const adder = new VIAccountBulkAdder();
  const results = await adder.addAccounts(accounts);
  
  console.log('\n✅ BULK ADD COMPLETE:');
  console.log(`   Added: ${results.added}`);
  console.log(`   Skipped: ${results.skipped}`);
  console.log(`   Errors: ${results.errors}`);
  console.log('\n📊 BY TIER:');
  Object.entries(results.byTier).forEach(([tier, count]) => {
    console.log(`   ${tier}: ${count}`);
  });
  console.log('\n🎭 BY GENERATOR:');
  Object.entries(results.byGenerator)
    .sort((a, b) => b[1] - a[1])
    .forEach(([gen, count]) => {
      console.log(`   ${gen}: ${count}`);
    });
}

