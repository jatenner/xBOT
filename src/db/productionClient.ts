// src/db/productionClient.ts - Production database client with verified SSL
import { createStrictSSLClient, connectWithVerification } from './strictClient';
import { log } from '../utils/logger';

let dbClient: any = null;

export async function getProductionDBClient() {
  if (dbClient) {
    return dbClient;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  try {
    const client = createStrictSSLClient(databaseUrl);
    await connectWithVerification(client);
    
    dbClient = client;
    log('🎯 SUPABASE_SERVICE: Service role client initialized');
    return client;
    
  } catch (error) {
    log(`❌ DB_CLIENT_INIT_FAILED: ${error.message}`);
    throw error;
  }
}

export async function closeProductionDBClient() {
  if (dbClient) {
    try {
      await dbClient.end();
      dbClient = null;
      log('📊 DATABASE: Connection closed');
    } catch (error) {
      log(`⚠️ DB_CLOSE_ERROR: ${error.message}`);
    }
  }
}
