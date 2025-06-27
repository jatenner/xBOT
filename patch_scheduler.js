const fs = require('fs');

// Read the file
let content = fs.readFileSync('src/agents/scheduler.ts', 'utf8');

// Add import for DraftDrainJob
const importSection = `import { draftDrainJob } from './draftDrainJob.js';`;
if (!content.includes('draftDrainJob')) {
  content = content.replace(
    `import { nightlyOptimizer } from './nightlyOptimizer.js';`,
    `import { nightlyOptimizer } from './nightlyOptimizer.js';\n${importSection}`
  );
}

// Add the job scheduling after the followGrowthJob
const followGrowthJobPattern = /this\.followGrowthJob = cron\.schedule\('[^']+', async \(\) => \{[\s\S]*?\}, \{\s*scheduled: true\s*\}\);/;
const followGrowthJobMatch = content.match(followGrowthJobPattern);

if (followGrowthJobMatch) {
  const draftDrainJobCode = `

      // Draft Drain Job - runs hourly to process queued tweets
      this.draftDrainJob = cron.schedule('5 * * * *', async () => {
        try {
          console.log('📤 Running draft drain job...');
          await draftDrainJob.processDraftQueue();
        } catch (error) {
          console.error('📤 Draft drain job failed:', error);
        }
      }, {
        scheduled: true,
        timezone: 'UTC'
      });`;

  content = content.replace(followGrowthJobMatch[0], followGrowthJobMatch[0] + draftDrainJobCode);
}

// Add to cronJobs array for proper shutdown
const cronJobsPattern = /const cronJobs = \[([\s\S]*?)\];/;
const cronJobsMatch = content.match(cronJobsPattern);

if (cronJobsMatch) {
  const existingJobs = cronJobsMatch[1];
  const newJob = `      { name: 'draftDrainJob', job: this.draftDrainJob },`;
  
  if (!existingJobs.includes('draftDrainJob')) {
    const updatedJobs = existingJobs.trim() + (existingJobs.trim().endsWith(',') ? '' : ',') + '\n' + newJob;
    content = content.replace(cronJobsPattern, `const cronJobs = [\n${updatedJobs}\n    ];`);
  }
}

// Write back to file
fs.writeFileSync('src/agents/scheduler.ts', content);
console.log('✅ Added draft drain job to scheduler');
