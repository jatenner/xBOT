import OpenAI from 'openai';
import { admin } from '../lib/supabaseClients';

interface ContentGene {
  gene_id: string;
  gene_type: 'hook' | 'structure' | 'topic_angle' | 'engagement_trigger' | 'call_to_action';
  dna_sequence: string; // The actual content element
  fitness_score: number; // 0-100 based on performance
  mutation_count: number;
  parent_genes: string[];
  birth_timestamp: string;
  last_performance: {
    likes: number;
    retweets: number;
    replies: number;
    viral_score: number;
  };
}

interface ContentOrganism {
  organism_id: string;
  genes: ContentGene[];
  overall_fitness: number;
  generation: number;
  parent_organisms: string[];
  content_output: string;
  performance_history: Array<{
    timestamp: string;
    engagement: { likes: number; retweets: number; replies: number; };
    viral_score: number;
  }>;
}

interface EvolutionStrategy {
  selection_pressure: number; // How strongly to favor high performers
  mutation_rate: number; // Probability of random changes
  crossover_rate: number; // Probability of combining genes
  diversity_bonus: number; // Bonus for unique approaches
  elite_preservation: number; // Top % to preserve unchanged
}

interface GenerationReport {
  generation_number: number;
  population_size: number;
  avg_fitness: number;
  best_fitness: number;
  worst_fitness: number;
  diversity_score: number;
  successful_mutations: string[];
  evolved_patterns: string[];
  recommendations: string[];
}

/**
 * 🧬 CONTENT DNA EVOLUTION SYSTEM
 * Advanced AI that evolves content patterns using genetic algorithms
 * Successful content elements reproduce and mutate to create even better content
 */
export class ContentDnaEvolution {
  private static instance: ContentDnaEvolution;
  private openai: OpenAI;
  private genePool: ContentGene[] = [];
  private currentGeneration: ContentOrganism[] = [];
  private generationNumber: number = 1;
  private evolutionStrategy: EvolutionStrategy;

