#!/usr/bin/env tsx
/**
 * Generate deterministic fixture embeddings for topic-fit proof
 * Uses hash-based deterministic generation to ensure consistent results
 */

import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

/**
 * Simple hash function for deterministic embeddings
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Generate deterministic embedding from text
 * Creates embeddings that will have predictable cosine similarity with anchors
 */
function generateDeterministicEmbedding(text: string, targetSimilarity: number = 0.5): number[] {
  const hash = simpleHash(text);
  const embedding: number[] = [];
  
  // Generate 1536-dimensional vector (same as OpenAI text-embedding-3-small)
  // Create deterministic but varied embedding
  for (let i = 0; i < 1536; i++) {
    const seed = hash + i * 1234567;
    const normalized = (Math.sin(seed) + 1) / 2; // 0-1 range
    embedding.push((normalized - 0.5) * 2); // Convert to -1 to 1 range
  }
  
  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  const normalized = embedding.map(val => val / magnitude);
  
  // If we want to bias toward/away from anchors, we can't do it directly
  // Instead, we'll rely on the hash-based generation to create different vectors
  // and manually verify the similarities produce the expected scores
  return normalized;
}

/**
 * Generate embedding correlated with a reference embedding (for health texts)
 */
function generateCorrelatedEmbedding(reference: number[], correlation: number): number[] {
  const hash = simpleHash(JSON.stringify(reference));
  const random: number[] = [];
  
  // Generate random component
  for (let i = 0; i < reference.length; i++) {
    const seed = hash + i * 1234567;
    const normalized = (Math.sin(seed) + 1) / 2;
    random.push((normalized - 0.5) * 2);
  }
  
  // Normalize random component
  const randomMag = Math.sqrt(random.reduce((sum, val) => sum + val * val, 0));
  const randomNorm = random.map(val => val / randomMag);
  
  // Combine reference and random: correlation * reference + sqrt(1-correlation^2) * random
  const combined = reference.map((ref, i) => 
    correlation * ref + Math.sqrt(1 - correlation * correlation) * randomNorm[i]
  );
  
  // Normalize result
  const combinedMag = Math.sqrt(combined.reduce((sum, val) => sum + val * val, 0));
  return combined.map(val => val / combinedMag);
}

/**
 * Topic anchors
 */
const TOPIC_ANCHORS = {
  sleep: 'Sleep quality, circadian rhythm, REM sleep, deep sleep stages, sleep hygiene',
  nutrition: 'Nutrition, macronutrients, micronutrients, dietary patterns, meal timing, supplements',
  training: 'Exercise, strength training, cardiovascular fitness, workout routines, training adaptations',
  longevity: 'Longevity, lifespan extension, anti-aging, cellular health, biomarkers of aging',
  recovery: 'Recovery, muscle recovery, rest days, active recovery, sleep for recovery',
};

/**
 * Test fixtures
 */
const TEST_FIXTURES = [
  {
    name: 'health_sleep',
    text: 'Sleep quality is crucial for recovery and cognitive function. Deep sleep stages help with memory consolidation.',
  },
  {
    name: 'health_nutrition',
    text: 'Nutrition plays a key role in longevity. Proper macronutrient balance and micronutrient intake support optimal health.',
  },
  {
    name: 'health_training',
    text: 'Strength training adaptations improve muscle mass and bone density. Progressive overload is essential for gains.',
  },
  {
    name: 'unrelated_politics',
    text: 'The latest political debate focused on economic policy and tax reform. Voters are divided on the issue.',
  },
  {
    name: 'unrelated_tech',
    text: 'The new smartphone features advanced AI processing and improved camera sensors. Battery life has increased significantly.',
  },
  {
    name: 'unrelated_sports',
    text: 'The championship game was intense. The winning team scored in the final minutes with a spectacular goal.',
  },
];

/**
 * Generate fixtures
 */
function main() {
  const fixtures: Record<string, number[]> = {};
  
  // Generate anchor embeddings (base embeddings)
  console.log('Generating anchor embeddings...');
  const anchorEmbeddings: Record<string, number[]> = {};
  for (const [key, text] of Object.entries(TOPIC_ANCHORS)) {
    const anchorEmbedding = generateDeterministicEmbedding(text);
    anchorEmbeddings[key] = anchorEmbedding;
    fixtures[`anchor_${key}`] = anchorEmbedding;
  }
  
  // Generate test fixture embeddings
  // Strategy: Health texts = anchor + small noise (high similarity ~0.75-0.80)
  //           Unrelated texts = independent (low similarity ~0.20-0.30)
  console.log('Generating test fixture embeddings...');
  for (const fixture of TEST_FIXTURES) {
    if (fixture.name.startsWith('health_')) {
      // Health texts: strongly correlate with matching anchor
      let anchorKey = 'nutrition'; // default
      if (fixture.name.includes('sleep')) anchorKey = 'sleep';
      else if (fixture.name.includes('nutrition')) anchorKey = 'nutrition';
      else if (fixture.name.includes('training')) anchorKey = 'training';
      
      // Generate highly correlated embedding (correlation ~0.80 for similarity ~0.75-0.80)
      fixtures[fixture.name] = generateCorrelatedEmbedding(
        anchorEmbeddings[anchorKey],
        0.80
      );
    } else {
      // Unrelated texts: generate orthogonal embedding (low similarity)
      // Create embedding that's orthogonal to all anchors
      const hash = simpleHash(fixture.text);
      const embedding: number[] = [];
      
      // Generate deterministic but independent vector
      for (let i = 0; i < 1536; i++) {
        const seed = hash + i * 999999; // Different multiplier for unrelated
        const normalized = (Math.sin(seed) + 1) / 2;
        embedding.push((normalized - 0.5) * 2);
      }
      
      // Normalize
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      fixtures[fixture.name] = embedding.map(val => val / magnitude);
    }
  }
  
  // Write to JSON file
  const outputPath = path.join(__dirname, 'topicFitEmbeddings.json');
  fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));
  
  console.log(`✅ Generated ${Object.keys(fixtures).length} fixture embeddings`);
  console.log(`📄 Written to: ${outputPath}`);
}

main();
