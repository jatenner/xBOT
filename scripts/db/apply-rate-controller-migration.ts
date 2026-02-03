#!/usr/bin/env tsx
/**
 * HISTORICAL RESCUE SCRIPT - NO LONGER NEEDED
 * 
 * This script was used to manually apply the rate controller migration
 * before the automatic migration system was fully working.
 * 
 * The migration is now handled automatically via:
 * - supabase/migrations/20260203_rate_controller_schema.sql
 * - supabase/migrations/20260203_update_content_metadata_view.sql
 * - scripts/db/apply-migrations.ts (automatic runner)
 * 
 * This file is kept for historical reference only.
 * Use `pnpm run db:migrate` instead.
 */

console.log('⚠️  This script is deprecated. Use `pnpm run db:migrate` instead.');
console.log('The rate controller migration is now handled automatically.');
process.exit(1);