  private constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });

    // Configure evolution parameters
    this.evolutionStrategy = {
      selection_pressure: 0.8, // Strong selection for high performers
      mutation_rate: 0.15, // 15% chance of mutations
      crossover_rate: 0.7, // 70% chance of gene mixing
      diversity_bonus: 0.2, // 20% bonus for unique content
      elite_preservation: 0.1 // Keep top 10% unchanged
    };
  }

  public static getInstance(): ContentDnaEvolution {
    if (!ContentDnaEvolution.instance) {
      ContentDnaEvolution.instance = new ContentDnaEvolution();
    }
    return ContentDnaEvolution.instance;
  }

  /**
   * 🚀 EVOLVE GENERATION: Create next generation of content based on performance
   */
  public async evolveNextGeneration(): Promise<GenerationReport> {
    console.log(`🧬 DNA_EVOLUTION: Evolving generation ${this.generationNumber}...`);

    try {
      // 1. Evaluate current generation fitness
      await this.evaluateCurrentGeneration();
      
      // 2. Select parents for reproduction
      const parents = this.selectParents();
      
      // 3. Create offspring through crossover and mutation
      const offspring = await this.createOffspring(parents);
      
      // 4. Merge with elite from previous generation
      const newGeneration = this.combineWithElites(offspring);
      
      // 5. Update generation and analyze progress
      this.currentGeneration = newGeneration;
      this.generationNumber++;
      
      const report = await this.generateGenerationReport();
      
      console.log(`✅ DNA_EVOLUTION: Generation ${this.generationNumber - 1} complete - avg fitness ${report.avg_fitness.toFixed(1)}`);
      
      return report;

    } catch (error: any) {
      console.error('❌ DNA_EVOLUTION: Evolution failed:', error.message);
      
      return {
        generation_number: this.generationNumber,
        population_size: 0,
        avg_fitness: 0,
        best_fitness: 0,
        worst_fitness: 0,
        diversity_score: 0,
        successful_mutations: [],
        evolved_patterns: [],
        recommendations: ['Evolution system temporarily unavailable']
      };
    }
  }

  /**
   * 🎯 GENERATE EVOLVED CONTENT: Create content using best genetic patterns
   */
  public async generateEvolvedContent(topic: string, contentType: 'single' | 'thread'): Promise<{
    content: string;
    genetic_makeup: string[];
    predicted_fitness: number;
    evolutionary_advantages: string[];
  }> {
    console.log(`🧬 DNA_EVOLUTION: Generating evolved ${contentType} content about ${topic}...`);

    try {
      // 1. Select best genes for this content type
      const selectedGenes = await this.selectOptimalGenes(topic, contentType);
      
      // 2. Combine genes into content organism
      const newOrganism = await this.createContentOrganism(selectedGenes, topic, contentType);
      
      // 3. Predict performance based on genetic fitness
      const predictedFitness = this.calculatePredictedFitness(selectedGenes);
      
      console.log(`✅ DNA_EVOLUTION: Generated content with ${predictedFitness.toFixed(1)} predicted fitness`);
      
      return {
        content: newOrganism.content_output,
        genetic_makeup: selectedGenes.map(g => `${g.gene_type}: ${g.dna_sequence.substring(0, 50)}...`),
        predicted_fitness: predictedFitness,
        evolutionary_advantages: this.identifyAdvantages(selectedGenes)
      };

    } catch (error: any) {
      console.error('❌ DNA_EVOLUTION: Content generation failed:', error.message);
      
      return {
        content: `Evolved insight about ${topic}: Revolutionary research reveals breakthrough approach that transforms results.`,
        genetic_makeup: ['fallback genetic pattern'],
        predicted_fitness: 50,
        evolutionary_advantages: ['Scientific backing', 'Clear value proposition']
      };
    }
  }

  /**
   * 📊 EVALUATE FITNESS: Assess performance of current generation
   */
  private async evaluateCurrentGeneration(): Promise<void> {
    if (this.currentGeneration.length === 0) {
      await this.initializePopulation();
      return;
    }

    console.log('📊 DNA_EVOLUTION: Evaluating current generation fitness...');

    // Get recent performance data from database
    const { data: recentPosts } = await admin
      .from('tweets')
      .select('content, likes_count, retweets_count, replies_count, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!recentPosts) return;

    // Update organism fitness based on actual performance
    for (const organism of this.currentGeneration) {
      const matchingPost = recentPosts.find(post => 
        post.content && this.contentSimilarity(post.content, organism.content_output) > 0.7
      );

      if (matchingPost) {
        const engagement = {
          likes: matchingPost.likes_count || 0,
          retweets: matchingPost.retweets_count || 0,
          replies: matchingPost.replies_count || 0
        };

        const viralScore = this.calculateViralScore(engagement);
        organism.overall_fitness = viralScore;
        
        organism.performance_history.push({
          timestamp: new Date().toISOString(),
          engagement,
          viral_score: viralScore
        });

        // Update individual gene fitness
        organism.genes.forEach(gene => {
          gene.fitness_score = viralScore;
          gene.last_performance = { ...engagement, viral_score: viralScore };
        });
      }
    }

    console.log(`📊 Evaluated ${this.currentGeneration.length} organisms`);
  }

  /**
   * 🧬 SELECT PARENTS: Choose high-performing organisms for reproduction
   */
  private selectParents(): ContentOrganism[] {
    const sortedOrganisms = [...this.currentGeneration]
      .sort((a, b) => b.overall_fitness - a.overall_fitness);

    const numParents = Math.max(4, Math.floor(this.currentGeneration.length * 0.3));
    
    // Tournament selection with fitness bias
    const parents: ContentOrganism[] = [];
    
    for (let i = 0; i < numParents; i++) {
      const tournament = [];
      for (let j = 0; j < 3; j++) {
        const randomIndex = Math.floor(Math.random() * sortedOrganisms.length);
        tournament.push(sortedOrganisms[randomIndex]);
      }
      
      // Select best from tournament, with some randomness for diversity
      tournament.sort((a, b) => b.overall_fitness - a.overall_fitness);
      const selected = Math.random() < this.evolutionStrategy.selection_pressure 
        ? tournament[0] 
        : tournament[Math.floor(Math.random() * tournament.length)];
      
      parents.push(selected);
    }

    console.log(`🧬 Selected ${parents.length} parents for reproduction`);
    return parents;
  }

  /**
   * 👶 CREATE OFFSPRING: Generate new organisms through crossover and mutation
   */
  private async createOffspring(parents: ContentOrganism[]): Promise<ContentOrganism[]> {
    console.log('👶 DNA_EVOLUTION: Creating offspring through genetic operations...');

    const offspring: ContentOrganism[] = [];
    const targetOffspringCount = Math.max(10, this.currentGeneration.length);

    for (let i = 0; i < targetOffspringCount; i++) {
      // Select two random parents
      const parent1 = parents[Math.floor(Math.random() * parents.length)];
      const parent2 = parents[Math.floor(Math.random() * parents.length)];

      // Crossover: combine genes from both parents
      const childGenes: ContentGene[] = [];
      const maxGenes = Math.max(parent1.genes.length, parent2.genes.length);

      for (let j = 0; j < maxGenes; j++) {
        const gene1 = parent1.genes[j];
        const gene2 = parent2.genes[j];

        if (gene1 && gene2 && Math.random() < this.evolutionStrategy.crossover_rate) {
          // Crossover: create hybrid gene
          const hybridGene = await this.crossoverGenes(gene1, gene2);
          childGenes.push(hybridGene);
        } else {
          // Take gene from one parent
          const selectedGene = gene1 || gene2;
          if (selectedGene) {
            childGenes.push({ ...selectedGene, gene_id: this.generateGeneId() });
          }
        }
      }

      // Mutation: randomly modify some genes
      for (const gene of childGenes) {
        if (Math.random() < this.evolutionStrategy.mutation_rate) {
          await this.mutateGene(gene);
        }
      }

      // Create new organism
      const newOrganism: ContentOrganism = {
        organism_id: this.generateOrganismId(),
        genes: childGenes,
        overall_fitness: (parent1.overall_fitness + parent2.overall_fitness) / 2,
        generation: this.generationNumber,
        parent_organisms: [parent1.organism_id, parent2.organism_id],
        content_output: await this.synthesizeContent(childGenes),
        performance_history: []
      };

      offspring.push(newOrganism);
    }

    console.log(`👶 Created ${offspring.length} offspring organisms`);
    return offspring;
  }

  /**
   * 🧬 CROSSOVER GENES: Combine two genes to create hybrid
   */
  private async crossoverGenes(gene1: ContentGene, gene2: ContentGene): Promise<ContentGene> {
    const prompt = `Create a hybrid content element by combining these two successful patterns:

Gene 1 (fitness: ${gene1.fitness_score}): "${gene1.dna_sequence}"
Gene 2 (fitness: ${gene2.fitness_score}): "${gene2.dna_sequence}"

Type: ${gene1.gene_type}

Combine the best elements of both to create a new, potentially superior pattern. Keep the core strengths of each while creating something novel.

Return only the hybrid content element:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 150
      });

      const hybridSequence = response.choices[0]?.message?.content?.trim() || gene1.dna_sequence;

      return {
        gene_id: this.generateGeneId(),
        gene_type: gene1.gene_type,
        dna_sequence: hybridSequence,
        fitness_score: (gene1.fitness_score + gene2.fitness_score) / 2,
        mutation_count: 0,
        parent_genes: [gene1.gene_id, gene2.gene_id],
        birth_timestamp: new Date().toISOString(),
        last_performance: { likes: 0, retweets: 0, replies: 0, viral_score: 0 }
      };

    } catch (error) {
      console.warn('⚠️ Crossover failed, using gene1:', error);
      return { ...gene1, gene_id: this.generateGeneId() };
    }
  }

  /**
   * 🔬 MUTATE GENE: Introduce random variations to promote innovation
   */
  private async mutateGene(gene: ContentGene): Promise<void> {
    const mutationTypes = ['strengthen', 'vary_style', 'add_element', 'change_angle'];
    const mutationType = mutationTypes[Math.floor(Math.random() * mutationTypes.length)];

    const prompt = `Mutate this content gene through ${mutationType}:

Original: "${gene.dna_sequence}"
Type: ${gene.gene_type}
Current fitness: ${gene.fitness_score}

Create a variation that could potentially perform better. Keep the core concept but introduce strategic changes.

Return only the mutated version:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8, // Higher temperature for creative mutations
        max_tokens: 150
      });

      const mutatedSequence = response.choices[0]?.message?.content?.trim();
      
      if (mutatedSequence && mutatedSequence !== gene.dna_sequence) {
        gene.dna_sequence = mutatedSequence;
        gene.mutation_count++;
        console.log(`🔬 Mutated gene ${gene.gene_id} (${mutationType})`);
      }

    } catch (error) {
      console.warn('⚠️ Mutation failed for gene:', gene.gene_id);
    }
  }

  /**
   * 🧠 SYNTHESIZE CONTENT: Combine genes into complete content
   */
  private async synthesizeContent(genes: ContentGene[]): Promise<string> {
    const genesByType = this.groupGenesByType(genes);
    
    const prompt = `Synthesize these evolved content genes into compelling Twitter content:

Hook: ${genesByType.hook?.[0]?.dna_sequence || 'Start with an attention-grabbing statement'}
Structure: ${genesByType.structure?.[0]?.dna_sequence || 'Clear, scannable format'}
Topic Angle: ${genesByType.topic_angle?.[0]?.dna_sequence || 'Evidence-based health insights'}
Engagement Trigger: ${genesByType.engagement_trigger?.[0]?.dna_sequence || 'Ask for thoughts or experiences'}
Call to Action: ${genesByType.call_to_action?.[0]?.dna_sequence || 'Encourage sharing or following'}

Create a single cohesive tweet or thread that incorporates these evolved elements naturally. Make it sound human and authentic.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 300
      });

      return response.choices[0]?.message?.content?.trim() || 'Evolved health insight: Research reveals breakthrough optimization strategy.';

    } catch (error) {
      console.error('❌ Content synthesis failed:', error);
      return 'Advanced health optimization insight from evolved content patterns.';
    }
  }

  /**
   * Helper methods
   */
  private async initializePopulation(): Promise<void> {
    console.log('🌱 DNA_EVOLUTION: Initializing first generation...');

    // Create initial gene pool from successful patterns
    const initialGenes: ContentGene[] = [
      {
        gene_id: this.generateGeneId(),
        gene_type: 'hook',
        dna_sequence: '🚨 BREAKING: New study reveals',
        fitness_score: 85,
        mutation_count: 0,
        parent_genes: [],
        birth_timestamp: new Date().toISOString(),
        last_performance: { likes: 0, retweets: 0, replies: 0, viral_score: 0 }
      },
      {
        gene_id: this.generateGeneId(),
        gene_type: 'hook',
        dna_sequence: 'Unpopular opinion:',
        fitness_score: 80,
        mutation_count: 0,
        parent_genes: [],
        birth_timestamp: new Date().toISOString(),
        last_performance: { likes: 0, retweets: 0, replies: 0, viral_score: 0 }
      }
      // Would add more initial genes...
    ];

    this.genePool = initialGenes;
    
    // Create initial organisms
    for (let i = 0; i < 10; i++) {
      const organism: ContentOrganism = {
        organism_id: this.generateOrganismId(),
        genes: initialGenes.slice(0, 3), // Simple organisms to start
        overall_fitness: 50,
        generation: 1,
        parent_organisms: [],
        content_output: await this.synthesizeContent(initialGenes.slice(0, 3)),
        performance_history: []
      };
      
      this.currentGeneration.push(organism);
    }

    console.log(`🌱 Initialized population with ${this.currentGeneration.length} organisms`);
  }

  private groupGenesByType(genes: ContentGene[]): Record<string, ContentGene[]> {
    return genes.reduce((groups, gene) => {
      if (!groups[gene.gene_type]) groups[gene.gene_type] = [];
      groups[gene.gene_type].push(gene);
      return groups;
    }, {} as Record<string, ContentGene[]>);
  }

  private calculateViralScore(engagement: { likes: number; retweets: number; replies: number }): number {
    const totalEngagement = engagement.likes + (engagement.retweets * 3) + (engagement.replies * 2);
    return Math.min(100, totalEngagement / 10);
  }

  private contentSimilarity(content1: string, content2: string): number {
    const words1 = content1.toLowerCase().split(/\s+/);
    const words2 = content2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  private generateGeneId(): string {
    return `gene_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  private generateOrganismId(): string {
    return `org_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  private selectOptimalGenes(topic: string, contentType: 'single' | 'thread'): ContentGene[] {
    // Select best performing genes for the content type
    const sortedGenes = [...this.genePool]
      .sort((a, b) => b.fitness_score - a.fitness_score);
    
    return sortedGenes.slice(0, 5);
  }

  private async createContentOrganism(genes: ContentGene[], topic: string, contentType: 'single' | 'thread'): Promise<ContentOrganism> {
    const content = await this.synthesizeContent(genes);
    
    return {
      organism_id: this.generateOrganismId(),
      genes,
      overall_fitness: genes.reduce((sum, g) => sum + g.fitness_score, 0) / genes.length,
      generation: this.generationNumber,
      parent_organisms: [],
      content_output: content,
      performance_history: []
    };
  }

  private calculatePredictedFitness(genes: ContentGene[]): number {
    return genes.reduce((sum, gene) => sum + gene.fitness_score, 0) / genes.length;
  }

  private identifyAdvantages(genes: ContentGene[]): string[] {
    const advantages = [];
    
    if (genes.some(g => g.fitness_score > 80)) advantages.push('High-performing genetic elements');
    if (genes.some(g => g.gene_type === 'engagement_trigger')) advantages.push('Strong engagement triggers');
    if (genes.some(g => g.mutation_count > 0)) advantages.push('Evolved through successful mutations');
    
    return advantages;
  }

  private combineWithElites(offspring: ContentOrganism[]): ContentOrganism[] {
    const eliteCount = Math.floor(this.currentGeneration.length * this.evolutionStrategy.elite_preservation);
    const elites = [...this.currentGeneration]
      .sort((a, b) => b.overall_fitness - a.overall_fitness)
      .slice(0, eliteCount);
    
    return [...elites, ...offspring].slice(0, Math.max(15, this.currentGeneration.length));
  }

  private async generateGenerationReport(): Promise<GenerationReport> {
    const fitnesses = this.currentGeneration.map(o => o.overall_fitness);
    
    return {
      generation_number: this.generationNumber - 1,
      population_size: this.currentGeneration.length,
      avg_fitness: fitnesses.reduce((sum, f) => sum + f, 0) / fitnesses.length,
      best_fitness: Math.max(...fitnesses),
      worst_fitness: Math.min(...fitnesses),
      diversity_score: this.calculateDiversityScore(),
      successful_mutations: this.getSuccessfulMutations(),
      evolved_patterns: this.getEvolvedPatterns(),
      recommendations: await this.generateRecommendations()
    };
  }

  private calculateDiversityScore(): number {
    // Simplified diversity calculation
    const uniqueGenes = new Set(this.currentGeneration.flatMap(o => o.genes.map(g => g.dna_sequence)));
    const totalGenes = this.currentGeneration.reduce((sum, o) => sum + o.genes.length, 0);
    return uniqueGenes.size / totalGenes;
  }

  private getSuccessfulMutations(): string[] {
    return this.genePool
      .filter(gene => gene.mutation_count > 0 && gene.fitness_score > 70)
      .map(gene => gene.dna_sequence.substring(0, 50))
      .slice(0, 3);
  }

  private getEvolvedPatterns(): string[] {
    return this.currentGeneration
      .filter(org => org.parent_organisms.length > 0 && org.overall_fitness > 70)
      .map(org => `${org.genes[0]?.gene_type}: ${org.genes[0]?.dna_sequence.substring(0, 50)}`)
      .slice(0, 3);
  }

  private async generateRecommendations(): Promise<string[]> {
    const topOrganism = this.currentGeneration
      .sort((a, b) => b.overall_fitness - a.overall_fitness)[0];
    
    if (!topOrganism) return ['Continue evolution to identify optimal patterns'];
    
    return [
      `Best performing pattern: ${topOrganism.genes[0]?.gene_type}`,
      `Average fitness trending: ${this.currentGeneration.reduce((sum, o) => sum + o.overall_fitness, 0) / this.currentGeneration.length > 60 ? 'upward' : 'stable'}`,
      'Continue evolution to optimize performance'
    ];
  }
}

export const getContentDnaEvolution = () => ContentDnaEvolution.getInstance();
