#!/usr/bin/env tsx

/**
 * Social Content Operator CLI
 * 
 * Usage:
 * npm run content:generate -- --brand health --seeds "sleep optimization,energy management" --interactive
 * npm run content:quick -- --topic "morning routines"
 * npm run content:analyze -- --posts-file recent-posts.json
 */

import { SocialContentOperator } from '../src/content/SocialContentOperator';
import { getBrandProfile } from '../src/content/brandProfiles';
import * as fs from 'fs';
import * as path from 'path';

interface CLIArgs {
  brand?: 'health' | 'productivity' | 'mindfulness';
  seeds?: string;
  topics?: string;
  interactive?: boolean;
  quick?: boolean;
  analyze?: boolean;
  postsFile?: string;
  output?: string;
  help?: boolean;
}

async function main() {
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    return;
  }

  const brandProfile = getBrandProfile(args.brand || 'health');
  const operator = new SocialContentOperator(brandProfile);

  try {
    if (args.quick) {
      await runQuickGeneration(operator, args);
    } else if (args.analyze) {
      await runAnalysis(operator, args);
    } else if (args.interactive) {
      await runInteractiveMode(operator, args);
    } else {
      await runStandardGeneration(operator, args);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    
    switch (arg) {
      case '--brand':
        args.brand = argv[++i] as 'health' | 'productivity' | 'mindfulness';
        break;
      case '--seeds':
        args.seeds = argv[++i];
        break;
      case '--topics':
        args.topics = argv[++i];
        break;
      case '--interactive':
        args.interactive = true;
        break;
      case '--quick':
        args.quick = true;
        break;
      case '--analyze':
        args.analyze = true;
        break;
      case '--posts-file':
        args.postsFile = argv[++i];
        break;
      case '--output':
        args.output = argv[++i];
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}

function showHelp() {
  console.log(`
🎯 Social Content Operator CLI

USAGE:
  npm run content:generate -- [options]
  npm run content:quick -- --topics "topic1,topic2"
  npm run content:analyze -- --posts-file recent-posts.json

OPTIONS:
  --brand <type>          Brand profile to use: health|productivity|mindfulness (default: health)
  --seeds <topics>        Comma-separated list of content topics to focus on
  --topics <topics>       Alias for --seeds
  --interactive          Run in interactive mode with prompts
  --quick                Generate quick content pack without full analysis
  --analyze              Analyze past performance from JSON file
  --posts-file <file>    JSON file with recent posts for analysis
  --output <file>        Save output to file instead of console
  --help, -h             Show this help message

EXAMPLES:
  # Generate content with health brand and specific topics
  npm run content:generate -- --brand health --seeds "sleep,energy,focus"
  
  # Quick generation for a single topic
  npm run content:quick -- --topics "morning routines"
  
  # Interactive mode (asks for inputs step by step)
  npm run content:generate -- --interactive
  
  # Analyze performance from recent posts
  npm run content:analyze -- --posts-file data/recent-posts.json
  
  # Generate and save to file
  npm run content:generate -- --seeds "productivity,habits" --output content-pack.txt

INPUT FILE FORMATS:
  recent-posts.json should contain:
  [
    {
      "id": "tweet_id",
      "date": "2024-01-15",
      "type": "single",
      "hook": "I fixed my sleep in 2 weeks...",
      "content": "Full tweet content...",
      "metrics": {
        "likes": 150,
        "replies": 25,
        "reposts": 30,
        "bookmarks": 80,
        "views": 5000
      }
    }
  ]
`);
}

async function runQuickGeneration(operator: SocialContentOperator, args: CLIArgs) {
  console.log('🚀 Generating quick content pack...\n');
  
  const topics = (args.topics || args.seeds || 'health optimization,productivity').split(',').map(t => t.trim());
  const seeds = topics.map(topic => ({
    topic,
    priority: 'medium' as const
  }));

  // Generate with minimal mock data
  const contentPack = await operator.generateContentPack(
    seeds,
    [], // No recent posts
    [], // No target posts
    []  // No mentions
  );

  const output = operator.formatOutput(contentPack);
  
  if (args.output) {
    fs.writeFileSync(args.output, output);
    console.log(`✅ Content pack saved to ${args.output}`);
  } else {
    console.log(output);
  }
}

async function runAnalysis(operator: SocialContentOperator, args: CLIArgs) {
  if (!args.postsFile) {
    throw new Error('--posts-file is required for analysis mode');
  }

  if (!fs.existsSync(args.postsFile)) {
    throw new Error(`Posts file not found: ${args.postsFile}`);
  }

  console.log('📊 Analyzing past performance...\n');
  
  const postsData = JSON.parse(fs.readFileSync(args.postsFile, 'utf8'));
  
  // Generate analysis with just the posts data
  const contentPack = await operator.generateContentPack(
    [], // No new seeds
    postsData,
    [], // No target posts
    []  // No mentions
  );

  console.log('📈 PERFORMANCE ANALYSIS\n');
  console.log('What to do more of:');
  contentPack.learningNotes.doMore.forEach(item => console.log(`  • ${item}`));
  
  console.log('\nWhat to avoid:');
  contentPack.learningNotes.avoid.forEach(item => console.log(`  • ${item}`));
  
  console.log('\nHooks that worked:');
  contentPack.learningNotes.workingHooks.forEach(hook => console.log(`  • ${hook}`));
  
  console.log('\nNext experiments:');
  contentPack.learningNotes.experiments.forEach(exp => console.log(`  • ${exp}`));
}

async function runInteractiveMode(operator: SocialContentOperator, args: CLIArgs) {
  console.log('🎯 Interactive Content Generation\n');
  
  // This would integrate with a proper CLI prompting library
  // For now, we'll use simple console prompts
  console.log('📝 Please provide the following information:\n');
  
  console.log('1. Content Topics (comma-separated):');
  console.log('   Example: sleep optimization, energy management, focus techniques');
  
  console.log('\n2. Recent Posts Performance (optional):');
  console.log('   Provide path to JSON file with recent posts data, or press Enter to skip');
  
  console.log('\n3. Target Posts to Reply To (optional):');
  console.log('   Provide URLs or handles of posts you want to reply to, or press Enter to skip');
  
  console.log('\n4. Mentions to Respond To (optional):');
  console.log('   Provide mentions/comments that need responses, or press Enter to skip');
  
  // For demo purposes, generate with default data
  console.log('\n🚀 Generating content pack with demo data...\n');
  
  const demoSeeds = [
    { topic: 'sleep optimization', priority: 'high' as const },
    { topic: 'energy management', priority: 'medium' as const },
    { topic: 'focus techniques', priority: 'medium' as const }
  ];

  const contentPack = await operator.generateContentPack(demoSeeds, [], [], []);
  const output = operator.formatOutput(contentPack);
  
  if (args.output) {
    fs.writeFileSync(args.output, output);
    console.log(`✅ Content pack saved to ${args.output}`);
  } else {
    console.log(output);
  }
}

async function runStandardGeneration(operator: SocialContentOperator, args: CLIArgs) {
  console.log('🎯 Generating Social Content Pack\n');
  
  const topics = (args.topics || args.seeds || 'health optimization').split(',').map(t => t.trim());
  const seeds = topics.map(topic => ({
    topic,
    priority: 'medium' as const
  }));

  console.log(`📝 Topics: ${topics.join(', ')}`);
  console.log(`🎨 Brand: ${args.brand || 'health'}`);
  console.log('\n🚀 Generating content...\n');

  const contentPack = await operator.generateContentPack(seeds, [], [], []);
  const output = operator.formatOutput(contentPack);
  
  if (args.output) {
    fs.writeFileSync(args.output, output);
    console.log(`✅ Content pack saved to ${args.output}`);
  } else {
    console.log(output);
  }
}

// Example data generators for testing
function generateMockRecentPosts() {
  return [
    {
      id: 'tweet_1',
      date: '2024-01-15',
      type: 'single' as const,
      hook: 'I fixed my afternoon energy crash in 2 weeks',
      content: 'I fixed my afternoon energy crash in 2 weeks. The game-changer: eating protein within 30 minutes of waking up. No more 3pm slump, no more reaching for sugary snacks. Try 20g protein before coffee tomorrow.',
      metrics: { likes: 150, replies: 25, reposts: 30, bookmarks: 80, views: 5000 }
    },
    {
      id: 'tweet_2',
      date: '2024-01-14',
      type: 'thread' as const,
      hook: 'The 5-minute morning routine that changed everything',
      content: 'Thread about morning routines...',
      metrics: { likes: 89, replies: 12, reposts: 15, bookmarks: 45, views: 3200 }
    }
  ];
}

function generateMockTargetPosts() {
  return [
    {
      author: 'Health Expert',
      handle: '@healthexpert',
      url: 'https://twitter.com/healthexpert/status/123',
      content: 'Struggling with energy levels throughout the day. Any tips?',
      quotedDetail: 'energy levels throughout the day',
      stance: 'add_nuance' as const,
      goal: 'Provide helpful, specific advice'
    }
  ];
}

function generateMockMentions() {
  return [
    {
      author: 'Interested User',
      handle: '@user123',
      postUrl: 'https://twitter.com/ourhandle/status/456',
      text: 'This is really helpful! How long did it take you to see results?',
      sentiment: 'positive' as const,
      responseStyle: 'thank + mini-tip'
    }
  ];
}

if (require.main === module) {
  main().catch(console.error);
}
