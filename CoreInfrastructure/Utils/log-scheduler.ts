#!/usr/bin/env node

/**
 * Automated Log Cleanup Scheduler
 * 
 * Runs daily log management and cleanup for the pipeline
 * - Archives logs older than 7 days
 * - Generates log management reports
 * - Can be run as a cron job or manual task
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LogScheduler {
  private readonly logPath = path.join(__dirname, '..', '..', 'logs', 'current');

  async runLogManagement(): Promise<void> {
    console.log(`🕐 ${new Date().toISOString()} - Running scheduled log management`);
    
    return new Promise((resolve, reject) => {
      const logManager = spawn('npm', ['run', 'logs:manage'], {
        cwd: path.join(__dirname, '..', '..'),
        stdio: 'inherit'
      });

      logManager.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Log management completed successfully');
          resolve();
        } else {
          console.error(`❌ Log management failed with code ${code}`);
          reject(new Error(`Log management failed with code ${code}`));
        }
      });

      logManager.on('error', (error) => {
        console.error('❌ Failed to start log management:', error);
        reject(error);
      });
    });
  }

  generateCronCommand(): string {
    const projectRoot = path.join(__dirname, '..', '..');
    return `# Daily log cleanup at 2 AM
0 2 * * * cd ${projectRoot} && npm run logs:manage >> logs/current/log-scheduler.log 2>&1`;
  }

  displayScheduleInstructions(): void {
    console.log(`
📅 Log Management Scheduling Instructions
==========================================

To set up automatic daily log cleanup:

1. Edit your crontab:
   crontab -e

2. Add this line:
   ${this.generateCronCommand()}

3. Save and exit

This will run log cleanup daily at 2 AM, archiving logs older than 7 days.

Manual commands:
- Run cleanup now: npm run logs:manage
- Run full dev cleanup: npm run dev:clean
- Check logs: ls -la logs/current/

Log retention policy: 7 days in current/, older logs moved to archive/
`);
  }

  async run(): Promise<void> {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
      this.displayScheduleInstructions();
      return;
    }

    if (args.includes('--cron-setup')) {
      console.log(this.generateCronCommand());
      return;
    }

    await this.runLogManagement();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const scheduler = new LogScheduler();
  scheduler.run().catch(console.error);
}

export default LogScheduler;
