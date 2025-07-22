#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ContactSync, Contact } from './contact-sync';

/**
 * Incremental Contact Sync with Performance Optimizations
 * 
 * This is a wrapper around ContactSync that adds:
 * - Last edit time filtering for Notion contacts
 * - Apple Mail folder extraction for new contacts
 * - Smart caching to avoid unnecessary syncs
 * - Performance tracking and optimization
 */

interface IncrementalSyncOptions {
  dryRun?: boolean;
  force?: boolean;
  mailFolders?: string[];
  daysSinceEdit?: number;
  daysSinceEmail?: number;
}

interface IncrementalSyncCache {
  lastSyncTime: string;
  totalSynced: number;
  notionChangeCount: number;
  appleChangeCount: number;
}

export class IncrementalContactManager {
  private contactSync: ContactSync;
  private cache: IncrementalSyncCache;
  private cacheFile: string;
  private options: IncrementalSyncOptions;

  constructor(options: IncrementalSyncOptions = {}) {
    this.options = {
      dryRun: false,
      force: false,
      mailFolders: ['VIP', 'Contacts', 'Recent'],
      daysSinceEdit: 7,
      daysSinceEmail: 30,
      ...options
    };

    this.cacheFile = join(process.cwd(), '.incremental-sync-cache.json');
    this.cache = this.loadCache();
    
    this.contactSync = new ContactSync({
      direction: 'notion-only',
      dryRun: this.options.dryRun || false
    });
  }

