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
  
  try {
    const scraper = new PeerScrapingSystem();
    await scraper.runPeerScrapingCycle();
    
    console.log('[PEER_SCRAPER_JOB] ✅ Peer scraping cycle complete');
    
    // NEW: Visual Intelligence account scraping (feature flagged)
    await runVIAccountScraping();
    
  } catch (error: any) {
    console.error('[PEER_SCRAPER_JOB] ❌ Peer scraping failed:', error.message);
    throw error;
  }
}

