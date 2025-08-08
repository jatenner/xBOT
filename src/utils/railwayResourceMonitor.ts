/**
 * 📊 RAILWAY RESOURCE MONITOR
 * Monitors system resources and prevents crashes
 */

import { exec } from 'child_process';

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
      
      // Railway has ~512MB limit, be more permissive for posting
      if (totalMB > 480) {
        return {
          canLaunch: false,
          reason: `High memory usage: ${totalMB}MB (limit: 480MB)`
        };
      }
      
      // Check if any existing browser processes
      const activeProcesses = process.env.NODE_ENV === 'production' ? 
        await this.countActiveProcesses() : 0;
      
      if (activeProcesses > 3) {
        // Force cleanup and recheck
        await this.forceCleanup();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
        
        const activeAfterCleanup = await this.countActiveProcesses();
        if (activeAfterCleanup > 3) {
          return {
            canLaunch: false,
            reason: `Too many active processes: ${activeAfterCleanup} (after cleanup)`
          };
        }
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
          // More aggressive cleanup
          exec('pkill -f chrome || true');
          exec('pkill -f chromium || true');
          exec('pkill -f headless_shell || true');
          // Wait a moment for processes to die
          await new Promise(resolve => setTimeout(resolve, 1000));
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