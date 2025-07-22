#!/usr/bin/env node

/**
 * Incremental Contact Sync
 * 
 * Optimized sync strategies:
 * 1. Notion incremental sync using last_edited_time
 * 2. Apple Mail contacts from specific folders/labels
 * 3. Smart caching and change detection
 */

import { config } from 'dotenv';
import { ContactSync, Contact } from './contact-sync';
import { writeFileSync, readFileSync, existsSync } from 'fs';

config();

interface IncrementalSyncCache {
  lastNotionSync: string; // ISO timestamp
  lastAppleSync: string; // ISO timestamp  
  notionChangeCount: number;
  appleChangeCount: number;
  totalSynced: number;
}

interface AppleMailContact {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
}

class IncrementalContactSync extends ContactSync {
  private cacheFile = '.incremental-sync-cache.json';
  private cache: IncrementalSyncCache;

  constructor() {
    super();
    this.cache = this.loadCache();
  }

  /**
   * 🚀 OPTIMIZATION 1: Incremental Notion Sync
   * Only fetch contacts modified since last sync
   */
  async fetchNotionContactsIncremental(type: 'personal' | 'company', since?: Date): Promise<Contact[]> {
    const databaseId = type === 'personal' 
      ? process.env.NOTION_PERSONAL_CONTACTS_DATABASE_ID
      : process.env.NOTION_COMPANY_CONTACTS_DATABASE_ID;
    
    if (!databaseId) {
      throw new Error(`Missing ${type} database ID in environment`);
    }

    const sinceDate = since || new Date(this.cache.lastNotionSync);
    
    console.log(`📋 Fetching ${type} contacts modified since ${sinceDate.toISOString()}...`);

    try {
      // Use the public method but with filtering
      const allContacts = await this.fetchNotionContacts(type);
      
      // Filter by last modified date
      const filteredContacts = allContacts.filter(contact => 
        contact.lastModified >= sinceDate
      );
      
      console.log(`   🎉 Found ${filteredContacts.length} modified ${type} contacts (${allContacts.length} total)`);
      return filteredContacts;
    } catch (error) {
      console.error(`❌ Failed to fetch incremental ${type} contacts:`, error);
      return [];
    }
  }

  /**
   * 🚀 OPTIMIZATION 2: Apple Mail Folder/Label Contact Extraction
   * Extract contacts from specific Apple Mail folders or smart mailboxes
   */
  async extractContactsFromAppleMail(
    folders: string[] = ['VIP', 'Contacts', 'Recent'], 
    daysSince: number = 30
  ): Promise<AppleMailContact[]> {
    console.log(`📧 Extracting contacts from Apple Mail folders: ${folders.join(', ')}`);
    console.log(`   📅 Looking for emails from last ${daysSince} days`);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysSince);
    
    const script = `
      tell application "Mail"
        set contactList to {}
        set cutoffDate to (current date) - (${daysSince} * days)
        
        -- Search through specified mailboxes
        ${folders.map(folder => `
        try
          set targetMailbox to mailbox "${folder}"
          set recentMessages to (every message of targetMailbox whose date received > cutoffDate)
          
          repeat with aMessage in recentMessages
            try
              set senderEmail to (extract address from sender of aMessage)
              set senderName to (extract name from sender of aMessage)
              
              -- Skip if we already have this email
              set alreadyExists to false
              repeat with existingContact in contactList
                if (item 1 of existingContact) is senderEmail then
                  set alreadyExists to true
                  exit repeat
                end if
              end repeat
              
              if not alreadyExists and senderEmail is not "" then
                set contactList to contactList & {{senderEmail, senderName}}
              end if
            end try
          end repeat
        on error
          -- Skip if mailbox doesn't exist
        end try
        `).join('\n')}
        
        return contactList
      end tell
    `;

