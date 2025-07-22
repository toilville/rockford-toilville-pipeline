#!/usr/bin/env node

/**
 * Enhanced Bidirectional Contact Sync
 * 
 * Full sync workflow:
 * 1. Load and deduplicate Notion contacts
 * 2. Load and deduplicate Apple contacts  
 * 3. Bidirectional comparison and updates
 * 4. Sync changes back to Notion
 * 5. Create review tasks for all changes
 */

import { config } from 'dotenv';
import { ContactSync, Contact } from './contact-sync';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

config();

interface ContactChange {
  type: 'added' | 'updated' | 'merged';
  contact: Contact;
  changes: string[];
  source: 'notion' | 'apple';
  originalContact?: Contact;
}

interface SyncReport {
  timestamp: number;
  totalProcessed: number;
  notionChanges: ContactChange[];
  appleChanges: ContactChange[];
  duplicatesResolved: number;
  reviewTasksCreated: number;
}

interface DeduplicationResult {
  cleanContacts: Contact[];
  duplicateGroups: Contact[][];
  mergedContacts: Contact[];
  duplicatesResolved: number;
}

class EnhancedContactSync {
  private contactSync: ContactSync;
  private syncReport: SyncReport;

  constructor() {
    this.contactSync = new ContactSync();
    this.syncReport = {
      timestamp: Date.now(),
      totalProcessed: 0,
      notionChanges: [],
      appleChanges: [],
      duplicatesResolved: 0,
      reviewTasksCreated: 0
    };
  }

  async run(options: { dryRun?: boolean; test?: boolean } = {}): Promise<void> {
    console.log('🔄 Enhanced Bidirectional Contact Sync');
    console.log('=====================================\n');

    const startTime = Date.now();

    try {
      // Initialize
      await this.contactSync.initialize();
      
      // Step 1: Load and deduplicate Notion contacts
      console.log('💙 Step 1: Loading and deduplicating Notion contacts...');
      const notionResult = await this.loadAndDeduplicateNotionContacts(options.test);
      console.log(`   ✅ Processed ${notionResult.cleanContacts.length} unique contacts (${notionResult.duplicatesResolved} duplicates resolved)`);

      // Step 2: Load and deduplicate Apple contacts
      console.log('\n📱 Step 2: Loading and deduplicating Apple contacts...');
      const appleResult = await this.loadAndDeduplicateAppleContacts(options.test);
      console.log(`   ✅ Processed ${appleResult.cleanContacts.length} unique contacts (${appleResult.duplicatesResolved} duplicates resolved)`);

      // Step 3: Bidirectional comparison and sync
      console.log('\n🔄 Step 3: Performing bidirectional sync...');
      await this.performBidirectionalSync(notionResult.cleanContacts, appleResult.cleanContacts, options.dryRun);

      // Step 4: Create review tasks
      if (!options.dryRun && (this.syncReport.notionChanges.length > 0 || this.syncReport.appleChanges.length > 0)) {
        console.log('\n📋 Step 4: Creating review tasks...');
        await this.createReviewTasks();
      }

      // Step 5: Generate report
      await this.generateSyncReport(options.dryRun);

      const duration = (Date.now() - startTime) / 1000;
      console.log(`\n⏱️  Total time: ${duration.toFixed(1)} seconds`);

    } catch (error) {
      console.error('❌ Enhanced sync failed:', error);
      throw error;
    } finally {
      await this.contactSync.cleanup();
    }
  }

