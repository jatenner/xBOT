/**
 * 🛣️ DASHBOARD ROUTES REGISTRY
 * Centralized registry of all dashboard routes for easy management
 */

import { Request, Response } from 'express';
import { handleDashboardRoute, DashboardRoute } from './routeHandler';
import { checkAuth, generateAuthErrorHTML } from './dashboardUtils';

/**
 * Dashboard route definitions
 * All active dashboards registered here for centralized management
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
  },
  {
    path: '/dashboard/health',
    handler: async () => {
      const { generateSystemHealthOverview } = await import('../systemHealthOverview');
      return await generateSystemHealthOverview();
    },
    activeTab: '/dashboard/health'
  },
  {
    path: '/dashboard/system-health',
    handler: async () => {
      const { generateSystemHealthDashboard } = await import('../systemHealthDashboard');
      return await generateSystemHealthDashboard();
    },
    activeTab: '/dashboard/system-health'
  },
  {
    path: '/dashboard/posts',
    handler: async () => {
      const { generatePostsOverview } = await import('../postsOverview');
      return await generatePostsOverview();
    },
    activeTab: '/dashboard/posts'
  },
  {
    path: '/dashboard/replies',
    handler: async () => {
      const { generateRepliesOverview } = await import('../repliesOverview');
      return await generateRepliesOverview();
    },
    activeTab: '/dashboard/replies'
  },
  {
    path: '/dashboard/recent',
    handler: async () => {
      const { comprehensiveDashboard } = await import('../comprehensiveDashboard');
      return await comprehensiveDashboard.generateRecentDashboard();
    },
    activeTab: '/dashboard/recent'
  },
  {
    path: '/dashboard/system-audit',
    handler: async () => {
      const { generateSystemAuditDashboard } = await import('../systemAuditDashboard');
      return await generateSystemAuditDashboard();
    },
    activeTab: '/dashboard/system-audit'
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

  // API endpoints for diagnostics
  app.get('/api/diagnostics/health', async (req: Request, res: Response) => {
    try {
      const { getDiagnosticsHealth } = await import('../../api/diagnosticsApi');
      await getDiagnosticsHealth(req, res);
    } catch (error: any) {
      console.error('❌ DIAGNOSTICS_API_ERROR:', error.message);
      res.status(500).json({ error: 'Unable to fetch system health data. Please try again later.' });
    }
  });

  app.get('/api/diagnostics/flow', async (req: Request, res: Response) => {
    try {
      const { getDiagnosticsFlow } = await import('../../api/diagnosticsApi');
      await getDiagnosticsFlow(req, res);
    } catch (error: any) {
      console.error('❌ DIAGNOSTICS_FLOW_API_ERROR:', error.message);
      res.status(500).json({ error: 'Unable to fetch system flow data. Please try again later.' });
    }
  });

  app.get('/api/diagnostics/data-validation', async (req: Request, res: Response) => {
    try {
      const { getDataValidation } = await import('../../api/diagnosticsApi');
      await getDataValidation(req, res);
    } catch (error: any) {
      console.error('❌ DATA_VALIDATION_API_ERROR:', error.message);
      res.status(500).json({ error: 'Unable to fetch data validation results. Please try again later.' });
    }
  });

  app.get('/api/diagnostics/posting-monitor', async (req: Request, res: Response) => {
    try {
      const { getPostingMonitor } = await import('../../api/diagnosticsApi');
      await getPostingMonitor(req, res);
    } catch (error: any) {
      console.error('❌ POSTING_MONITOR_API_ERROR:', error.message);
      res.status(500).json({ error: 'Unable to fetch posting monitor data. Please try again later.' });
    }
  });

  app.get('/api/system-diagnostics', async (req: Request, res: Response) => {
    try {
      const { getSystemDiagnostics } = await import('../../api/systemDiagnosticsApi');
      await getSystemDiagnostics(req, res);
    } catch (error: any) {
      console.error('❌ SYSTEM_DIAGNOSTICS_API_ERROR:', error.message);
      res.status(500).json({ error: 'Unable to fetch system diagnostics. Please try again later.' });
    }
  });
}

