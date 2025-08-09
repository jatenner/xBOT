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
      
      if (activeProcesses > 8) {
        // Force cleanup and recheck
        await this.forceCleanup();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s for processes to die
        
        const activeAfterCleanup = await this.countActiveProcesses();
        if (activeAfterCleanup > 8) {
          // Try one more aggressive cleanup
          await this.aggressiveCleanup();
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const finalCount = await this.countActiveProcesses();
          if (finalCount > 8) {
            return {
              canLaunch: false,
              reason: `Too many active processes: ${finalCount} (after cleanup)`
            };
          }
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

  /**
   * 🔥 AGGRESSIVE cleanup for stubborn processes and EAGAIN recovery
   */
  async aggressiveCleanup(): Promise<void> {
    try {
      console.log('🔥 AGGRESSIVE cleanup mode for EAGAIN recovery...');
      
      if (process.env.NODE_ENV === 'production') {
        try {
          // Step 1: Nuclear process cleanup
          console.log('🧨 Step 1: Nuclear process cleanup');
          exec('pkill -9 -f chrome || true');
          exec('pkill -9 -f chromium || true'); 
          exec('pkill -9 -f headless_shell || true');
          exec('pkill -9 -f playwright || true');
          exec('pkill -9 -f node.*browser || true'); // Kill any hanging node browser processes
          
          // Step 2: File descriptor cleanup
          console.log('🧨 Step 2: File descriptor cleanup');
          exec('lsof | grep chrome | awk \'{print $2}\' | xargs -r kill -9 || true');
          exec('lsof | grep chromium | awk \'{print $2}\' | xargs -r kill -9 || true');
          
          // Step 3: Temp file and socket cleanup  
          console.log('🧨 Step 3: Temp file and socket cleanup');
          exec('rm -rf /tmp/.X* || true');
          exec('rm -rf /tmp/playwright* || true');
          exec('rm -rf /tmp/chromium* || true');
          exec('rm -rf /tmp/chrome* || true');
          exec('rm -rf /tmp/.browser* || true');
          exec('find /tmp -name "*chrome*" -type f -delete || true');
          exec('find /tmp -name "*playwright*" -type f -delete || true');
          
          // Step 4: Shared memory cleanup (critical for EAGAIN)
          console.log('🧨 Step 4: Shared memory cleanup');
          exec('rm -rf /dev/shm/.org.chromium.* || true');
          exec('rm -rf /dev/shm/chrome* || true');
          exec('ipcs -m | awk \'$3 == "0x00000000" {print $2}\' | xargs -r ipcrm shm || true');
          
          // Step 5: Force filesystem sync to free up descriptors
          console.log('🧨 Step 5: Filesystem sync');
          exec('sync || true');
          
          // Step 6: Extended wait for Railway resource recovery
          console.log('🧨 Step 6: Extended resource recovery wait');
          await new Promise(resolve => setTimeout(resolve, 5000)); // Increased wait time
          
          console.log('🔥 EAGAIN-focused aggressive cleanup completed');
        } catch (error) {
          console.log('⚠️ Aggressive cleanup warning:', error.message);
        }
      }
      
      // Step 7: Force multiple garbage collections with delays
      console.log('🧨 Step 7: Memory pressure relief');
      if (global.gc) {
        for (let i = 0; i < 3; i++) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Step 8: Clear any remaining Node.js handles
      if (process.env.NODE_ENV === 'production') {
        try {
          // Force close any remaining handles (best effort)
          process._getActiveHandles().forEach(handle => {
            try {
              if (handle && typeof handle.close === 'function') {
                handle.close();
              }
            } catch (e) {
              // Ignore errors in handle cleanup
            }
          });
        } catch (error) {
          // Handle cleanup is best effort
        }
      }
      
    } catch (error) {
      console.log('⚠️ Aggressive cleanup error:', error.message);
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