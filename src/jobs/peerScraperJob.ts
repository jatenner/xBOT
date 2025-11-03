/**
 * 👥 PEER SCRAPER JOB
 * 
 * Scheduled job to scrape high-performing health Twitter accounts for competitive intelligence
 * Runs every 8 hours to learn from successful health content creators
 */

import { PeerScraper } from '../intelligence/peer_scraper';

export async function peerScraperJob(): Promise<void> {
  console.log('[PEER_SCRAPER_JOB] 👥 Starting peer scraping cycle...');
  
  try {
    const scraper = PeerScraper.getInstance();
    await scraper.runPeerScrapingCycle();
    
    console.log('[PEER_SCRAPER_JOB] ✅ Peer scraping cycle complete');
    
  } catch (error: any) {
    console.error('[PEER_SCRAPER_JOB] ❌ Peer scraping failed:', error.message);
    throw error;
  }
}