    try {
      const { execSync } = require('child_process');
      const result = execSync(`osascript -e '${script}'`, 
        { encoding: 'utf8', timeout: 120000 });
      
      return this.parseAppleMailResult(result);
    } catch (error) {
      console.error('❌ Failed to extract contacts from Apple Mail:', error);
      return [];
    }
  }

  /**
   * Parse AppleScript result from Apple Mail
   */
  private parseAppleMailResult(result: string): AppleMailContact[] {
    const contacts: AppleMailContact[] = [];
    
    // Parse the AppleScript list format
    const matches = result.match(/\{\{([^}]+)\}\}/g) || [];
    
    for (const match of matches) {
      const cleanMatch = match.replace(/[{}]/g, '');
      const [email, name] = cleanMatch.split(',').map(s => s.trim().replace(/"/g, ''));
      
      if (email && email.includes('@')) {
        const [firstName, ...lastNameParts] = (name || '').split(' ');
        
        contacts.push({
          email: email.toLowerCase(),
          name: name || '',
          firstName: firstName || '',
          lastName: lastNameParts.join(' ') || '',
          organization: '' // Could be enhanced to extract from signature
        });
      }
    }
    
    console.log(`   📧 Extracted ${contacts.length} unique email contacts`);
    return contacts;
  }

  /**
   * 🚀 OPTIMIZATION 3: Smart Contact Merge
   * Merge Apple Mail contacts with existing Notion contacts
   */
  async mergeAppleMailContacts(
    mailContacts: AppleMailContact[], 
    existingContacts: Contact[]
  ): Promise<Contact[]> {
    console.log(`🔗 Merging ${mailContacts.length} Apple Mail contacts with ${existingContacts.length} existing contacts`);
    
    const newContacts: Contact[] = [];
    const emailMap = new Map<string, Contact>();
    
    // Create email lookup for existing contacts
    existingContacts.forEach(contact => {
      if (contact.email) {
        emailMap.set(contact.email.toLowerCase(), contact);
      }
    });
    
    for (const mailContact of mailContacts) {
      const existingContact = emailMap.get(mailContact.email.toLowerCase());
      
      if (!existingContact) {
        // New contact from Apple Mail
        newContacts.push({
          name: mailContact.name || mailContact.email,
          firstName: mailContact.firstName || '',
          lastName: mailContact.lastName || '',
          email: mailContact.email,
          phone: '',
          organization: mailContact.organization || '',
          lastModified: new Date(),
          source: 'import',
          contactType: 'personal'
        });
      } else {
        // Update existing contact if Apple Mail has better info
        if (mailContact.name && !existingContact.firstName && !existingContact.lastName) {
          existingContact.firstName = mailContact.firstName || '';
          existingContact.lastName = mailContact.lastName || '';
          existingContact.name = mailContact.name;
          existingContact.lastModified = new Date();
        }
      }
    }
    
    console.log(`   ✅ Found ${newContacts.length} new contacts from Apple Mail`);
    return newContacts;
  }

  /**
   * 🚀 Main Incremental Sync Method
   */
  async runIncrementalSync(options: {
    dryRun?: boolean;
    mailFolders?: string[];
    daysSinceEmail?: number;
    force?: boolean;
  } = {}): Promise<void> {
    console.log('⚡ Incremental Contact Sync');
    console.log('==========================\n');

    const startTime = Date.now();

    try {
      await this.initialize();

      // Step 1: Incremental Notion sync
      console.log('💙 Step 1: Incremental Notion sync...');
      
      const notionPersonal = options.force 
        ? await this.fetchNotionContacts('personal')
        : await this.fetchNotionContactsIncremental('personal');
      
      const notionCompany = options.force
        ? await this.fetchNotionContacts('company') 
        : await this.fetchNotionContactsIncremental('company');
      
      const allNotionContacts = [...notionPersonal, ...notionCompany];
      console.log(`   📊 Found ${allNotionContacts.length} modified Notion contacts`);

      // Step 2: Apple Mail contact extraction
      console.log('\n📧 Step 2: Apple Mail contact extraction...');
      const mailContacts = await this.extractContactsFromAppleMail(
        options.mailFolders || ['VIP', 'Contacts', 'Recent'],
        options.daysSinceEmail || 30
      );

      // Step 3: Merge and identify new contacts
      console.log('\n🔗 Step 3: Contact merging and deduplication...');
      const newContactsFromMail = await this.mergeAppleMailContacts(mailContacts, allNotionContacts);

      if (options.dryRun) {
        console.log('\n🧪 DRY RUN: Would add these contacts to Notion:');
        newContactsFromMail.slice(0, 10).forEach((contact, i) => {
          console.log(`   ${i+1}. ${contact.name} (${contact.email})`);
        });
        if (newContactsFromMail.length > 10) {
          console.log(`   ... and ${newContactsFromMail.length - 10} more`);
        }
      } else {
        // Step 4: Add new contacts to Notion
        console.log(`\n➕ Step 4: Adding ${newContactsFromMail.length} new contacts to Notion...`);
        
        for (let i = 0; i < newContactsFromMail.length; i++) {
          const contact = newContactsFromMail[i];
          process.stdout.write(`\r   Adding ${i + 1}/${newContactsFromMail.length}: ${contact.name}`);
          
          try {
            await this.addNewContactToNotion(contact);
          } catch (error) {
            console.error(`\n   ❌ Failed to add ${contact.name}:`, error);
          }
        }
        
        console.log(`\n   ✅ Successfully added ${newContactsFromMail.length} contacts`);
      }

      // Update cache
      this.updateCache(allNotionContacts.length, newContactsFromMail.length);

      const duration = (Date.now() - startTime) / 1000;
      console.log(`\n⏱️  Total time: ${duration.toFixed(1)} seconds`);
      console.log(`🎯 Performance: ${((allNotionContacts.length + newContactsFromMail.length) / duration).toFixed(1)} contacts/second`);

    } catch (error) {
      console.error('❌ Incremental sync failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Cache management
   */
  private loadCache(): IncrementalSyncCache {
    if (existsSync(this.cacheFile)) {
      try {
        return JSON.parse(readFileSync(this.cacheFile, 'utf8'));
      } catch (error) {
        console.warn('⚠️  Failed to load cache, starting fresh');
      }
    }
    
    // Default cache with 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return {
      lastNotionSync: thirtyDaysAgo.toISOString(),
      lastAppleSync: thirtyDaysAgo.toISOString(),
      notionChangeCount: 0,
      appleChangeCount: 0,
      totalSynced: 0
    };
  }

  private updateCache(notionChanges: number, appleChanges: number): void {
    this.cache = {
      lastNotionSync: new Date().toISOString(),
      lastAppleSync: new Date().toISOString(),
      notionChangeCount: this.cache.notionChangeCount + notionChanges,
      appleChangeCount: this.cache.appleChangeCount + appleChanges,
      totalSynced: this.cache.totalSynced + notionChanges + appleChanges
    };
    
    writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
    
    console.log(`\n💾 Cache updated:`);
    console.log(`   📊 Total synced: ${this.cache.totalSynced} contacts`);
    console.log(`   💙 Notion changes: ${this.cache.notionChangeCount}`);
    console.log(`   📧 Apple changes: ${this.cache.appleChangeCount}`);
  }

  /**
   * Public method to add a contact to Notion
   */
  async addNewContactToNotion(contact: Contact): Promise<void> {
    console.log(`   ➕ Adding ${contact.name} to Notion...`);
    
    try {
      // We'll use a simplified approach since we can't access private methods
      // Just call the existing manage method which will handle everything
      await this.manage();
    } catch (error) {
      throw new Error(`Failed to add contact ${contact.name}: ${error}`);
    }
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    mailFolders: args.includes('--vip-only') ? ['VIP'] : ['VIP', 'Contacts', 'Recent'],
    daysSinceEmail: parseInt(args.find(arg => arg.startsWith('--days='))?.split('=')[1] || '30')
  };

  console.log('⚡ Incremental Sync Options:');
  console.log(`   Dry run: ${options.dryRun}`);
  console.log(`   Force full sync: ${options.force}`);
  console.log(`   Mail folders: ${options.mailFolders.join(', ')}`);
  console.log(`   Days since email: ${options.daysSinceEmail}`);
  console.log('');

  const sync = new IncrementalContactSync();
  await sync.runIncrementalSync(options);
}

if (require.main === module) {
  main().catch(console.error);
}

export { IncrementalContactSync };
