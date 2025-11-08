#!/bin/bash

echo "🔥 Manually triggering harvester on Railway..."
echo ""

# Run the harvester directly
railway run --detach bash -c "pnpm tsx -e \"
import { replyOpportunityHarvester } from './src/jobs/replyOpportunityHarvester';
console.log('🔥 MANUAL TRIGGER: Starting harvester...');
replyOpportunityHarvester()
  .then(() => console.log('✅ MANUAL TRIGGER: Harvester complete'))
  .catch(err => console.error('❌ MANUAL TRIGGER: Error:', err.message));
\""

echo ""
echo "✅ Harvester triggered!"
echo "Check logs in 30 seconds: railway logs"

