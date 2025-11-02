// MASTER SYSTEM MAPPING - Complete understanding before any fixes
const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔍 MASTER SYSTEM MAPPING - Understanding ALL Systems\n');
console.log('='.repeat(70));
console.log('GOAL: Map every system, every data flow, every column purpose');
console.log('='.repeat(70));
console.log('\n');

// Get all tables
const getTables = () => {
  try {
    const result = execSync(`
      grep -rh '\\.from(' src/ 2>/dev/null | 
      grep -o "\.from(['\"][^'\"]*['\"])" | 
      sed "s/\.from(['\"]\\([^'\"]*\\)['\"])/\\1/" | 
      sort -u
    `).toString().trim().split('\n');
    return result.filter(Boolean);
  } catch (e) {
    return [];
  }
};

const allTables = getTables();

console.log(`📊 TOTAL TABLES IN USE: ${allTables.length}\n`);

// Categorize by system
const systems = {
  POSTING_SYSTEM: {
    description: 'Content generation, queuing, and posting to Twitter',
    tables: []
  },
  REPLY_SYSTEM: {
    description: 'Reply discovery, generation, posting, and tracking',
    tables: []
  },
  SCRAPING_SYSTEM: {
    description: 'Collecting metrics, engagement, followers from Twitter',
    tables: []
  },
  LEARNING_SYSTEM: {
    description: 'AI learning from past performance',
    tables: []
  },
  GROWTH_TRACKING: {
    description: 'Follower growth attribution and tracking',
    tables: []
  },
  CONFIG_SYSTEM: {
    description: 'Bot configuration and settings',
    tables: []
  },
  DIAGNOSTICS: {
    description: 'Logging, debugging, health monitoring',
    tables: []
  },
  OTHER: {
    description: 'Misc tables',
    tables: []
  }
};

// Categorize tables
allTables.forEach(table => {
  if (table.includes('content') || table.includes('post') || table.includes('tweet') || table.includes('decision')) {
    systems.POSTING_SYSTEM.tables.push(table);
  } else if (table.includes('reply')) {
    systems.REPLY_SYSTEM.tables.push(table);
  } else if (table.includes('outcome') || table.includes('metric') || table.includes('scrape') || table.includes('analytics')) {
    systems.SCRAPING_SYSTEM.tables.push(table);
  } else if (table.includes('learning') || table.includes('learn') || table.includes('pattern') || table.includes('insight')) {
    systems.LEARNING_SYSTEM.tables.push(table);
  } else if (table.includes('follower') || table.includes('growth') || table.includes('attribution')) {
    systems.GROWTH_TRACKING.tables.push(table);
  } else if (table.includes('config') || table.includes('bot_')) {
    systems.CONFIG_SYSTEM.tables.push(table);
  } else if (table.includes('diagnostic') || table.includes('health') || table.includes('log') || table.includes('audit')) {
    systems.DIAGNOSTICS.tables.push(table);
  } else {
    systems.OTHER.tables.push(table);
  }
});

// Print system breakdown
Object.entries(systems).forEach(([name, info]) => {
  if (info.tables.length > 0) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${name} (${info.tables.length} tables)`);
    console.log(`Purpose: ${info.description}`);
    console.log(`${'='.repeat(70)}`);
    info.tables.forEach(t => console.log(`  • ${t}`));
  }
});

// Save to file
fs.writeFileSync('MASTER_SYSTEM_MAP.json', JSON.stringify(systems, null, 2));

console.log('\n\n✅ System mapping saved to MASTER_SYSTEM_MAP.json\n');

