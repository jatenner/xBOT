#!/usr/bin/env tsx
/**
 * Verify Replies: Sample 20
 * 
 * Generates 20 sample replies (dry-run) and validates quality
 */

import 'dotenv/config';
import { validateReplyQuality, chooseReplyStyle, type ReplyStyle } from '../src/generators/replyQualityGate';
import { calculateOverlapScore } from '../src/jobs/replyContextFetcher';

interface SampleReply {
  id: number;
  targetText: string;
  replyText: string;
  style: ReplyStyle;
  passed: boolean;
  reason?: string;
  chars: number;
  sentences: number;
  overlapScore: number;
}

// Sample target tweets for testing
const sampleTargets = [
  "New study shows that intermittent fasting can improve metabolic health and longevity",
  "I think meditation is overrated. Just go for a walk instead",
  "Research found that sleep quality matters more than sleep duration for cognitive function",
  "Hot take: Most supplements are a waste of money",
  "Interesting data on how exercise affects mental health outcomes",
  "The Mediterranean diet has been linked to reduced cardiovascular disease risk",
  "I believe cold showers are the secret to better health",
  "Scientists discovered a new mechanism for how the gut microbiome affects mood",
  "Vitamin D deficiency is more common than people think",
  "Study suggests that social connections are as important as diet for longevity",
  "New research on the effects of blue light exposure on sleep patterns",
  "I think people worry too much about protein intake",
  "Data shows that strength training is crucial for healthy aging",
  "The link between chronic stress and inflammation is fascinating",
  "Research indicates that mindful eating can help with weight management",
  "Hot take: Counting calories is outdated and ineffective",
  "Study found that regular sauna use may reduce risk of dementia",
  "I believe most people would benefit from therapy",
  "New findings on how gut health affects immune function",
  "The connection between sleep and metabolic health is underappreciated"
];

// Mock reply generation (in real system, this would call OpenAI)
function generateMockReply(targetText: string, style: ReplyStyle): string {
  const lowerText = targetText.toLowerCase();
  
  if (style === 'curious-question') {
    if (lowerText.includes('study') || lowerText.includes('research')) {
      return `What was the sample size and duration? Context matters for interpreting these results.`;
    }
    return `Interesting point. What's the mechanism behind this effect?`;
  }
  
  if (style === 'witty-smart') {
    if (lowerText.includes('hot take') || lowerText.includes('think')) {
      return `Bold claim! But the data suggests it's more nuanced than that.`;
    }
    return `Fair point, though the research tells a more complex story.`;
  }
  
  // crisp-educational
  if (lowerText.includes('health') || lowerText.includes('diet')) {
    return `Key factor: consistency matters more than perfection. Small sustainable changes compound over time.`;
  }
  
  return `Worth noting: individual variation is huge here. What works for one person may not work for another.`;
}

async function main() {
  console.log(`[REPLY_VERIFY] Starting reply quality verification...\n`);
  
  const samples: SampleReply[] = [];
  
  for (let i = 0; i < 20; i++) {
    const targetText = sampleTargets[i];
    const style = chooseReplyStyle(targetText);
    const replyText = generateMockReply(targetText, style);
    
    const quality = validateReplyQuality(replyText, targetText);
    
    samples.push({
      id: i + 1,
      targetText,
      replyText,
      style,
      passed: quality.passed,
      reason: quality.reason,
      chars: quality.chars,
      sentences: quality.sentences,
      overlapScore: quality.overlapScore
    });
  }
  
  const passed = samples.filter(s => s.passed).length;
  const failed = samples.filter(s => !s.passed).length;
  
  console.log(`=== SUMMARY ===`);
  console.log(`Total samples: ${samples.length}`);
  console.log(`Passed: ${passed} (${((passed / samples.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${((failed / samples.length) * 100).toFixed(1)}%)`);
  
  console.log(`\n=== PASSED REPLIES ===`);
  for (const sample of samples.filter(s => s.passed)) {
    console.log(`\n${sample.id}. Style: ${sample.style}`);
    console.log(`   Target: "${sample.targetText.substring(0, 80)}..."`);
    console.log(`   Reply: "${sample.replyText}"`);
    console.log(`   Stats: ${sample.chars} chars, ${sample.sentences} sentences, ${(sample.overlapScore * 100).toFixed(1)}% overlap`);
  }
  
  if (failed > 0) {
    console.log(`\n=== FAILED REPLIES ===`);
    for (const sample of samples.filter(s => !s.passed)) {
      console.log(`\n${sample.id}. Style: ${sample.style}`);
      console.log(`   Target: "${sample.targetText.substring(0, 80)}..."`);
      console.log(`   Reply: "${sample.replyText}"`);
      console.log(`   ❌ Reason: ${sample.reason}`);
      console.log(`   Stats: ${sample.chars} chars, ${sample.sentences} sentences, ${(sample.overlapScore * 100).toFixed(1)}% overlap`);
    }
  }
  
  console.log(`\n=== VERDICT ===`);
  if (passed === samples.length) {
    console.log(`✅ GREEN: All ${samples.length} replies passed quality gates`);
  } else if (passed >= samples.length * 0.8) {
    console.log(`🟡 YELLOW: ${passed}/${samples.length} replies passed (${((passed / samples.length) * 100).toFixed(1)}%)`);
  } else {
    console.log(`🔴 RED: Only ${passed}/${samples.length} replies passed (${((passed / samples.length) * 100).toFixed(1)}%)`);
  }
}

main();

