#!/usr/bin/env node

/**
 * Log Management System for Rockford - Toilville Pipeline Intelligence
 * 
 * Manages log retention, archival, and cleanup for the platform
 * - Keeps current logs (< 7 days) in logs/current/
 * - Archives older logs to logs/archive/
 * - Maintains organized development history
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LogFile {
  name: string;
  path: string;
  age: number; // days
  size: number; // bytes
}

class LogManager {
  private readonly RETENTION_DAYS = 7;
  private readonly CURRENT_DIR = path.join(__dirname, '..', 'logs', 'current');
  private readonly ARCHIVE_DIR = path.join(__dirname, '..', 'logs', 'archive');

  async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.CURRENT_DIR, { recursive: true });
      await fs.mkdir(this.ARCHIVE_DIR, { recursive: true });
      console.log('✅ Log directories initialized');
    } catch (error) {
      console.error('❌ Failed to initialize directories:', error);
    }
  }

  async scanLogFiles(): Promise<LogFile[]> {
    const logFiles: LogFile[] = [];
    const extensions = ['.json', '.log', '.md', '.csv'];
    
    try {
      const files = await fs.readdir(this.CURRENT_DIR);
      
      for (const file of files) {
        if (extensions.some(ext => file.endsWith(ext))) {
          const filePath = path.join(this.CURRENT_DIR, file);
          const stats = await fs.stat(filePath);
          const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
          
          logFiles.push({
            name: file,
            path: filePath,
            age: ageInDays,
            size: stats.size
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to scan log files:', error);
    }
    
    return logFiles;
  }

  async archiveOldLogs(): Promise<void> {
    const logFiles = await this.scanLogFiles();
    const oldLogs = logFiles.filter(log => log.age > this.RETENTION_DAYS);
    
    if (oldLogs.length === 0) {
      console.log('ℹ️  No logs to archive');
      return;
    }

    let archivedCount = 0;
    let totalSize = 0;

    for (const log of oldLogs) {
      try {
        const archivePath = path.join(this.ARCHIVE_DIR, log.name);
        await fs.rename(log.path, archivePath);
        archivedCount++;
        totalSize += log.size;
        console.log(`📦 Archived: ${log.name} (${Math.round(log.age)} days old)`);
      } catch (error) {
        console.error(`❌ Failed to archive ${log.name}:`, error);
      }
    }

    console.log(`✅ Archived ${archivedCount} logs (${(totalSize / 1024).toFixed(2)} KB)`);
  }

  async generateLogReport(): Promise<void> {
    const currentLogs = await this.scanLogFiles();
    const archiveFiles = await fs.readdir(this.ARCHIVE_DIR).catch(() => []);
    
    const report = {
      timestamp: new Date().toISOString(),
      current: {
        count: currentLogs.length,
        totalSize: currentLogs.reduce((sum, log) => sum + log.size, 0),
        oldestLog: currentLogs.length > 0 ? Math.max(...currentLogs.map(l => l.age)) : 0
      },
      archived: {
        count: archiveFiles.length
      },
      retentionPolicy: `${this.RETENTION_DAYS} days`,
      summary: `Maintaining ${currentLogs.length} current logs, ${archiveFiles.length} archived logs`
    };

    const reportPath = path.join(this.CURRENT_DIR, `log-management-report-${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('📊 Log management report generated');
    console.log(`   Current logs: ${report.current.count}`);
    console.log(`   Archived logs: ${report.archived.count}`);
    console.log(`   Total size: ${(report.current.totalSize / 1024).toFixed(2)} KB`);
  }

  async run(): Promise<void> {
    console.log('🔧 Starting log management...');
    await this.initializeDirectories();
    await this.archiveOldLogs();
    await this.generateLogReport();
    console.log('✅ Log management completed');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const logManager = new LogManager();
  logManager.run().catch(console.error);
}

export default LogManager;
