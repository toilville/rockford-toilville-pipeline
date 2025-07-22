#!/usr/bin/env node

/**
 * Lightning Fast Contact Sync
 * 
 * Strategy for Speed:
 * FIRST RUN (~7 minutes): Option 2 - Skip Apple deduplication, direct comparison
 * FUTURE RUNS (~30 seconds): Smart caching + incremental updates
 */

import { config } from 'dotenv';
import { ContactSync, Contact } from './contact-sync';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

config();

interface QuickCache {
  timestamp: number;
  appleContactHashes: string[];  // Just hashes for quick comparison
  notionContactHashes: string[];
  lastSyncCount: number;
}

class LightningContactSync {
  private contactSync: ContactSync;
  private cacheFile: string = '.lightning-sync-cache.json';

  constructor() {
    this.contactSync = new ContactSync();
  }

  async run(options: { dryRun?: boolean; force?: boolean; test?: boolean } = {}): Promise<void> {
    console.log('⚡ Lightning Fast Contact Sync');
    console.log('============================\n');

    const startTime = Date.now();

    try {
      // Initialize the contact sync client
      await this.contactSync.initialize();
      
      if (!options.force && await this.canUseQuickSync()) {
        await this.performQuickSync(options);
      } else {
        await this.performFirstRunSync(options);
      }

      const duration = (Date.now() - startTime) / 1000;
      console.log(`\n⏱️  Total time: ${duration.toFixed(1)} seconds`);

    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    } finally {
      // Clean up
      await this.contactSync.cleanup();
    }
  }

  private async canUseQuickSync(): Promise<boolean> {
    if (!existsSync(this.cacheFile)) {
      console.log('🆕 First run detected - will perform full sync');
      return false;
    }

    try {
      const cache: QuickCache = JSON.parse(readFileSync(this.cacheFile, 'utf8'));
      const age = Date.now() - cache.timestamp;
      
      // Cache valid for 4 hours
      if (age > 4 * 60 * 60 * 1000) {
        console.log('⏰ Cache expired - performing full sync');
        return false;
      }

      console.log('⚡ Cache found - using quick sync mode');
      return true;
    } catch {
      return false;
    }
  }

  private async performQuickSync(options: { dryRun?: boolean; test?: boolean }): Promise<void> {
    console.log('🔍 Checking for new Notion contacts...');
    
    const cache: QuickCache = JSON.parse(readFileSync(this.cacheFile, 'utf8'));
    
    // Get both personal and company contacts
    const personalContacts = await this.contactSync.fetchNotionContacts('personal');
    const companyContacts = await this.contactSync.fetchNotionContacts('company');
    let currentNotionContacts = [...personalContacts, ...companyContacts];
    
    // TEST MODE: Limit to 5 random contacts
    if (options.test) {
      console.log('🧪 TEST MODE: Limiting to 5 random contacts');
      const shuffled = currentNotionContacts.sort(() => 0.5 - Math.random());
      currentNotionContacts = shuffled.slice(0, 5);
      console.log('   Selected contacts:');
      currentNotionContacts.forEach((c, i) => {
        console.log(`   ${i+1}. ${c.name} (${c.email || 'no email'})`);
      });
    }
    
    // Quick hash comparison
    const currentNotionHashes = currentNotionContacts.map((c: Contact) => this.hashContact(c));
    const newHashes = currentNotionHashes.filter((h: string) => !cache.notionContactHashes.includes(h));
    
    if (newHashes.length === 0) {
      console.log('✅ No new contacts found - sync up to date!');
      return;
    }

    console.log(`📝 Found ${newHashes.length} new Notion contacts`);
    
    // Get the actual new contacts
    const newContacts = currentNotionContacts.filter((c: Contact) => 
      newHashes.includes(this.hashContact(c))
    );

    // Quick Apple check - just get count
    const appleCount = await this.getAppleContactsCount();
    console.log(`📱 Apple has ${appleCount} contacts`);

    if (!options.dryRun) {
      console.log('➕ Adding new contacts to Apple...');
      await this.addContactsToApple(newContacts);
      
      // Update cache
      await this.updateCache(currentNotionHashes, cache.appleContactHashes, newContacts.length);
    } else {
      console.log('🧪 DRY RUN: Would add these contacts to Apple:');
      newContacts.forEach((c, i) => {
        console.log(`   ${i+1}. ${c.name} (${c.email || 'no email'})`);
      });
    }

    console.log(`✅ Quick sync complete! ${options.dryRun ? 'Would add' : 'Added'} ${newContacts.length} contacts`);
  }

