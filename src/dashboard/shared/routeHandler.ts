/**
 * 🛣️ DASHBOARD ROUTE HANDLER
 * Standardized route handling for all dashboards
 */

import { Request, Response } from 'express';
import { checkAuth, generateAuthErrorHTML, generateErrorHTML } from './dashboardUtils';

export interface DashboardRoute {
  path: string;
  handler: () => Promise<string>;
  activeTab: string;
}

/**
 * Handle dashboard route with standard auth and error handling
 */
export async function handleDashboardRoute(
  req: Request,
  res: Response,
  route: DashboardRoute
): Promise<void> {
  try {
    const token = req.query.token as string | undefined;
    const headerToken = req.headers.authorization;

    if (!checkAuth(token, headerToken)) {
      res.status(401).send(generateAuthErrorHTML());
      return;
    }

    console.log(`📊 DASHBOARD: Serving ${route.path}...`);

    const dashboardHTML = await route.handler();

    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHTML);

    console.log(`✅ DASHBOARD: ${route.path} delivered`);
  } catch (error: any) {
    console.error(`❌ DASHBOARD_ERROR [${route.path}]:`, error.message);
    res.status(500).send(generateErrorHTML(error.message, route.path));
  }
}