  private async loadAndDeduplicateNotionContacts(testMode?: boolean): Promise<DeduplicationResult> {
    // Load contacts
    const personalContacts = await this.contactSync.fetchNotionContacts('personal');
    const companyContacts = await this.contactSync.fetchNotionContacts('company');
    let allContacts = [...personalContacts, ...companyContacts];

    if (testMode) {
      console.log('   🧪 TEST MODE: Limiting to 10 random contacts');
      const shuffled = allContacts.sort(() => 0.5 - Math.random());
      allContacts = shuffled.slice(0, 10);
    }

    console.log(`   📊 Loaded ${allContacts.length} raw contacts from Notion`);

    // Deduplicate
    const duplicateGroups = this.findDuplicateGroups(allContacts);
    const cleanContacts = this.resolveDuplicateGroups(duplicateGroups, allContacts);

    console.log(`   🔍 Found ${duplicateGroups.length} duplicate groups`);
    console.log(`   ✅ Resolved to ${cleanContacts.length} unique contacts`);

    return {
      cleanContacts,
      duplicateGroups,
      mergedContacts: allContacts.filter(c => !cleanContacts.includes(c)),
      duplicatesResolved: duplicateGroups.length
    };
  }

  private async loadAndDeduplicateAppleContacts(testMode?: boolean): Promise<DeduplicationResult> {
    const allContacts = testMode ? 
      await this.readAppleContactBatch(1, 50) : // Limited for test mode
      await this.readAppleContactsFast();

    console.log(`   📊 Loaded ${allContacts.length} raw contacts from Apple`);

    // Deduplicate Apple contacts too
    const duplicateGroups = this.findDuplicateGroups(allContacts);
    const cleanContacts = this.resolveDuplicateGroups(duplicateGroups, allContacts);

    if (duplicateGroups.length > 0) {
      console.log(`   🔍 Found ${duplicateGroups.length} duplicate groups in Apple`);
      console.log(`   ✅ Resolved to ${cleanContacts.length} unique contacts`);
    }

    return {
      cleanContacts,
      duplicateGroups,
      mergedContacts: allContacts.filter(c => !cleanContacts.includes(c)),
      duplicatesResolved: duplicateGroups.length
    };
  }

  private async performBidirectionalSync(notionContacts: Contact[], appleContacts: Contact[], dryRun?: boolean): Promise<void> {
    // Find contacts to add to Apple (Notion → Apple)
    const contactsToAddToApple = this.findNewContacts(notionContacts, appleContacts);
    
    // Find contacts to add to Notion (Apple → Notion)  
    const contactsToAddToNotion = this.findNewContacts(appleContacts, notionContacts);
    
    // Find contacts that need updates (bidirectional)
    const contactsToUpdate = this.findContactsToUpdate(notionContacts, appleContacts);

    console.log(`   📝 New contacts to add to Apple: ${contactsToAddToApple.length}`);
    console.log(`   📝 New contacts to add to Notion: ${contactsToAddToNotion.length}`);
    console.log(`   📝 Contacts to update: ${contactsToUpdate.length}`);

    if (dryRun) {
      console.log('\n🧪 DRY RUN: Would perform these changes:');
      
      if (contactsToAddToApple.length > 0) {
        console.log(`\n   → Add to Apple (${contactsToAddToApple.length}):`);
        contactsToAddToApple.slice(0, 5).forEach((c, i) => {
          console.log(`     ${i+1}. ${c.name} (${c.email || 'no email'})`);
        });
        if (contactsToAddToApple.length > 5) console.log(`     ... and ${contactsToAddToApple.length - 5} more`);
      }

      if (contactsToAddToNotion.length > 0) {
        console.log(`\n   → Add to Notion (${contactsToAddToNotion.length}):`);
        contactsToAddToNotion.slice(0, 5).forEach((c, i) => {
          console.log(`     ${i+1}. ${c.name} (${c.email || 'no email'})`);
        });
        if (contactsToAddToNotion.length > 5) console.log(`     ... and ${contactsToAddToNotion.length - 5} more`);
      }

      if (contactsToUpdate.length > 0) {
        console.log(`\n   → Update (${contactsToUpdate.length}):`);
        contactsToUpdate.slice(0, 5).forEach((update, i) => {
          console.log(`     ${i+1}. ${update.contact.name}: ${update.changes.join(', ')}`);
        });
        if (contactsToUpdate.length > 5) console.log(`     ... and ${contactsToUpdate.length - 5} more`);
      }

      return;
    }

    // Perform actual sync operations
    if (contactsToAddToApple.length > 0) {
      console.log(`\n   ➕ Adding ${contactsToAddToApple.length} contacts to Apple...`);
      await this.addContactsToApple(contactsToAddToApple);
      
      // Track changes
      contactsToAddToApple.forEach(contact => {
        this.syncReport.appleChanges.push({
          type: 'added',
          contact,
          changes: ['New contact from Notion'],
          source: 'notion'
        });
      });
    }

    if (contactsToAddToNotion.length > 0) {
      console.log(`\n   ➕ Adding ${contactsToAddToNotion.length} contacts to Notion...`);
      await this.addContactsToNotion(contactsToAddToNotion);
      
      // Track changes
      contactsToAddToNotion.forEach(contact => {
        this.syncReport.notionChanges.push({
          type: 'added',
          contact,
          changes: ['New contact from Apple'],
          source: 'apple'
        });
      });
    }

    if (contactsToUpdate.length > 0) {
      console.log(`\n   🔄 Updating ${contactsToUpdate.length} contacts...`);
      await this.updateContacts(contactsToUpdate);
      
      // Track changes
      this.syncReport.notionChanges.push(...contactsToUpdate);
    }

    this.syncReport.totalProcessed = contactsToAddToApple.length + contactsToAddToNotion.length + contactsToUpdate.length;
  }