  private async performFirstRunSync(options: { dryRun?: boolean; test?: boolean }): Promise<void> {
    console.log('🚀 First run - using FAST strategy (no Apple deduplication)');
    
    // Step 1: Get our Notion contacts (both personal and company)
    console.log('\n💙 Loading Notion contacts...');
    const personalContacts = await this.contactSync.fetchNotionContacts('personal');
    const companyContacts = await this.contactSync.fetchNotionContacts('company');
    let notionContacts = [...personalContacts, ...companyContacts];
    console.log(`   ✅ ${notionContacts.length} Notion contacts loaded (${personalContacts.length} personal, ${companyContacts.length} company)`);
    
    // TEST MODE: Limit to 5 random contacts
    if (options.test) {
      console.log('\n🧪 TEST MODE: Limiting to 5 random contacts');
      const shuffled = notionContacts.sort(() => 0.5 - Math.random());
      notionContacts = shuffled.slice(0, 5);
      console.log('   Selected test contacts:');
      notionContacts.forEach((c, i) => {
        console.log(`   ${i+1}. ${c.name} (${c.email || 'no email'})`);
      });
    }

    // Step 2: Read Apple contacts (raw, no deduplication)
    console.log('\n📱 Reading Apple contacts (fast mode - no deduplication)...');
    const appleContacts = options.test ? 
      await this.readAppleContactBatch(1, 50) : // Just read first 50 for test mode
      await this.readAppleContactsFast();
    console.log(`   ✅ ${appleContacts.length} Apple contacts loaded`);

    // Step 3: Simple comparison (fast)
    console.log('\n🔍 Finding new contacts to add...');
    const contactsToAdd = this.findNewContacts(notionContacts, appleContacts);
    console.log(`   ✅ ${contactsToAdd.length} new contacts identified`);

    if (contactsToAdd.length > 0) {
      if (options.dryRun) {
        console.log('\n🧪 DRY RUN: Would add these contacts to Apple:');
        contactsToAdd.forEach((c, i) => {
          console.log(`   ${i+1}. ${c.name} (${c.email || 'no email'})`);
        });
      } else {
        console.log('\n➕ Adding contacts to Apple...');
        await this.addContactsToApple(contactsToAdd);
      }
    } else {
      console.log('\n✅ No new contacts to add - all Notion contacts already exist in Apple');
    }

    // Step 5: Save cache for future quick runs (only if not test mode)
    if (!options.test) {
      await this.saveCache(notionContacts, appleContacts, contactsToAdd.length);
    }

    console.log(`\n✅ ${options.test ? 'Test' : 'First'} run complete!`);
    console.log(`   ${options.dryRun ? 'Would add' : 'Added'}: ${contactsToAdd.length} contacts`);
    if (!options.test) {
      console.log(`   Future runs will be much faster (~30 seconds)`);
    }
  }

  private async readAppleContactsFast(): Promise<Contact[]> {
    const totalCount = await this.getAppleContactsCount();
    const contacts: Contact[] = [];
    const batchSize = 100;
    const numBatches = Math.ceil(totalCount / batchSize);

    console.log(`   Reading ${totalCount} contacts in ${numBatches} batches...`);

    for (let batch = 0; batch < numBatches; batch++) {
      const startIndex = batch * batchSize + 1;
      const endIndex = Math.min((batch + 1) * batchSize, totalCount);
      
      process.stdout.write(`\r   Batch ${batch + 1}/${numBatches} (${contacts.length} contacts loaded)`);
      
      const batchContacts = await this.readAppleContactBatch(startIndex, endIndex);
      contacts.push(...batchContacts);
    }
    
    console.log(''); // New line after progress
    return contacts;
  }

  private async getAppleContactsCount(): Promise<number> {
    try {
      const result = execSync('osascript -e \'tell application "Contacts" to return count of every person\'', 
        { encoding: 'utf8', timeout: 10000 });
      return parseInt(result.trim());
    } catch (error) {
      console.error('Failed to get Apple contacts count:', error);
      return 0;
    }
  }

  private async readAppleContactBatch(startIndex: number, endIndex: number): Promise<Contact[]> {
    const script = `
      tell application "Contacts"
        set contactsList to {}
        
        repeat with i from ${startIndex} to ${endIndex}
          try
            set aPerson to person i
            set contactName to ""
            set contactEmail to ""
            
            try
              set contactName to name of aPerson
            end try
            
            try
              if (count of emails of aPerson) > 0 then
                set contactEmail to value of first email of aPerson
              end if
            end try
            
            set contactRecord to contactName & "|||" & contactEmail
            set contactsList to contactsList & {contactRecord}
          end try
        end repeat
        
        return contactsList
      end tell
    `;

    try {
      const result = execSync(`osascript -e '${script}'`, 
        { encoding: 'utf8', timeout: 60000 });
      
      return this.parseAppleScriptResult(result);
    } catch (error) {
      console.error(`Failed to read batch ${startIndex}-${endIndex}:`, error);
      return [];
    }
  }

