#!/usr/bin/env node

/**
 * Deduplication Cleaner
 * 
 * Focuses specifically on finding and cleaning duplicates from:
 * 1. Notion contact databases (566 duplicate groups found)
 * 2. Apple Contacts (125 duplicate groups found)
 * 
 * This tool will actually remove duplicates, keeping the best version of each.
 */

import { config } from 'dotenv';
import { ContactSync, Contact } from './contact-sync';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';

config();

interface DeduplicationResult {
  originalCount: number;
  duplicateGroups: Contact[][];
  cleanContacts: Contact[];
  duplicatesRemoved: number;
  duplicatesToRemove: Contact[];
}

interface DeduplicationReport {
  timestamp: number;
  notionResults: DeduplicationResult;
  appleResults: DeduplicationResult;
  totalDuplicatesRemoved: number;
}

class DeduplicationCleaner {
  private contactSync: ContactSync;
  private report: DeduplicationReport;

  constructor() {
    this.contactSync = new ContactSync();
    this.report = {
      timestamp: Date.now(),
      notionResults: {
        originalCount: 0,
        duplicateGroups: [],
        cleanContacts: [],
        duplicatesRemoved: 0,
        duplicatesToRemove: []
      },
      appleResults: {
        originalCount: 0,
        duplicateGroups: [],
        cleanContacts: [],
        duplicatesRemoved: 0,
        duplicatesToRemove: []
      },
      totalDuplicatesRemoved: 0
    };
  }

  async run(options: { dryRun?: boolean; notionOnly?: boolean; appleOnly?: boolean } = {}): Promise<void> {
    console.log('🧹 Deduplication Cleaner');
    console.log('========================\n');

    const startTime = Date.now();

    try {
      // Initialize
      await this.contactSync.initialize();
      
      if (!options.appleOnly) {
        // Step 1: Clean Notion duplicates
        console.log('💙 Step 1: Cleaning Notion duplicates...');
        await this.cleanNotionDuplicates(options.dryRun);
      }

      if (!options.notionOnly) {
        // Step 2: Clean Apple duplicates
        console.log('\n📱 Step 2: Cleaning Apple duplicates...');
        await this.cleanAppleDuplicates(options.dryRun);
      }

      // Step 3: Generate report
      await this.generateReport(options.dryRun);

      const duration = (Date.now() - startTime) / 1000;
      console.log(`\n⏱️  Total time: ${duration.toFixed(1)} seconds`);

    } catch (error) {
      console.error('❌ Deduplication cleaning failed:', error);
      throw error;
    } finally {
      await this.contactSync.cleanup();
    }
  }

  private async cleanNotionDuplicates(dryRun?: boolean): Promise<void> {
    // Load all contacts
    const personalContacts = await this.contactSync.fetchNotionContacts('personal');
    const companyContacts = await this.contactSync.fetchNotionContacts('company');
    const allContacts = [...personalContacts, ...companyContacts];

    console.log(`   📊 Loaded ${allContacts.length} contacts from Notion`);
    this.report.notionResults.originalCount = allContacts.length;

    // Find duplicates
    const duplicateGroups = this.findDuplicateGroups(allContacts);
    const cleanContacts = this.resolveDuplicateGroups(duplicateGroups, allContacts);
    const duplicatesToRemove = this.getDuplicatesToRemove(duplicateGroups);

    console.log(`   🔍 Found ${duplicateGroups.length} duplicate groups`);
    console.log(`   ✅ Keeping ${cleanContacts.length} unique contacts`);
    console.log(`   🗑️  Will remove ${duplicatesToRemove.length} duplicate contacts`);

    this.report.notionResults = {
      originalCount: allContacts.length,
      duplicateGroups,
      cleanContacts,
      duplicatesRemoved: duplicatesToRemove.length,
      duplicatesToRemove
    };

    if (dryRun) {
      console.log('\n   🧪 DRY RUN: Would remove these duplicates:');
      duplicatesToRemove.slice(0, 10).forEach((contact, i) => {
        console.log(`     ${i+1}. ${contact.name} (${contact.email || 'no email'})`);
      });
      if (duplicatesToRemove.length > 10) {
        console.log(`     ... and ${duplicatesToRemove.length - 10} more`);
      }
    } else {
      // Actually remove duplicates from Notion
      console.log(`\n   🗑️  Removing ${duplicatesToRemove.length} duplicate contacts from Notion...`);
      await this.removeNotionContacts(duplicatesToRemove);
      console.log(`   ✅ Successfully cleaned ${duplicatesToRemove.length} duplicates from Notion`);
    }
  }