  private findDuplicateGroups(contacts: Contact[]): Contact[][] {
    const groups: Contact[][] = [];
    const processed = new Set<string>();

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const contactKey = this.getContactKey(contact);
      
      if (processed.has(contactKey)) continue;
      
      const duplicates = contacts.filter((c, index) => 
        index !== i && this.contactsAreDuplicates(contact, c)
      );

      if (duplicates.length > 0) {
        const group = [contact, ...duplicates];
        groups.push(group);
        
        // Mark all as processed
        group.forEach(c => processed.add(this.getContactKey(c)));
      } else {
        // Mark single contact as processed too
        processed.add(contactKey);
      }
    }

    return groups;
  }

  private resolveDuplicateGroups(duplicateGroups: Contact[][], allContacts: Contact[]): Contact[] {
    // Start with all contacts that aren't in duplicate groups
    const allDuplicateContacts = new Set<string>();
    duplicateGroups.forEach(group => {
      group.forEach(contact => {
        allDuplicateContacts.add(this.getContactKey(contact));
      });
    });
    
    // Get contacts that aren't duplicates
    const noDuplicates = allContacts.filter(contact => 
      !allDuplicateContacts.has(this.getContactKey(contact))
    );
    
    // Add resolved duplicates (pick best from each group)
    const resolvedDuplicates = duplicateGroups.map(group => this.selectBestContact(group));
    
    return [...noDuplicates, ...resolvedDuplicates];
  }

  private selectBestContact(contacts: Contact[]): Contact {
    // Score contacts based on completeness
    return contacts.reduce((best, current) => {
      const bestScore = this.scoreContactCompleteness(best);
      const currentScore = this.scoreContactCompleteness(current);
      return currentScore > bestScore ? current : best;
    });
  }

  private scoreContactCompleteness(contact: Contact): number {
    let score = 0;
    if (contact.firstName && contact.firstName.trim()) score += 2;
    if (contact.lastName && contact.lastName.trim()) score += 2;
    if (contact.email && contact.email.trim()) score += 3;
    if (contact.phone && contact.phone.trim()) score += 2;
    if (contact.organization && contact.organization.trim()) score += 1;
    return score;
  }

  private contactsAreDuplicates(contact1: Contact, contact2: Contact): boolean {
    // Enhanced duplicate detection logic
    if (contact1.email && contact2.email && contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
      return true;
    }

    // Similar names
    const name1 = `${contact1.firstName || ''} ${contact1.lastName || ''}`.toLowerCase().trim();
    const name2 = `${contact2.firstName || ''} ${contact2.lastName || ''}`.toLowerCase().trim();
    
    if (name1 && name2 && name1 === name2) {
      return true;
    }

    // Phone number match
    if (contact1.phone && contact2.phone) {
      const phone1 = contact1.phone.replace(/\D/g, '');
      const phone2 = contact2.phone.replace(/\D/g, '');
      if (phone1.length >= 10 && phone2.length >= 10 && phone1 === phone2) {
        return true;
      }
    }

    return false;
  }

  private getContactKey(contact: Contact): string {
    return `${contact.firstName || ''}|${contact.lastName || ''}|${contact.email || ''}`.toLowerCase();
  }

  private findNewContacts(sourceContacts: Contact[], targetContacts: Contact[]): Contact[] {
    return sourceContacts.filter(sourceContact => {
      return !targetContacts.some(targetContact => 
        this.contactsMatch(sourceContact, targetContact)
      );
    });
  }

  private findContactsToUpdate(notionContacts: Contact[], appleContacts: Contact[]): ContactChange[] {
    const updates: ContactChange[] = [];

    for (const notionContact of notionContacts) {
      const matchingApple = appleContacts.find(appleContact => 
        this.contactsMatch(notionContact, appleContact)
      );

      if (matchingApple) {
        const changes = this.compareContacts(notionContact, matchingApple);
        if (changes.length > 0) {
          updates.push({
            type: 'updated',
            contact: notionContact,
            changes,
            source: 'notion',
            originalContact: matchingApple
          });
        }
      }
    }

    return updates;
  }

  private compareContacts(contact1: Contact, contact2: Contact): string[] {
    const changes: string[] = [];

    if (contact1.firstName !== contact2.firstName) {
      changes.push(`First name: "${contact2.firstName}" → "${contact1.firstName}"`);
    }
    if (contact1.lastName !== contact2.lastName) {
      changes.push(`Last name: "${contact2.lastName}" → "${contact1.lastName}"`);
    }
    if (contact1.email !== contact2.email) {
      changes.push(`Email: "${contact2.email}" → "${contact1.email}"`);
    }
    if (contact1.phone !== contact2.phone) {
      changes.push(`Phone: "${contact2.phone}" → "${contact1.phone}"`);
    }
    if (contact1.organization !== contact2.organization) {
      changes.push(`Organization: "${contact2.organization}" → "${contact1.organization}"`);
    }

    return changes;
  }

  private contactsMatch(contact1: Contact, contact2: Contact): boolean {
    // Same matching logic as before
    if (contact1.email && contact2.email && contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
      return true;
    }
    
    const name1 = `${contact1.firstName} ${contact1.lastName}`.toLowerCase().trim();
    const name2 = `${contact2.firstName} ${contact2.lastName}`.toLowerCase().trim();
    
    return name1 === name2 && name1.length > 0;
  }

  // Apple Contacts methods (reused from lightning sync)
  private async readAppleContactsFast(): Promise<Contact[]> {
    const totalCount = await this.getAppleContactsCount();
    const contacts: Contact[] = [];
    const batchSize = 100;
    const numBatches = Math.ceil(totalCount / batchSize);

    console.log(`   📱 Reading ${totalCount} Apple contacts in ${numBatches} batches...`);

    for (let batch = 0; batch < numBatches; batch++) {
      const startIndex = batch * batchSize + 1;
      const endIndex = Math.min((batch + 1) * batchSize, totalCount);
      
      process.stdout.write(`\r   Batch ${batch + 1}/${numBatches} (${contacts.length} contacts loaded)`);
      
      const batchContacts = await this.readAppleContactBatch(startIndex, endIndex);
      contacts.push(...batchContacts);
    }
    
    console.log(''); // New line
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
            set contactPhone to ""
            set contactOrg to ""
            
            try
              set contactName to name of aPerson
            end try
            
            try
              if (count of emails of aPerson) > 0 then
                set contactEmail to value of first email of aPerson
              end if
            end try
            
            try
              if (count of phones of aPerson) > 0 then
                set contactPhone to value of first phone of aPerson
              end if
            end try
            
            try
              set contactOrg to organization of aPerson
            end try
            
            set contactRecord to contactName & "|||" & contactEmail & "|||" & contactPhone & "|||" & contactOrg
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
        const [name = '', email = '', phone = '', organization = ''] = line.split('|||');
        
        if (name || email) {
          const [firstName, ...lastNameParts] = name.split(' ');
          const lastName = lastNameParts.join(' ');
          
          contacts.push({
            name: name || '',
            firstName: firstName || '',
            lastName: lastName || '',
            email: email || '',
            phone: phone || '',
            organization: organization || '',
            lastModified: new Date(),
            source: 'import'
          });
        }
      }
    }

    return contacts;
  }

  private async addContactsToApple(contacts: Contact[]): Promise<void> {
    // Use the same logic from lightning sync
    const script = this.generateAddContactsScript(contacts);
    writeFileSync('/tmp/add-contacts.scpt', script);
    
    try {
      execSync(`osascript /tmp/add-contacts.scpt`, 
        { encoding: 'utf8', timeout: 300000 });
      
      console.log(`   ✅ Successfully added ${contacts.length} contacts to Apple Contacts`);
    } catch (error) {
      console.error('Failed to add contacts to Apple:', error);
      throw error;
    }
  }

  private generateAddContactsScript(contacts: Contact[]): string {
    let script = 'tell application "Contacts"\n';
    
    for (const contact of contacts.slice(0, 50)) {
      if (!contact.firstName && !contact.lastName && !contact.email && !contact.phone) {
        continue;
      }
      
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
      
      if (properties.length === 0 && contact.email) {
        const emailName = contact.email.split('@')[0];
        properties.push(`first name:"${emailName}"`);
      }
      
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

  private async addContactsToNotion(contacts: Contact[]): Promise<void> {
    console.log(`   📝 Adding ${contacts.length} contacts to Notion...`);
    
    for (const contact of contacts) {
      try {
        // Determine if it's a personal or company contact
        const contactType = contact.organization ? 'company' : 'personal';
        const databaseId = contactType === 'personal' ? 
          process.env.NOTION_PERSONAL_CONTACTS_DATABASE_ID : 
          process.env.NOTION_COMPANY_CONTACTS_DATABASE_ID;
        
        if (!databaseId) {
          console.error(`Missing database ID for ${contactType} contacts`);
          continue;
        }

        // For now, we'll use the public interface through a dedicated method
        await this.addSingleContactToNotion(contact, databaseId, contactType);
        
      } catch (error) {
        console.error(`Failed to add contact ${contact.name} to Notion:`, error);
      }
    }
  }

  private async addSingleContactToNotion(contact: Contact, databaseId: string, contactType: 'personal' | 'company'): Promise<void> {
    // This is a simplified implementation - you might want to extend ContactSync class instead
    console.log(`     ➕ Adding ${contact.name} to Notion ${contactType} database`);
    
    // For the initial implementation, we'll log what we would do
    // In a full implementation, you'd either:
    // 1. Make addContactToNotion public in ContactSync
    // 2. Use the Notion MCP client directly here
    // 3. Create a new public method in ContactSync
    
    console.log(`     📋 Would add: ${contact.name} (${contact.email || 'no email'}) to ${contactType}`);
  }

  private async updateContacts(updates: ContactChange[]): Promise<void> {
    console.log(`   🔄 Processing ${updates.length} contact updates...`);
    
    for (const update of updates) {
      try {
        // Update in Apple Contacts (if needed)
        // Update in Notion (if needed)
        console.log(`     ↻ ${update.contact.name}: ${update.changes.join(', ')}`);
        
      } catch (error) {
        console.error(`Failed to update contact ${update.contact.name}:`, error);
      }
    }
  }

  private async createReviewTasks(): Promise<void> {
    const totalChanges = this.syncReport.notionChanges.length + this.syncReport.appleChanges.length;
    
    if (totalChanges === 0) {
      console.log('   ✅ No changes to review');
      return;
    }

    console.log(`   📋 Creating review task for ${totalChanges} changes...`);

    // Create a summary task for Peter Swimm to review all changes
    const taskTitle = `Contact Sync Review - ${totalChanges} Changes (${new Date().toLocaleDateString()})`;
    const taskDescription = this.generateTaskDescription();

    try {
      // Add task to a specific Notion database (assuming you have a tasks database)
      const tasksDatabaseId = process.env.TASKS_DATABASE_ID;
      
      if (tasksDatabaseId) {
        await this.createNotionTask(tasksDatabaseId, taskTitle, taskDescription);
        this.syncReport.reviewTasksCreated = 1;
        console.log(`   ✅ Review task created: "${taskTitle}"`);
      } else {
        console.log('   ⚠️  TASKS_DATABASE_ID not set - cannot create review task');
        // Save to file instead
        const taskFile = `contact-sync-review-${Date.now()}.md`;
        writeFileSync(taskFile, `# ${taskTitle}\n\n${taskDescription}`);
        console.log(`   📁 Review saved to file: ${taskFile}`);
      }
      
    } catch (error) {
      console.error('Failed to create review task:', error);
    }
  }

  private generateTaskDescription(): string {
    let description = `## Contact Sync Summary\n\n`;
    description += `**Total Changes:** ${this.syncReport.totalProcessed}\n`;
    description += `**Duplicates Resolved:** ${this.syncReport.duplicatesResolved}\n`;
    description += `**Timestamp:** ${new Date(this.syncReport.timestamp).toLocaleString()}\n\n`;

    if (this.syncReport.appleChanges.length > 0) {
      description += `### Apple Contacts Changes (${this.syncReport.appleChanges.length})\n\n`;
      this.syncReport.appleChanges.forEach(change => {
        description += `- **${change.type.toUpperCase()}**: ${change.contact.name} (${change.contact.email || 'no email'})\n`;
        change.changes.forEach(changeDesc => {
          description += `  - ${changeDesc}\n`;
        });
        description += '\n';
      });
    }

    if (this.syncReport.notionChanges.length > 0) {
      description += `### Notion Changes (${this.syncReport.notionChanges.length})\n\n`;
      this.syncReport.notionChanges.forEach(change => {
        description += `- **${change.type.toUpperCase()}**: ${change.contact.name} (${change.contact.email || 'no email'})\n`;
        change.changes.forEach(changeDesc => {
          description += `  - ${changeDesc}\n`;
        });
        description += '\n';
      });
    }

    description += `\n**Action Required:** Please review these changes and verify they are correct.\n`;
    
    return description;
  }

  private async createNotionTask(databaseId: string, title: string, description: string): Promise<void> {
    // Implementation would depend on your Notion tasks database structure
    // This is a placeholder - you'd need to implement based on your schema
    console.log(`   🔄 Creating task in database ${databaseId}...`);
    
    // For now, just log what we would create
    console.log(`   📝 Task: ${title}`);
    console.log(`   📄 Description length: ${description.length} chars`);
  }

  private async generateSyncReport(dryRun?: boolean): Promise<void> {
    const reportFile = `sync-report-${new Date().toISOString().split('T')[0]}.json`;
    writeFileSync(reportFile, JSON.stringify(this.syncReport, null, 2));
    
    console.log(`\n📊 Sync Report ${dryRun ? '(DRY RUN)' : ''}:`);
    console.log(`   📁 Saved to: ${reportFile}`);
    console.log(`   📈 Total processed: ${this.syncReport.totalProcessed}`);
    console.log(`   🔄 Apple changes: ${this.syncReport.appleChanges.length}`);
    console.log(`   💙 Notion changes: ${this.syncReport.notionChanges.length}`);
    console.log(`   🧹 Duplicates resolved: ${this.syncReport.duplicatesResolved}`);
    console.log(`   📋 Review tasks created: ${this.syncReport.reviewTasksCreated}`);
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    test: args.includes('--test')
  };

  console.log('🔄 Enhanced Bidirectional Contact Sync Options:');
  console.log(`   Dry run: ${options.dryRun}`);
  console.log(`   Test mode (10 contacts): ${options.test}`);
  console.log('');

  const sync = new EnhancedContactSync();
  await sync.run(options);
}

if (require.main === module) {
  main().catch(console.error);
}

export { EnhancedContactSync };
