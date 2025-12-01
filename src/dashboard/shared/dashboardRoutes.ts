/**
 * 🛣️ DASHBOARD ROUTES REGISTRY
 * Centralized registry of all dashboard routes for easy management
 */

import { Request, Response } from 'express';
import { handleDashboardRoute, DashboardRoute } from './routeHandler';
import { checkAuth, generateAuthErrorHTML } from './dashboardUtils';

/**
 * Dashboard route definitions
 */
export const dashboardRoutes: DashboardRoute[] = [
  {
    path: '/dashboard/business',
    handler: async () => {
      const { generateBusinessDashboard } = await import('../businessDashboard');
      return await generateBusinessDashboard();
    },
    activeTab: '/dashboard/business'
  },
  {
    path: '/dashboard/diagnostics',
    handler: async () => {
      const { generateDiagnosticsDashboard } = await import('../diagnosticsDashboard');
      return await generateDiagnosticsDashboard();
    },
    activeTab: '/dashboard/diagnostics'
  },
  {
    path: '/dashboard/system-flow',
    handler: async () => {
      const { generateSystemFlowDashboard } = await import('../systemFlowDashboard');
      return await generateSystemFlowDashboard();
    },
    activeTab: '/dashboard/system-flow'
  },
  {
    path: '/dashboard/data-validation',
    handler: async () => {
      const { generateDataValidationDashboard } = await import('../dataValidationDashboard');
      return await generateDataValidationDashboard();
    },
    activeTab: '/dashboard/data-validation'
  },
  {
    path: '/dashboard/posting-monitor',
    handler: async () => {
      const { generatePostingMonitorDashboard } = await import('../postingMonitorDashboard');
      return await generatePostingMonitorDashboard();
    },
    activeTab: '/dashboard/posting-monitor'
  }
];

/**
 * Register all dashboard routes with Express app
 */
export function registerDashboardRoutes(app: any): void {
  // Main dashboard redirects to business dashboard
  app.get('/dashboard', async (req: Request, res: Response) => {
    const token = req.query.token as string || '';
    res.redirect(`/dashboard/business?token=${token}`);
  });

  // Register all dashboard routes
  for (const route of dashboardRoutes) {
    app.get(route.path, async (req: Request, res: Response) => {
      await handleDashboardRoute(req, res, route);
    });
  }

  // Legacy routes (keep for backward compatibility)
  app.get('/dashboard/posts', async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string || req.headers.authorization?.replace('Bearer ', '');
      const adminToken = process.env.ADMIN_TOKEN || 'xbot-admin-2025';
      
      if (!checkAuth(token, req.headers.authorization)) {
        return res.status(401).send(generateAuthErrorHTML());
      }
      
      console.log('📊 POSTS_DASHBOARD: Serving posts analytics...');
      
      const { generatePostsOverview } = await import('../postsOverview');
      const dashboardHTML = await generatePostsOverview();
      
      res.setHeader('Content-Type', 'text/html');
      res.send(dashboardHTML);
      
      console.log('✅ POSTS_DASHBOARD: Delivered');
    } catch (error: any) {
      console.error('❌ POSTS_DASHBOARD_ERROR:', error.message);
      res.status(500).send(`<html><body style="padding: 50px; text-align: center;">
        <h1>🚨 Error</h1><p>${error.message}</p></body></html>`);
    }
  });

  app.get('/dashboard/replies', async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string || req.headers.authorization?.replace('Bearer ', '');
      
      if (!checkAuth(token, req.headers.authorization)) {
        return res.status(401).send(generateAuthErrorHTML());
      }
      
      console.log('📊 REPLIES_DASHBOARD: Serving replies analytics...');
      
      const { generateRepliesOverview } = await import('../repliesOverview');
      const dashboardHTML = await generateRepliesOverview();
      
      res.setHeader('Content-Type', 'text/html');
      res.send(dashboardHTML);
      
      console.log('✅ REPLIES_DASHBOARD: Delivered');
    } catch (error: any) {
      console.error('❌ REPLIES_DASHBOARD_ERROR:', error.message);
      res.status(500).send(`<html><body style="padding: 50px; text-align: center;">
        <h1>🚨 Error</h1><p>${error.message}</p></body></html>`);
    }
  });

  app.get('/dashboard/health', async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string || req.headers.authorization?.replace('Bearer ', '');
      
      if (!checkAuth(token, req.headers.authorization)) {
        return res.status(401).send(generateAuthErrorHTML());
      }
      
      console.log('🩺 HEALTH_DASHBOARD: Serving system health...');
      
      const { generateSystemHealthOverview } = await import('../systemHealthOverview');
      const dashboardHTML = await generateSystemHealthOverview();
      
      res.setHeader('Content-Type', 'text/html');
      res.send(dashboardHTML);
      
      console.log('✅ HEALTH_DASHBOARD: Delivered');
    } catch (error: any) {
      console.error('❌ HEALTH_DASHBOARD_ERROR:', error.message);
      res.status(500).send(`<html><body style="padding: 50px; text-align: center;">
        <h1>🚨 Error</h1><p>${error.message}</p></body></html>`);
    }
  });

  // Recent dashboard (legacy)
  app.get('/dashboard/recent', async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string || req.headers.authorization?.replace('Bearer ', '');
      
      if (!checkAuth(token, req.headers.authorization)) {
        return res.status(401).send(generateAuthErrorHTML());
      }
      
      console.log('📊 RECENT_DASHBOARD: Serving recent activity...');
      
      const { comprehensiveDashboard } = await import('../comprehensiveDashboard');
      const dashboardHTML = await comprehensiveDashboard.generateRecentDashboard();
      
      res.setHeader('Content-Type', 'text/html');
      res.send(dashboardHTML);
      
      console.log('✅ RECENT_DASHBOARD: Delivered');
    } catch (error: any) {
      console.error('❌ RECENT_DASHBOARD_ERROR:', error.message);
      res.status(500).send(`<html><body style="padding: 50px; text-align: center;">
        <h1>🚨 Error</h1><p>${error.message}</p></body></html>`);
    }
  });
}

