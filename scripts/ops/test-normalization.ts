#!/usr/bin/env tsx
import 'dotenv/config';
import { loadTwitterStorageState } from '../../src/utils/twitterSessionState';

async function main() {
  require('dotenv').config({ path: '.env.control' });
  const r = await loadTwitterStorageState();
  const authTokens = r.storageState?.cookies.filter(c => c.name.toLowerCase() === 'auth_token') || [];
  const ct0s = r.storageState?.cookies.filter(c => c.name.toLowerCase() === 'ct0') || [];
  console.log('Normalized auth_token domains:', authTokens.map(c => c.domain));
  console.log('Normalized ct0 domains:', ct0s.map(c => c.domain));
  console.log('Total cookies:', r.storageState?.cookies.length);
}

main().catch(console.error);