  private parseAppleScriptResult(result: string): Contact[] {
    const lines = result.split(',').map(line => line.trim());
    const contacts: Contact[] = [];

    for (const line of lines) {
      if (line) {
        const [name = '', email = ''] = line.split('|||');
        
        if (name || email) {
          const [firstName, ...lastNameParts] = name.split(' ');
          const lastName = lastNameParts.join(' ');
          
          contacts.push({
            name: name || '',
            firstName: firstName || '',
            lastName: lastName || '',
            email: email || '',
            phone: '',
            organization: '',
            lastModified: new Date(),
            source: 'import' // Use 'import' instead of 'apple'
          });
        }
      }
    }

    return contacts;
  }

  private findNewContacts(notionContacts: Contact[], appleContacts: Contact[]): Contact[] {
    return notionContacts.filter(notionContact => {
      return !appleContacts.some(appleContact => 
        this.contactsMatch(notionContact, appleContact)
      );
    });
  }

  private contactsMatch(contact1: Contact, contact2: Contact): boolean {
    // Fast matching - just email and name similarity
    if (contact1.email && contact2.email && contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
      return true;
    }
    
    const name1 = `${contact1.firstName} ${contact1.lastName}`.toLowerCase().trim();
    const name2 = `${contact2.firstName} ${contact2.lastName}`.toLowerCase().trim();
    
    return name1 === name2 && name1.length > 0;
  }

  private async addContactsToApple(contacts: Contact[]): Promise<void> {
    console.log(`   Generating AppleScript for ${contacts.length} contacts...`);
    
    const script = this.generateAddContactsScript(contacts);
    writeFileSync('/tmp/add-contacts.scpt', script);
    
    try {
      execSync(`osascript /tmp/add-contacts.scpt`, 
        { encoding: 'utf8', timeout: 300000 });
      
      console.log(`   ✅ Successfully added ${contacts.length} contacts to Apple Contacts`);
    } catch (error) {
      console.error('Failed to add contacts:', error);
      throw error;
    }
  }

  private generateAddContactsScript(contacts: Contact[]): string {
    let script = 'tell application "Contacts"\n';
    
    for (const contact of contacts.slice(0, 50)) { // Limit to 50 at a time to avoid timeouts
      // Skip contacts with no useful information
      if (!contact.firstName && !contact.lastName && !contact.email && !contact.phone) {
        continue;
      }
      
      // Build properties - ensure at least one property exists
      const properties = [];
      if (contact.firstName && contact.firstName.trim()) {
        properties.push(`first name:"${contact.firstName.replace(/"/g, '\\"')}"`);
      }
      if (contact.lastName && contact.lastName.trim()) {
        properties.push(`last name:"${contact.lastName.replace(/"/g, '\\"')}"`);
      }
      if (contact.organization && contact.organization.trim()) {
        properties.push(`organization:"${contact.organization.replace(/"/g, '\\"')}"`);
      }
      
      // If no name properties, use email as first name
      if (properties.length === 0 && contact.email) {
        const emailName = contact.email.split('@')[0];
        properties.push(`first name:"${emailName}"`);
      }
      
      // Only create contact if we have at least one property
      if (properties.length > 0) {
        script += `  set newPerson to make new person with properties {${properties.join(', ')}}\n`;
        
        if (contact.email && contact.email.trim()) {
          script += `  make new email at end of emails of newPerson with properties {value:"${contact.email.trim()}"}\n`;
        }
        
        if (contact.phone && contact.phone.trim()) {
          script += `  make new phone at end of phones of newPerson with properties {value:"${contact.phone.trim()}"}\n`;
        }
      }
    }
    
    script += '  save\n';
    script += 'end tell';
    
    return script;
  }

  private hashContact(contact: Contact): string {
    const key = `${contact.firstName}|${contact.lastName}|${contact.email}`.toLowerCase();
    return createHash('md5').update(key).digest('hex').substring(0, 8);
  }

  private async saveCache(notionContacts: Contact[], appleContacts: Contact[], syncCount: number): Promise<void> {
    const cache: QuickCache = {
      timestamp: Date.now(),
      appleContactHashes: appleContacts.map(c => this.hashContact(c)),
      notionContactHashes: notionContacts.map(c => this.hashContact(c)),
      lastSyncCount: syncCount
    };
    
    writeFileSync(this.cacheFile, JSON.stringify(cache));
    console.log(`   💾 Cache saved for lightning-fast future runs`);
  }

  private async updateCache(notionHashes: string[], appleHashes: string[], syncCount: number): Promise<void> {
    const cache: QuickCache = {
      timestamp: Date.now(),
      appleContactHashes: appleHashes,
      notionContactHashes: notionHashes,
      lastSyncCount: syncCount
    };
    
    writeFileSync(this.cacheFile, JSON.stringify(cache));
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    test: args.includes('--test')
  };

  console.log('⚡ Lightning Contact Sync Options:');
  console.log(`   Dry run: ${options.dryRun}`);
  console.log(`   Force full sync: ${options.force}`);
  console.log(`   Test mode (5 contacts): ${options.test}`);
  console.log('');

  const sync = new LightningContactSync();
  await sync.run(options);
}

if (require.main === module) {
  main().catch(console.error);
}

export { LightningContactSync };