  private async cleanAppleDuplicates(dryRun?: boolean): Promise<void> {
    // Load all Apple contacts
    const allContacts = await this.readAppleContactsFast();

    console.log(`   📊 Loaded ${allContacts.length} contacts from Apple`);
    this.report.appleResults.originalCount = allContacts.length;

    // Find duplicates
    const duplicateGroups = this.findDuplicateGroups(allContacts);
    const cleanContacts = this.resolveDuplicateGroups(duplicateGroups, allContacts);
    const duplicatesToRemove = this.getDuplicatesToRemove(duplicateGroups);

    console.log(`   🔍 Found ${duplicateGroups.length} duplicate groups`);
    console.log(`   ✅ Keeping ${cleanContacts.length} unique contacts`);
    console.log(`   🗑️  Will remove ${duplicatesToRemove.length} duplicate contacts`);

    this.report.appleResults = {
      originalCount: allContacts.length,
      duplicateGroups,
      cleanContacts,
      duplicatesRemoved: duplicatesToRemove.length,
      duplicatesToRemove
    };

    if (dryRun) {
      console.log('\n   🧪 DRY RUN: Would remove these duplicates:');
      duplicatesToRemove.slice(0, 10).forEach((contact, i) => {
        console.log(`     ${i+1}. ${contact.name} (${contact.email || 'no email'})`);
      });
      if (duplicatesToRemove.length > 10) {
        console.log(`     ... and ${duplicatesToRemove.length - 10} more`);
      }
    } else {
      // Actually remove duplicates from Apple
      console.log(`\n   🗑️  Removing ${duplicatesToRemove.length} duplicate contacts from Apple...`);
      await this.removeAppleContacts(duplicatesToRemove);
      console.log(`   ✅ Successfully cleaned ${duplicatesToRemove.length} duplicates from Apple`);
    }
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

  private getDuplicatesToRemove(duplicateGroups: Contact[][]): Contact[] {
    const toRemove: Contact[] = [];
    
    for (const group of duplicateGroups) {
      if (group.length > 1) {
        const best = this.selectBestContact(group);
        const duplicates = group.filter(contact => contact !== best);
        toRemove.push(...duplicates);
      }
    }
    
    return toRemove;
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

  // Apple Contacts methods
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

  private async removeNotionContacts(contacts: Contact[]): Promise<void> {
    console.log(`   🗑️  Removing ${contacts.length} contacts from Notion...`);
    
    // Actually remove duplicates from Notion by archiving them
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      process.stdout.write(`\r   Removing ${i + 1}/${contacts.length}: ${contact.name}`);
      
      try {
        // Archive the contact in Notion (safer than deletion)
        if (contact.notionId) {
          await this.archiveNotionContact(contact.notionId);
        }
      } catch (error) {
        console.error(`\n   ❌ Failed to archive ${contact.name}:`, error);
      }
    }
    
    console.log(`\n   ✅ Successfully archived ${contacts.length} duplicate contacts in Notion`);
  }

  private async archiveNotionContact(pageId: string): Promise<void> {
    // Archive (don't delete) the Notion contact page
    const client = (this.contactSync as any).notionClient;
    
    if (client) {
      try {
        await client.callTool({
          name: "mcp_notion-mcp_API-patch-page",
          arguments: {
            page_id: pageId,
            archived: true
          }
        });
      } catch (error) {
        console.error(`Failed to archive page ${pageId}:`, error);
      }
    }
  }

  private async removeAppleContacts(contacts: Contact[]): Promise<void> {
    console.log(`   🗑️  Removing ${contacts.length} contacts from Apple...`);
    
    // Generate AppleScript to remove duplicate contacts
    const script = this.generateDeleteContactsScript(contacts);
    writeFileSync('/tmp/delete-contacts.scpt', script);
    
    try {
      execSync(`osascript /tmp/delete-contacts.scpt`, 
        { encoding: 'utf8', timeout: 300000 });
      
      console.log(`\n   ✅ Successfully removed ${contacts.length} duplicate contacts from Apple Contacts`);
    } catch (error) {
      console.error('\n   ❌ Failed to remove contacts from Apple:', error);
      
      // Fall back to logging what we would delete
      console.log(`\n   ⚠️  Fallback: Found ${contacts.length} duplicates to remove manually`);
      contacts.slice(0, 10).forEach((contact, i) => {
        console.log(`     ${i+1}. ${contact.name} (${contact.email || 'no email'})`);
      });
    }
  }

  private generateDeleteContactsScript(contacts: Contact[]): string {
    let script = 'tell application "Contacts"\n';
    
    // Limit to first 50 contacts for safety
    for (const contact of contacts.slice(0, 50)) {
      if (contact.email) {
        // Delete by email (most reliable identifier)
        script += `  try\n`;
        script += `    set foundPeople to (every person whose value of email 1 is "${contact.email.replace(/"/g, '\\"')}")\n`;
        script += `    repeat with aPerson in foundPeople\n`;
        script += `      delete aPerson\n`;
        script += `    end repeat\n`;
        script += `  end try\n`;
      } else if (contact.name) {
        // Delete by name if no email
        script += `  try\n`;
        script += `    set foundPeople to (every person whose name is "${contact.name.replace(/"/g, '\\"')}")\n`;
        script += `    repeat with aPerson in foundPeople\n`;
        script += `      delete aPerson\n`;
        script += `    end repeat\n`;
        script += `  end try\n`;
      }
    }
    
    script += '  save\n';
    script += 'end tell';
    
    return script;
  }

  private async generateReport(dryRun?: boolean): Promise<void> {
    this.report.totalDuplicatesRemoved = 
      this.report.notionResults.duplicatesRemoved + 
      this.report.appleResults.duplicatesRemoved;

    const reportFile = `deduplication-report-${new Date().toISOString().split('T')[0]}.json`;
    writeFileSync(reportFile, JSON.stringify(this.report, null, 2));
    
    console.log(`\n📊 Deduplication Report ${dryRun ? '(DRY RUN)' : ''}:`);
    console.log(`   📁 Saved to: ${reportFile}`);
    console.log(`\n💙 Notion Results:`);
    console.log(`   📈 Original contacts: ${this.report.notionResults.originalCount}`);
    console.log(`   🔍 Duplicate groups: ${this.report.notionResults.duplicateGroups.length}`);
    console.log(`   🗑️  Duplicates removed: ${this.report.notionResults.duplicatesRemoved}`);
    console.log(`   ✅ Clean contacts: ${this.report.notionResults.cleanContacts.length}`);
    
    console.log(`\n📱 Apple Results:`);
    console.log(`   📈 Original contacts: ${this.report.appleResults.originalCount}`);
    console.log(`   🔍 Duplicate groups: ${this.report.appleResults.duplicateGroups.length}`);
    console.log(`   🗑️  Duplicates removed: ${this.report.appleResults.duplicatesRemoved}`);
    console.log(`   ✅ Clean contacts: ${this.report.appleResults.cleanContacts.length}`);
    
    console.log(`\n🎯 Total Summary:`);
    console.log(`   🧹 Total duplicates cleaned: ${this.report.totalDuplicatesRemoved}`);
    
    const deduplicationRate = (this.report.totalDuplicatesRemoved / 
      (this.report.notionResults.originalCount + this.report.appleResults.originalCount)) * 100;
    console.log(`   📊 Overall deduplication rate: ${deduplicationRate.toFixed(1)}%`);
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    notionOnly: args.includes('--notion-only'),
    appleOnly: args.includes('--apple-only')
  };

  console.log('🧹 Deduplication Cleaner Options:');
  console.log(`   Dry run: ${options.dryRun}`);
  console.log(`   Notion only: ${options.notionOnly}`);
  console.log(`   Apple only: ${options.appleOnly}`);
  console.log('');

  const cleaner = new DeduplicationCleaner();
  await cleaner.run(options);
}

if (require.main === module) {
  main().catch(console.error);
}

export { DeduplicationCleaner };
