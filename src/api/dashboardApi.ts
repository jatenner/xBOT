/**
 * 🌐 DASHBOARD API ENDPOINT
 * 
 * Serves the performance analytics dashboard via HTTP
 */

import express from 'express';
import { performanceAnalyticsDashboard } from '../dashboard/performanceAnalyticsDashboard';

const router = express.Router();

/**
 * 📊 GET /dashboard - Serve HTML dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    console.log('📊 DASHBOARD_REQUEST: Generating analytics dashboard...');
    
    const dashboardHTML = await performanceAnalyticsDashboard.generateDashboardHTML();
    
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);
    
    console.log('✅ DASHBOARD_SERVED: Analytics dashboard delivered');
  } catch (error: any) {
    console.error('❌ DASHBOARD_ERROR:', error.message);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>🚨 Dashboard Temporarily Unavailable</h1>
          <p>Error: ${error.message}</p>
          <p><a href="/dashboard">🔄 Try Again</a></p>
        </body>
      </html>
    `);
  }
});

/**
 * 📊 GET /api/metrics - JSON API for metrics
 */
router.get('/api/metrics', async (req, res) => {
  try {
    console.log('📊 API_REQUEST: Getting dashboard metrics...');
    
    const metrics = await performanceAnalyticsDashboard.getDashboardMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ API_SERVED: Metrics data delivered');
  } catch (error: any) {
    console.error('❌ API_ERROR:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
