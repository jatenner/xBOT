/**
 * 👥 PEER SCRAPER JOB
 * 
 * Scheduled job to scrape high-performing health Twitter accounts for competitive intelligence
 * Runs every 8 hours to learn from successful health content creators
 * 
 * EXTENDED: Also scrapes Visual Intelligence accounts (100 seed + auto-discovered)
 */

import PeerScrapingSystem from '../intelligence/peer_scraper';
import { runVIAccountScraping } from './vi-job-extensions';

export async function peerScraperJob(): Promise<void> {
  console.log('[PEER_SCRAPER_JOB] 👥 Starting peer scraping cycle...');
  
  let peerScrapingSuccess = false;
  
  // Step 1: Run peer scraping (can fail independently)
  try {
    const scraper = new PeerScrapingSystem();
    await scraper.runPeerScrapingCycle();
    
    console.log('[PEER_SCRAPER_JOB] ✅ Peer scraping cycle complete');
    peerScrapingSuccess = true;
    
  } catch (error: any) {
    console.error('[PEER_SCRAPER_JOB] ⚠️ Peer scraping failed:', error.message);
    console.log('[PEER_SCRAPER_JOB] 🔄 Continuing with VI collection...');
    // Don't throw - let VI collection run even if peer scraping fails
  }
  
  // Step 2: ALWAYS run VI collection (critical for dashboard)
  // This runs independently even if peer scraping fails
  try {
    console.log('[PEER_SCRAPER_JOB] 🔍 Starting VI account scraping...');
    await runVIAccountScraping();
    console.log('[PEER_SCRAPER_JOB] ✅ VI account scraping complete');
  } catch (error: any) {
    console.error('[PEER_SCRAPER_JOB] ❌ VI account scraping failed:', error.message);
    // If VI collection fails, that's the critical error
    throw error;
  }
  
  // Only throw if BOTH failed (shouldn't happen, but safety check)
  if (!peerScrapingSuccess) {
    console.warn('[PEER_SCRAPER_JOB] ⚠️ Peer scraping failed but VI collection succeeded');
  }
}

