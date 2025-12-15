/**
 * Voice Extraction Report
 * 
 * Analyzes voice/style patterns from recent posts
 * READ-ONLY: No mutations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

interface VoiceStats {
  avg_sentence_length: number;
  avg_word_count: number;
  tone_indicators: {
    sentiment: string;
    readability_score: number | null;
  };
  hook_patterns: string[];
  structure_patterns: {
    bullet_heavy: number;
    long_form: number;
    short_form: number;
  };
  samples: Array<{
    decision_id: string;
    content: string;
    word_count: number;
    sentence_count: number;
    avg_sentence_length: number;
  }>;
}

function analyzeText(text: string): {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  hasBullets: boolean;
  isLongForm: boolean;
} {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  
  const hasBullets = /[-•*]\s/.test(text) || /^\d+\.\s/m.test(text);
  const isLongForm = wordCount > 100;
  
  return {
    wordCount,
    sentenceCount,
    avgSentenceLength,
    hasBullets,
    isLongForm
  };
}

async function generateReport() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('='.repeat(70));
  console.log('VOICE EXTRACTION REPORT');
  console.log('='.repeat(70));
  console.log('');

  // Get last 100 non-reply posts
  const { data: posts, error: postsError } = await supabase
    .from('vw_learning')
    .select('decision_id, content, content_slot, generator_name, sentiment, readability_score')
    .neq('content_slot', 'reply')
    .not('content', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(100);

  if (postsError) {
    console.error('❌ Error fetching posts:', postsError.message);
    process.exit(1);
  }

  if (!posts || posts.length === 0) {
    console.log('⚠️  No posts found');
    process.exit(0);
  }

  // Analyze all posts
  const analyses = posts.map((post: any) => {
    const content = post.content || '';
    const analysis = analyzeText(content);
    return {
      decision_id: post.decision_id,
      content,
      ...analysis,
      sentiment: post.sentiment || 'neutral',
      readability_score: post.readability_score
    };
  });

  // Calculate aggregate stats
  const totalWords = analyses.reduce((sum, a) => sum + a.wordCount, 0);
  const totalSentences = analyses.reduce((sum, a) => sum + a.sentenceCount, 0);
  const avgWordCount = totalWords / analyses.length;
  const avgSentenceLength = totalSentences > 0 ? totalWords / totalSentences : 0;

  const bulletHeavy = analyses.filter(a => a.hasBullets).length;
  const longForm = analyses.filter(a => a.isLongForm).length;
  const shortForm = analyses.length - longForm;

  // Extract hook patterns (simple heuristic: first sentence patterns)
  const hookPatterns = new Set<string>();
  analyses.forEach(a => {
    const firstSentence = a.content.split(/[.!?]/)[0] || '';
    if (firstSentence.includes('?')) hookPatterns.add('question');
    if (firstSentence.match(/^(What|Why|How|When|Where)/i)) hookPatterns.add('question_word');
    if (firstSentence.length < 50) hookPatterns.add('short_hook');
    if (firstSentence.length > 100) hookPatterns.add('long_hook');
  });

  // Get sentiment distribution
  const sentimentCounts: Record<string, number> = {};
  analyses.forEach(a => {
    const sent = a.sentiment || 'neutral';
    sentimentCounts[sent] = (sentimentCounts[sent] || 0) + 1;
  });

  // Get average readability
  const readabilityScores = analyses
    .map(a => a.readability_score)
    .filter((v): v is number => v !== null && v !== undefined);
  const avgReadability = readabilityScores.length > 0
    ? readabilityScores.reduce((sum, v) => sum + v, 0) / readabilityScores.length
    : null;

  // Random 10 samples
  const shuffled = [...analyses].sort(() => Math.random() - 0.5);
  const samples = shuffled.slice(0, 10).map(a => ({
    decision_id: a.decision_id,
    content: a.content.substring(0, 300),
    word_count: a.wordCount,
    sentence_count: a.sentenceCount,
    avg_sentence_length: a.avgSentenceLength
  }));

  // Print summary
  console.log('AGGREGATE STATS:');
  console.log(`  Total posts analyzed: ${analyses.length}`);
  console.log(`  Avg word count: ${avgWordCount.toFixed(1)}`);
  console.log(`  Avg sentence length: ${avgSentenceLength.toFixed(1)} words`);
  console.log(`  Avg readability score: ${avgReadability?.toFixed(2) || 'N/A'}`);
  console.log('');

  console.log('TONE INDICATORS:');
  console.log(`  Sentiment distribution:`);
  Object.entries(sentimentCounts).forEach(([sent, count]) => {
    console.log(`    ${sent}: ${count} (${((count / analyses.length) * 100).toFixed(1)}%)`);
  });
  console.log('');

  console.log('STRUCTURE PATTERNS:');
  console.log(`  Bullet-heavy posts: ${bulletHeavy} (${((bulletHeavy / analyses.length) * 100).toFixed(1)}%)`);
  console.log(`  Long-form posts (>100 words): ${longForm} (${((longForm / analyses.length) * 100).toFixed(1)}%)`);
  console.log(`  Short-form posts (≤100 words): ${shortForm} (${((shortForm / analyses.length) * 100).toFixed(1)}%)`);
  console.log('');

  console.log('HOOK PATTERNS DETECTED:');
  Array.from(hookPatterns).forEach(pattern => {
    console.log(`  - ${pattern}`);
  });
  console.log('');

  console.log('='.repeat(70));
  console.log('10 RANDOM SAMPLES:');
  console.log('-'.repeat(70));
  samples.forEach((sample, i) => {
    console.log(`\n${i + 1}. [${sample.decision_id.substring(0, 8)}...]`);
    console.log(`   Words: ${sample.word_count}, Sentences: ${sample.sentence_count}, Avg sentence length: ${sample.avg_sentence_length.toFixed(1)}`);
    console.log(`   Content: "${sample.content}..."`);
  });

  // JSON output
  const stats: VoiceStats = {
    avg_sentence_length: avgSentenceLength,
    avg_word_count: avgWordCount,
    tone_indicators: {
      sentiment: Object.entries(sentimentCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral',
      readability_score: avgReadability
    },
    hook_patterns: Array.from(hookPatterns),
    structure_patterns: {
      bullet_heavy: bulletHeavy,
      long_form: longForm,
      short_form: shortForm
    },
    samples
  };

  console.log('\n' + '='.repeat(70));
  console.log('JSON OUTPUT:');
  console.log('-'.repeat(70));
  console.log(JSON.stringify(stats, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('REPORT COMPLETE');
  console.log('='.repeat(70));
}

generateReport().catch((error) => {
  console.error('❌ Report failed:', error.message);
  process.exit(1);
});

