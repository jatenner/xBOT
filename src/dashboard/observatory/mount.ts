/**
 * Mount Observatory Dashboard on an Express app.
 *
 * This allows the observatory to run on the same port as the health server
 * instead of requiring a separate process on port 3333.
 *
 * Routes:
 *   GET /observatory        → HTML dashboard
 *   GET /observatory/live   → Live activity JSON
 *   GET /observatory/db     → Database stats JSON
 *   GET /observatory/analysis → Analysis JSON
 *   GET /observatory/intelligence → Intelligence data JSON
 *   GET /observatory/stream → SSE real-time feed
 */

import { getSupabaseClient } from '../../db';

export function mountObservatory(app: any): void {
  // Import the data functions from the server module
  // We inline them here to avoid circular deps with the standalone server

  app.get('/observatory', async (_req: any, res: any) => {
    try {
      const { getHTML } = await import('./server');
      let html = getHTML();
      // Inject base path so API fetches go to /observatory/* instead of /api/*
      html = html.replace('<script>', '<script>window.__obsBase="/observatory";\n');
      res.type('html').send(html);
    } catch (err: any) {
      res.status(500).send('Observatory failed to load: ' + err.message);
    }
  });

  app.get('/observatory/api/live', async (_req: any, res: any) => {
    try {
      const { getLiveData } = await import('./server');
      const data = await getLiveData();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/observatory/api/database', async (_req: any, res: any) => {
    try {
      const { getDatabaseData } = await import('./server');
      const data = await getDatabaseData();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/observatory/api/analysis', async (_req: any, res: any) => {
    try {
      const { getAnalysisData } = await import('./server');
      const data = await getAnalysisData();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/observatory/api/intelligence', async (_req: any, res: any) => {
    try {
      const { getIntelligenceData } = await import('./server');
      const data = await getIntelligenceData();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/observatory/api/stream', async (req: any, res: any) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('data: {"type":"connected"}\n\n');

    const interval = setInterval(async () => {
      try {
        const s = getSupabaseClient();
        const since = new Date(Date.now() - 30 * 1000).toISOString();
        const { data: recentTweets } = await s.from('brain_tweets')
          .select('tweet_id, author_username, content, likes, views, retweets, discovery_source, author_followers, posted_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(10);

        if (recentTweets && recentTweets.length > 0) {
          res.write(`data: ${JSON.stringify({ type: 'tweets', data: recentTweets })}\n\n`);
        }
      } catch {}
    }, 10000);

    req.on('close', () => clearInterval(interval));
  });

  console.log('  Observatory routes: /observatory, /observatory/live, /observatory/intelligence');
}
