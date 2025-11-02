// Deep dive: POSTING SYSTEM
const fs = require('fs');

console.log('\n🎯 DEEP DIVE: POSTING SYSTEM\n');
console.log('='repeat(70));

const postingFlow = {
  name: 'POSTING SYSTEM',
  purpose: 'Generate content, queue it, post to Twitter, track results',
  
  stages: [
    {
      stage: '1. CONTENT GENERATION',
      description: 'AI generates tweets/threads based on topics, angles, tones',
      files: [
        'src/jobs/planJob.ts',
        'src/jobs/planJobUnified.ts',
        'src/generators/*.ts',
        'src/posting/aiVisualFormatter.ts'
      ],
      writes_to: [
        'content_metadata',
        'content_generation_metadata_comprehensive'
      ],
      columns_needed: [
        'decision_id (UUID)',
        'content (TEXT)',
        'decision_type (single/thread/reply)',
        'thread_parts (JSONB array)',
        'raw_topic (what topic was chosen)',
        'angle (how to approach it)',
        'tone (voice/style)',
        'generator_name (which of 12 generators)',
        'format_strategy (structure approach)',
        'visual_format (formatting applied)',
        'quality_score (AI prediction)',
        'predicted_er (expected engagement)',
        'scheduled_at (when to post)',
        'status (queued/ready/posted)'
      ],
      questions: [
        'Do both tables have all needed columns?',
        'Which table is source of truth?',
        'Are topic/angle/tone used for learning?'
      ]
    },
    
    {
      stage: '2. POSTING QUEUE',
      description: 'Pick ready content from queue and post to Twitter',
      files: [
        'src/jobs/postingQueue.ts',
        'src/posting/UltimateTwitterPoster.ts',
        'src/jobs/threadFallback.ts'
      ],
      reads_from: [
        'content_metadata',
        'content_generation_metadata_comprehensive'
      ],
      writes_to: [
        'posted_decisions',
        'tweets',
        'posts',
        'posted_threads'
      ],
      columns_needed: [
        'decision_id (link to queue)',
        'tweet_id (Twitter ID)',
        'tweet_url (Twitter URL)',
        'content (denormalized)',
        'posted_at (timestamp)',
        'generator_name (denormalized)',
        'raw_topic (denormalized)',
        'angle (denormalized)',
        'tone (denormalized)'
      ],
      questions: [
        'Why 3-4 tables for posted content?',
        'Which is used by scrapers?',
        'Which is used by learning system?'
      ]
    },
    
    {
      stage: '3. METRICS SCRAPING',
      description: 'Scrape engagement from Twitter (likes, retweets, views)',
      files: [
        'src/jobs/metricsScraperJob.ts',
        'src/scrapers/realMetricsScraper.ts',
        'src/scrapers/bulletproofTwitterScraper.ts'
      ],
      reads_from: [
        'posted_decisions',
        'tweets',
        'posts'
      ],
      writes_to: [
        'outcomes',
        'real_tweet_metrics',
        'tweet_analytics',
        'tweet_metrics'
      ],
      columns_needed: [
        'decision_id (link to posted)',
        'tweet_id (Twitter ID)',
        'likes (count)',
        'retweets (count)',
        'replies (count)',
        'views (count)',
        'impressions (count)',
        'engagement_rate (calculated)',
        'collected_at (timestamp)',
        'collected_pass (T+1h, T+24h, T+7d)'
      ],
      questions: [
        'Why 4 tables for metrics?',
        'Do they have different columns?',
        'Which does learning system use?'
      ]
    },
    
    {
      stage: '4. LEARNING & FEEDBACK',
      description: 'Learn what works, feed back to content generation',
      files: [
        'src/learning/learningSystem.ts',
        'src/learning/multiDimensionalLearning.ts'
      ],
      reads_from: [
        'content_metadata',
        'posted_decisions',
        'tweets',
        'outcomes',
        'real_tweet_metrics'
      ],
      writes_to: [
        'learning_posts',
        'learning_insights',
        'learning_updates'
      ],
      columns_needed_from_posted: [
        'generator_name (which generator)',
        'raw_topic (what topic)',
        'angle (what angle)',
        'tone (what tone)',
        'format_strategy (what format)',
        'visual_format (what formatting)'
      ],
      columns_needed_from_metrics: [
        'likes',
        'retweets',
        'engagement_rate',
        'views'
      ],
      questions: [
        'Does learning system query all metrics tables?',
        'Can it JOIN properly across fragmented tables?',
        'Are topic/angle/tone consistent across tables?'
      ]
    }
  ]
};

console.log('POSTING SYSTEM DATA FLOW:\n');

postingFlow.stages.forEach((stage, idx) => {
  console.log(`\n${'-'.repeat(70)}`);
  console.log(`STAGE ${idx + 1}: ${stage.stage}`);
  console.log(`${'-'.repeat(70)}`);
  console.log(`Purpose: ${stage.description}\n`);
  
  console.log('Files:');
  stage.files.forEach(f => console.log(`  • ${f}`));
  
  if (stage.reads_from) {
    console.log('\nReads from:');
    stage.reads_from.forEach(t => console.log(`  📖 ${t}`));
  }
  
  if (stage.writes_to) {
    console.log('\nWrites to:');
    stage.writes_to.forEach(t => console.log(`  📝 ${t}`));
  }
  
  console.log('\nColumns needed:');
  stage.columns_needed.forEach(c => console.log(`  - ${c}`));
  
  console.log('\n❓ Questions to answer:');
  stage.questions.forEach(q => console.log(`  ? ${q}`));
});

fs.writeFileSync('POSTING_SYSTEM_DEEP_DIVE.json', JSON.stringify(postingFlow, null, 2));

console.log('\n\n✅ Posting system analysis saved\n');

