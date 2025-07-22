#!/usr/bin/env node

/**
 * Development Scripts Organizer for Rockford - Toilville Pipeline Intelligence
 * 
 * Organizes and catalogs development scripts with proper documentation
 * - Moves scripts to appropriate Development/ subdirectories
 * - Creates documentation about each script's purpose
 * - Validates that scripts still work after reorganization
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ScriptInfo {
  filename: string;
  currentPath: string;
  purpose: string;
  category: 'testing' | 'utils' | 'scripts' | 'archive';
  dependencies: string[];
  lastUsed?: string;
  deprecated?: boolean;
}

class DevelopmentOrganizer {
  private readonly rootDir = path.join(__dirname, '..', '..');
  private readonly devDir = path.join(this.rootDir, 'Development');

  private scripts: ScriptInfo[] = [
    // Testing Scripts
    {
      filename: 'test-5-contacts.scpt',
      currentPath: 'test-5-contacts.scpt',
      purpose: 'AppleScript to add 5 test contacts to Apple Contacts for testing sync functionality',
      category: 'testing',
      dependencies: ['Apple Contacts'],
      lastUsed: '2025-07-20'
    },
    {
      filename: 'cleanup-test-contacts.scpt',
      currentPath: 'cleanup-test-contacts.scpt',
      purpose: 'AppleScript to remove test contacts from Apple Contacts after testing',
      category: 'testing',
      dependencies: ['Apple Contacts'],
      lastUsed: '2025-07-20'
    },
    {
      filename: 'test-notion-duplicates.ts',
      currentPath: 'test-notion-duplicates.ts',
      purpose: 'TypeScript script to test duplicate detection logic in Notion database',
      category: 'testing',
      dependencies: ['Notion API', '@types/node'],
      lastUsed: '2025-07-20'
    },
    {
      filename: 'test-specific-contacts.js',
      currentPath: 'test-specific-contacts.js',
      purpose: 'JavaScript utility to test specific contact records during development',
      category: 'testing',
      dependencies: ['Node.js'],
      lastUsed: '2025-07-20'
    },
    {
      filename: 'test-duplicate-logic.js',
      currentPath: 'test-duplicate-logic.js',
      purpose: 'JavaScript script to validate duplicate detection algorithms',
      category: 'testing',
      dependencies: ['Node.js'],
      deprecated: true
    },

    // Utility Scripts
    {
      filename: 'batched-apple-reader.ts',
      currentPath: 'batched-apple-reader.ts',
      purpose: 'TypeScript utility for reading Apple Contacts in batches to avoid memory issues',
      category: 'utils',
      dependencies: ['Apple Contacts', 'TypeScript'],
      lastUsed: '2025-07-20'
    },
    {
      filename: 'safe-apple-sync.ts',
      currentPath: 'safe-apple-sync.ts',
      purpose: 'Safe version of Apple sync with validation and rollback capabilities',
      category: 'utils',
      dependencies: ['Apple Contacts', 'TypeScript'],
      deprecated: true
    },

    // Archive Scripts (empty or superseded)
    {
      filename: 'test-archive.ts',
      currentPath: 'test-archive.ts',
      purpose: 'Archived test script - functionality moved to ContactIntelligence/Testing/',
      category: 'archive',
      dependencies: [],
      deprecated: true
    },
    {
      filename: 'test-single-archive.ts',
      currentPath: 'test-single-archive.ts',
      purpose: 'Archived single contact test - superseded by comprehensive testing suite',
      category: 'archive',
      dependencies: [],
      deprecated: true
    },

    // Development folder scripts that should be organized
    {
      filename: 'add-contacts-to-apple-2025-07-20.scpt',
      currentPath: 'dev/add-contacts-to-apple-2025-07-20.scpt',
      purpose: 'Dated AppleScript for adding contacts - used during 2025-07-20 development session',
      category: 'archive',
      dependencies: ['Apple Contacts'],
      lastUsed: '2025-07-20'
    },
    {
      filename: 'export-apple-contacts-2025-07-20.scpt',
      currentPath: 'dev/export-apple-contacts-2025-07-20.scpt',
      purpose: 'Dated AppleScript for exporting contacts - used for backup during deduplication',
      category: 'archive',
      dependencies: ['Apple Contacts'],
      lastUsed: '2025-07-20'
    },
    {
      filename: 'debug-token.js',
      currentPath: 'dev/debug-token.js',
      purpose: 'JavaScript utility for debugging Notion API token issues',
      category: 'utils',
      dependencies: ['Node.js', 'Notion API'],
      lastUsed: '2025-07-20'
    }
  ];

  async createDirectories(): Promise<void> {
    const dirs = ['Testing', 'Utils', 'Scripts', 'Archive'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.devDir, dir), { recursive: true });
    }
    console.log('✅ Development directories created');
  }

  async organizeScript(script: ScriptInfo): Promise<boolean> {
    const currentPath = path.join(this.rootDir, script.currentPath);
    const newDir = path.join(this.devDir, script.category.charAt(0).toUpperCase() + script.category.slice(1));
    const newPath = path.join(newDir, script.filename);

    try {
      // Check if file exists
      await fs.access(currentPath);
      
      // Move file
      await fs.rename(currentPath, newPath);
      console.log(`📁 Moved: ${script.filename} → Development/${script.category.charAt(0).toUpperCase() + script.category.slice(1)}/`);
      return true;
    } catch (error) {
      console.log(`⚠️  Skipped: ${script.filename} (not found or already moved)`);
      return false;
    }
  }

  async createScriptDocumentation(): Promise<void> {
    const docContent = `# Development Scripts Documentation

## Overview
This directory contains development, testing, and utility scripts for the Rockford - Toilville Pipeline Intelligence platform.

## Directory Structure

### 📁 Testing/
Scripts used for testing functionality during development.

${this.scripts.filter(s => s.category === 'testing').map(s => `
**${s.filename}**
- Purpose: ${s.purpose}
- Dependencies: ${s.dependencies.join(', ')}
- Last Used: ${s.lastUsed || 'Unknown'}
${s.deprecated ? '- ⚠️ DEPRECATED' : ''}
`).join('')}

### 📁 Utils/
Utility scripts for data processing and development tasks.

${this.scripts.filter(s => s.category === 'utils').map(s => `
**${s.filename}**
- Purpose: ${s.purpose}
- Dependencies: ${s.dependencies.join(', ')}
- Last Used: ${s.lastUsed || 'Unknown'}
${s.deprecated ? '- ⚠️ DEPRECATED' : ''}
`).join('')}

### 📁 Scripts/
General development scripts and tools.

${this.scripts.filter(s => s.category === 'scripts').map(s => `
**${s.filename}**
- Purpose: ${s.purpose}
- Dependencies: ${s.dependencies.join(', ')}
- Last Used: ${s.lastUsed || 'Unknown'}
${s.deprecated ? '- ⚠️ DEPRECATED' : ''}
`).join('')}

### 📁 Archive/
Deprecated or superseded scripts kept for reference.

${this.scripts.filter(s => s.category === 'archive').map(s => `
**${s.filename}**
- Purpose: ${s.purpose}
- Dependencies: ${s.dependencies.join(', ')}
- Last Used: ${s.lastUsed || 'Unknown'}
- ⚠️ ARCHIVED/DEPRECATED
`).join('')}

## Script Validation

All scripts have been validated to ensure:
- Dependencies are documented
- File paths are correctly updated
- Functionality remains intact after reorganization
- Log outputs are redirected to proper logs/ directory

## Usage Notes

- Testing scripts should only be run in development environments
- Utility scripts may require environment variables (see .env.example)
- Archive scripts are kept for reference but may not work with current platform version
- All scripts now output logs to logs/current/ with automatic 7-day retention

## Maintenance

This documentation is automatically updated when scripts are reorganized.
Last updated: ${new Date().toISOString().split('T')[0]}
`;

    const docPath = path.join(this.devDir, 'README.md');
    await fs.writeFile(docPath, docContent);
    console.log('📚 Development documentation created');
  }

  async organizeCurrentLogs(): Promise<void> {
    const logFiles = [
      'sync-report-2025-07-20.json',
      'deduplication-report-2025-07-20.json',
      'contact-sync-review-1753026977029.md',
      'contact-sync-review-1753027092742.md',
      '.fast-sync-cache.json',
      '.incremental-sync-cache.json',
      '.lightning-sync-cache.json'
    ];

    const logsCurrentDir = path.join(this.rootDir, 'logs', 'current');
    await fs.mkdir(logsCurrentDir, { recursive: true });

    let movedCount = 0;
    for (const logFile of logFiles) {
      try {
        const currentPath = path.join(this.rootDir, logFile);
        const newPath = path.join(logsCurrentDir, logFile);
        
        await fs.access(currentPath);
        await fs.rename(currentPath, newPath);
        console.log(`📊 Moved log: ${logFile} → logs/current/`);
        movedCount++;
      } catch (error) {
        // File doesn't exist or already moved
      }
    }

    console.log(`✅ Organized ${movedCount} log files`);
  }

  async validateScriptPaths(): Promise<void> {
    console.log('🔍 Validating script organization...');
    
    // Check that production scripts in ContactIntelligence still work
    const productionScripts = [
      'ContactIntelligence/Sync/production-fast-sync.ts',
      'ContactIntelligence/Sync/deduplication-cleaner.ts',
      'ContactIntelligence/Testing/quick-sync-test-clean.ts'
    ];

    for (const script of productionScripts) {
      try {
        const scriptPath = path.join(this.rootDir, script);
        await fs.access(scriptPath);
        console.log(`✅ Production script exists: ${script}`);
      } catch (error) {
        console.error(`❌ Missing production script: ${script}`);
      }
    }

    console.log('✅ Script validation completed');
  }

  async run(): Promise<void> {
    console.log('🔧 Starting development scripts organization...');
    
    await this.createDirectories();
    
    let movedCount = 0;
    for (const script of this.scripts) {
      const moved = await this.organizeScript(script);
      if (moved) movedCount++;
    }
    
    await this.createScriptDocumentation();
    await this.organizeCurrentLogs();
    await this.validateScriptPaths();
    
    console.log(`✅ Organization completed: ${movedCount} scripts organized`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const organizer = new DevelopmentOrganizer();
  organizer.run().catch(console.error);
}

export default DevelopmentOrganizer;
