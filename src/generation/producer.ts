import { ThreadSchema, SYSTEM_PROMPT, validateThreadSchema } from './systemPrompt';
import { EvaluationScores, EVALUATOR_PROMPT, validateEvaluationScores } from './evaluator';
import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

export interface ContentCandidate {
  id: string;
  thread: ThreadSchema;
  scores: EvaluationScores;
  created_at: Date;
}

export class ContentProducer {
  private static instance: ContentProducer;
  private db: AdvancedDatabaseManager;

  private constructor() {
    this.db = AdvancedDatabaseManager.getInstance();
  }

  public static getInstance(): ContentProducer {
    if (!ContentProducer.instance) {
      ContentProducer.instance = new ContentProducer();
    }
    return ContentProducer.instance;
  }

  /**
   * Generate 12+ candidates, evaluate, keep top 3, store in database
   */
  public async generateCandidates(topic?: string): Promise<ContentCandidate[]> {
    console.log('GEN: Starting candidate generation...');
    
    const candidates: ContentCandidate[] = [];
    const numCandidates = 12;
    
    // Generate multiple candidates in parallel
    const generationPromises = Array(numCandidates).fill(0).map(() => 
      this.generateSingleCandidate(topic)
    );
    
    const results = await Promise.allSettled(generationPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        candidates.push(result.value);
      }
    }
    
    console.log(`GEN: produced ${candidates.length} candidates`);
    
    if (candidates.length === 0) {
      throw new Error('Failed to generate any valid candidates');
    }
    
    // Sort by overall score and take top 3
    candidates.sort((a, b) => b.scores.overall - a.scores.overall);
    const topCandidates = candidates.slice(0, 3);
    
    console.log(`EVAL: ranked top3 [${topCandidates.map(c => c.id.substring(0, 8)).join(', ')}]`);
    
    // Store all candidates in database
    await this.storeCandidates(candidates, topCandidates.map(c => c.id));
    
    return topCandidates;
  }

  private async generateSingleCandidate(topic?: string): Promise<ContentCandidate | null> {
    try {
      // Get OpenAI client (assuming it exists from previous implementation)
      const { IntelligentContentGenerator } = await import('../agents/intelligentContentGenerator');
      const contentGen = IntelligentContentGenerator.getInstance();
      
      // Generate thread content
      const prompt = topic ? 
        `${SYSTEM_PROMPT}\n\nTopic focus: ${topic}` : 
        SYSTEM_PROMPT;
      
      const response = await (contentGen as any).openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 1000
      });
      
      const content = response.choices[0].message.content?.trim();
      if (!content) throw new Error('Empty response from OpenAI');
      
      const threadData = JSON.parse(content);
      const thread = validateThreadSchema(threadData);
      
      // Evaluate the thread
      const evalResponse = await (contentGen as any).openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: EVALUATOR_PROMPT },
          { role: 'user', content: JSON.stringify(thread) }
        ],
        temperature: 0.3,
        max_tokens: 500
      });
      
      const evalContent = evalResponse.choices[0].message.content?.trim();
      if (!evalContent) throw new Error('Empty evaluation response');
      
      const evalData = JSON.parse(evalContent);
      const scores = validateEvaluationScores(evalData);
      
      return {
        id: crypto.randomUUID(),
        thread,
        scores,
        created_at: new Date()
      };
      
    } catch (error: any) {
      console.warn('Failed to generate candidate:', error.message);
      return null;
    }
  }

  private async storeCandidates(allCandidates: ContentCandidate[], chosenIds: string[]): Promise<void> {
    await this.db.executeQuery('store_candidates', async (client) => {
      for (const candidate of allCandidates) {
        const { error } = await client
          .from('content_candidates')
          .insert({
            id: candidate.id,
            topic: candidate.thread.topic,
            tweets_json: candidate.thread,
            evaluator_scores_json: candidate.scores,
            chosen: chosenIds.includes(candidate.id),
            created_at: candidate.created_at.toISOString()
          });
        
        if (error) {
          console.warn('Failed to store candidate:', error.message);
        }
      }
      
      return { success: true };
    });
  }

  /**
   * Get the best candidate for posting
   */
  public async getBestCandidate(): Promise<ContentCandidate | null> {
    const candidates = await this.generateCandidates();
    return candidates.length > 0 ? candidates[0] : null;
  }
}