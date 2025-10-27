/**
 * Resource Metrics API Endpoint
 * Exposes real-time container resource usage
 */

import { Router, Request, Response } from 'express';
import * as os from 'os';

const router = Router();

interface ResourceMetrics {
  timestamp: string;
  memory: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
    usage_percent: number;
    process: {
      rss_mb: number;
      heap_used_mb: number;
      heap_total_mb: number;
      external_mb: number;
    };
  };
  cpu: {
    cores: number;
    model: string;
    load_avg: {
      '1min': number;
      '5min': number;
      '15min': number;
    };
    process_percent: number;
  };
  uptime: {
    process_hours: number;
    system_hours: number;
  };
  environment: {
    node_version: string;
    platform: string;
    arch: string;
    railway_env: string;
  };
}

/**
 * GET /api/resources
 * Returns current resource usage metrics
 */
router.get('/resources', async (req: Request, res: Response) => {
  try {
    // Memory metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    
    // CPU metrics - measure over 100ms
    const startUsage = process.cpuUsage();
    const startTime = Date.now();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const elapsed = Date.now() - startTime;
    const usage = process.cpuUsage(startUsage);
    const totalCpuUsage = (usage.user + usage.system) / 1000;
    const cpuPercent = (totalCpuUsage / elapsed) * 100;
    
    const metrics: ResourceMetrics = {
      timestamp: new Date().toISOString(),
      memory: {
        total_gb: parseFloat((totalMem / 1024 / 1024 / 1024).toFixed(2)),
        used_gb: parseFloat((usedMem / 1024 / 1024 / 1024).toFixed(2)),
        free_gb: parseFloat((freeMem / 1024 / 1024 / 1024).toFixed(2)),
        usage_percent: parseFloat(((usedMem / totalMem) * 100).toFixed(1)),
        process: {
          rss_mb: Math.round(memUsage.rss / 1024 / 1024),
          heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
          heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
          external_mb: Math.round(memUsage.external / 1024 / 1024)
        }
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0].model,
        load_avg: {
          '1min': parseFloat(os.loadavg()[0].toFixed(2)),
          '5min': parseFloat(os.loadavg()[1].toFixed(2)),
          '15min': parseFloat(os.loadavg()[2].toFixed(2))
        },
        process_percent: parseFloat(cpuPercent.toFixed(1))
      },
      uptime: {
        process_hours: parseFloat((process.uptime() / 3600).toFixed(2)),
        system_hours: parseFloat((os.uptime() / 3600).toFixed(2))
      },
      environment: {
        node_version: process.version,
        platform: os.platform(),
        arch: os.arch(),
        railway_env: process.env.RAILWAY_ENVIRONMENT || 'unknown'
      }
    };
    
    res.json({
      success: true,
      metrics,
      health_status: getHealthStatus(metrics),
      recommendations: getRecommendations(metrics)
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function getHealthStatus(metrics: ResourceMetrics): string {
  if (metrics.memory.usage_percent > 90) return 'critical';
  if (metrics.memory.usage_percent > 80) return 'warning';
  if (metrics.cpu.load_avg['1min'] > metrics.cpu.cores * 2) return 'warning';
  return 'healthy';
}

function getRecommendations(metrics: ResourceMetrics): string[] {
  const recommendations: string[] = [];
  
  if (metrics.memory.usage_percent > 80) {
    recommendations.push('High memory usage - reduce concurrent browser contexts');
  }
  
  if (metrics.cpu.load_avg['1min'] > metrics.cpu.cores * 1.5) {
    recommendations.push('High CPU load - stagger job execution');
  }
  
  if (metrics.memory.process.rss_mb > 1000) {
    recommendations.push('Node process using >1GB - check for memory leaks');
  }
  
  return recommendations;
}

export default router;