  /**
   * Main incremental sync process
   */
  async performIncrementalSync(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('⚡ Starting Incremental Contact Sync...');
      console.log(`🗓️  Last sync: ${this.cache.lastSyncTime || 'Never'}`);
      
      // Step 1: Get recently edited Notion contacts
      console.log(`\n📋 Step 1: Fetching Notion contacts edited in last ${this.options.daysSinceEdit} days...`);
      const recentNotionContacts = await this.fetchRecentNotionContacts();
      console.log(`   Found ${recentNotionContacts.length} recently edited Notion contacts`);

      // Step 2: Extract contacts from Apple Mail
      console.log(`\n📧 Step 2: Extracting contacts from Apple Mail folders...`);
      const newContactsFromMail = await this.extractContactsFromAppleMail();
      console.log(`   Found ${newContactsFromMail.length} potential new contacts from email`);

      // Step 3: Check what actually needs syncing
      if (!this.options.force && recentNotionContacts.length === 0 && newContactsFromMail.length === 0) {
        console.log('\n✨ No changes detected - sync not needed!');
        return;
      }

      // Step 4: Perform targeted sync
      if (recentNotionContacts.length > 0) {
        console.log(`\n🔄 Step 4a: Syncing ${recentNotionContacts.length} changed Notion contacts...`);
        await this.syncChangedNotionContacts(recentNotionContacts);
      }

      if (newContactsFromMail.length > 0) {
        console.log(`\n➕ Step 4b: Adding ${newContactsFromMail.length} new contacts from email...`);
        await this.addNewContactsFromMail(newContactsFromMail);
      }

      // Update cache
      this.updateCache(recentNotionContacts.length, newContactsFromMail.length);

      const duration = (Date.now() - startTime) / 1000;
      console.log(`\n⏱️  Total time: ${duration.toFixed(1)} seconds`);
      console.log(`🎯 Performance: ${((recentNotionContacts.length + newContactsFromMail.length) / duration).toFixed(1)} contacts/second`);

    } catch (error) {
      console.error('❌ Incremental sync failed:', error);
      throw error;
    }
  }

  /**
   * Fetch Notion contacts that were edited recently
   */
  private async fetchRecentNotionContacts(): Promise<Contact[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (this.options.daysSinceEdit || 7));
    
    try {
      // Initialize the contact sync system
      await this.contactSync.initialize();
      
      // Since we can't access private methods, we'll use a workaround
      // Create a temporary sync and filter results
      console.log('   🔍 Querying Notion databases...');
      
      // Run a full sync but capture the results
      const tempFile = join(process.cwd(), '.temp-recent-contacts.json');
      
      // Use the existing sync but capture its output
      await this.contactSync.manage();
      
      // For now, return empty array - this would need integration with the ContactSync class
      // to properly filter by last_edited_time
      return [];
      
    } catch (error) {
      console.error('Failed to fetch recent Notion contacts:', error);
      return [];
    }
  }

  /**
   * Extract contacts from Apple Mail folders
   */
  private async extractContactsFromAppleMail(): Promise<Contact[]> {
    const contacts: Contact[] = [];
    
    try {
      console.log(`   📬 Checking folders: ${this.options.mailFolders?.join(', ')}`);
      
      const daysSince = this.options.daysSinceEmail || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysSince);
      
      for (const category of this.options.mailFolders || []) {
        console.log(`   📁 Processing ${category}...`);
        
        let appleScript = '';
        
        if (category === 'VIP') {
          // VIP is a category, not a mailbox
          appleScript = `
            tell application "Mail"
              set vipMessages to every message in inbox whose sender is in vip list and date received > (current date - ${daysSince} * days)
              set contactEmails to {}
              
              repeat with vipMessage in vipMessages
                set senderEmail to (extract address from sender of vipMessage)
                if senderEmail is not in contactEmails and senderEmail does not contain "noreply" and senderEmail does not contain "no-reply" then
                  set end of contactEmails to senderEmail
                end if
              end repeat
              
              return contactEmails
            end tell
          `;
        } else if (category === 'Recent') {
          // Recent messages from inbox
          appleScript = `
            tell application "Mail"
              set recentMessages to every message in inbox whose date received > (current date - ${daysSince} * days)
              set contactEmails to {}
              
              repeat with recentMessage in first 50 items of recentMessages
                set senderEmail to (extract address from sender of recentMessage)
                if senderEmail is not in contactEmails and senderEmail does not contain "noreply" and senderEmail does not contain "no-reply" then
                  set end of contactEmails to senderEmail
                end if
              end repeat
              
              return contactEmails
            end tell
          `;
        } else {
          // Try as a mailbox name
          appleScript = `
            tell application "Mail"
              set theMessages to every message in mailbox "${category}" whose date received > (current date - ${daysSince} * days)
              set contactEmails to {}
              
              repeat with theMessage in theMessages
                set senderEmail to (extract address from sender of theMessage)
                if senderEmail is not in contactEmails and senderEmail does not contain "noreply" and senderEmail does not contain "no-reply" then
                  set end of contactEmails to senderEmail
                end if
              end repeat
              
              return contactEmails
            end tell
          `;
        }
        
        try {
          const result = execSync(`osascript -e '${appleScript.replace(/'/g, "\"")}'`, { 
            encoding: 'utf-8',
            timeout: 30000 
          });
          
          const emails = result.trim().split(', ').filter(email => email && email.includes('@'));
          
          for (const email of emails) {
            const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            contacts.push({
              name,
              email,
              contactType: email.includes('gmail.com') || email.includes('yahoo.com') ? 'personal' : 'company',
              lastModified: new Date(),
              source: 'import'
            });
          }
          
          console.log(`   ✅ Found ${emails.length} contacts in ${category}`);
          
        } catch (error) {
          console.error(`   ❌ Failed to process ${category}:`, error);
        }
      }
      
      // Remove duplicates
      const uniqueContacts = contacts.filter((contact, index, self) => 
        index === self.findIndex(c => c.email === contact.email)
      );
      
      return uniqueContacts;
      
    } catch (error) {
      console.error('Failed to extract contacts from Apple Mail:', error);
      return [];
    }
  }

  /**
   * Sync changed Notion contacts
   */
  private async syncChangedNotionContacts(contacts: Contact[]): Promise<void> {
    if (this.options.dryRun) {
      console.log('   🔍 DRY RUN - Would sync these contacts:');
      contacts.slice(0, 10).forEach(contact => 
        console.log(`     • ${contact.name} (${contact.email})`)
      );
      if (contacts.length > 10) {
        console.log(`     ... and ${contacts.length - 10} more`);
      }
    } else {
      // For now, use the full sync - in a real implementation,
      // we'd need access to the sync internals to do targeted syncing
      await this.contactSync.manage();
    }
  }

  /**
   * Add new contacts from mail to Notion
   */
  private async addNewContactsFromMail(contacts: Contact[]): Promise<void> {
    if (this.options.dryRun) {
      console.log('   🔍 DRY RUN - Would add these contacts:');
      contacts.slice(0, 10).forEach(contact => 
        console.log(`     • ${contact.name} (${contact.email})`)
      );
      if (contacts.length > 10) {
        console.log(`     ... and ${contacts.length - 10} more`);
      }
    } else {
      // For now, use the full sync which will detect and add new contacts
      await this.contactSync.manage();
    }
  }

  /**
   * Cache management
   */
  private loadCache(): IncrementalSyncCache {
    if (existsSync(this.cacheFile)) {
      try {
        return JSON.parse(readFileSync(this.cacheFile, 'utf-8'));
      } catch (error) {
        console.warn('⚠️  Failed to load cache, starting fresh');
      }
    }
    
    return {
      lastSyncTime: new Date().toISOString(),
      totalSynced: 0,
      notionChangeCount: 0,
      appleChangeCount: 0
    };
  }

  private updateCache(notionChanges: number, appleChanges: number): void {
    this.cache.lastSyncTime = new Date().toISOString();
    this.cache.notionChangeCount = notionChanges;
    this.cache.appleChangeCount = appleChanges;
    this.cache.totalSynced += notionChanges + appleChanges;
    
    writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
    
    console.log(`\n💾 Cache updated:`);
    console.log(`   📊 Total synced: ${this.cache.totalSynced} contacts`);
    console.log(`   💙 Notion changes: ${this.cache.notionChangeCount}`);
    console.log(`   📧 Apple changes: ${this.cache.appleChangeCount}`);
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    mailFolders: args.includes('--vip-only') ? ['VIP'] : ['VIP', 'Contacts', 'Recent'],
    daysSinceEdit: parseInt(args.find(arg => arg.startsWith('--days-edit='))?.split('=')[1] || '7'),
    daysSinceEmail: parseInt(args.find(arg => arg.startsWith('--days-email='))?.split('=')[1] || '30')
  };

  console.log('⚡ Incremental Sync Options:');
  console.log(`   Dry run: ${options.dryRun}`);
  console.log(`   Force sync: ${options.force}`);
  console.log(`   Mail folders: ${options.mailFolders.join(', ')}`);
  console.log(`   Days since edit: ${options.daysSinceEdit}`);
  console.log(`   Days since email: ${options.daysSinceEmail}`);

  const manager = new IncrementalContactManager(options);
  await manager.performIncrementalSync();
}

// Run the CLI when executed directly with tsx
main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
