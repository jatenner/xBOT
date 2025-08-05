/**
 * 📊 RAILWAY RESOURCE MONITOR
 * Monitors system resources and prevents crashes
 */

export class RailwayResourceMonitor {
  private static instance: RailwayResourceMonitor;
  
  static getInstance(): RailwayResourceMonitor {
    if (!this.instance) {
      this.instance = new RailwayResourceMonitor();
    }
    return this.instance;
  }

  /**
   * 🔍 Check if browser can safely launch
   */
  async canLaunchBrowser(): Promise<{ canLaunch: boolean; reason?: string }> {
    try {
      // Check memory usage
      const memUsage = process.memoryUsage();
      const totalMB = Math.round(memUsage.rss / 1024 / 1024);
      
      console.log(`📊 Memory usage: ${totalMB}MB`);
      
      // Railway has ~512MB limit, be conservative
      if (totalMB > 400) {
        return {
          canLaunch: false,
          reason: `High memory usage: ${totalMB}MB (limit: 400MB)`
        };
      }
      
      // Check if any existing browser processes
      const activeProcesses = process.env.NODE_ENV === 'production' ? 
        await this.countActiveProcesses() : 0;
      
      if (activeProcesses > 2) {
        return {
          canLaunch: false,
          reason: `Too many active processes: ${activeProcesses}`
        };
      }
      
      return { canLaunch: true };
      
    } catch (error) {
      return {
        canLaunch: false,
        reason: `Resource check failed: ${error.message}`
      };
    }
  }

  /**
   * 🧹 Force cleanup of system resources
   */
  async forceCleanup(): Promise<void> {
    try {
      console.log('🧹 Forcing system cleanup...');
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
        console.log('✅ Forced garbage collection');
      }
      
      // Kill any hanging Chrome processes (Railway only)
      if (process.env.NODE_ENV === 'production') {
        try {
          const { exec } = require('child_process');
          exec('pkill -f chrome || true');
          console.log('✅ Cleaned up Chrome processes');
        } catch (error) {
          // Ignore errors, this is best-effort cleanup
        }
      }
      
    } catch (error) {
      console.log('⚠️ Cleanup warning:', error.message);
    }
  }

  private async countActiveProcesses(): Promise<number> {
    return new Promise((resolve) => {
      try {
        const { exec } = require('child_process');
        exec('ps aux | grep chrome | grep -v grep | wc -l', (error, stdout) => {
          if (error) {
            resolve(0);
          } else {
            resolve(parseInt(stdout.trim()) || 0);
          }
        });
      } catch {
        resolve(0);
      }
    });
  }
}