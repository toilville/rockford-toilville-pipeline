#!/usr/bin/env node

/**
 * Safe Apple Contacts Sync Strategy
 * 
 * This script helps you safely sync contacts without polluting Apple Contacts:
 * 1. First export existing Apple contacts to analyze what's already there
 * 2. Compare with our deduplicated Notion contacts 
 * 3. Only add contacts that are genuinely new
 * 4. Provide backup and rollback options
 */

import { config } from 'dotenv';
import { ContactSync, Contact } from './src/contact-sync';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';

// Load environment variables
config();

interface SafeSyncReport {
  existingAppleContacts: number;
  notionContactsAnalyzed: number;
  duplicateGroups: number;
  contactsToAdd: Contact[];
  contactsAlreadyInApple: Contact[];
  potentialConflicts: Array<{
    notion: Contact;
    apple: any;
    reason: string;
  }>;
}

class SafeAppleSync {
  private contactSync: ContactSync;
  private report: SafeSyncReport;

  constructor() {
    this.contactSync = new ContactSync();
    this.report = {
      existingAppleContacts: 0,
      notionContactsAnalyzed: 0,
      duplicateGroups: 0,
      contactsToAdd: [],
      contactsAlreadyInApple: [],
      potentialConflicts: []
    };
  }

  async run(): Promise<void> {
    console.log('🛡️ Safe Apple Contacts Sync Analysis');
    console.log('====================================\n');

    try {
      // Step 1: Export current Apple Contacts for analysis
      console.log('📤 Step 1: Exporting current Apple Contacts...');
      const appleContacts = await this.exportAppleContacts();
      this.report.existingAppleContacts = appleContacts.length;
      console.log(`   Found ${appleContacts.length} existing contacts in Apple`);

      // Step 2: Get our cleaned Notion contacts
      console.log('\n📊 Step 2: Analyzing Notion contacts...');
      await this.contactSync.initialize();
      
      const personalContacts = await this.contactSync.fetchNotionContacts('personal');
      const companyContacts = await this.contactSync.fetchNotionContacts('company');
      const allNotionContacts = [...personalContacts, ...companyContacts];
      this.report.notionContactsAnalyzed = allNotionContacts.length;
      
      console.log(`   Raw Notion contacts: ${allNotionContacts.length}`);

      // Step 3: Remove duplicates from Notion contacts
      console.log('\n🔍 Step 3: Removing duplicates from Notion contacts...');
      const uniqueNotionContacts = this.removeDuplicatesKeepBest(allNotionContacts);
      console.log(`   Unique Notion contacts after deduplication: ${uniqueNotionContacts.length}`);
      console.log(`   Removed ${allNotionContacts.length - uniqueNotionContacts.length} duplicates`);

      // Step 4: Compare with Apple contacts
      console.log('\n🔍 Step 4: Comparing with existing Apple contacts...');
      this.analyzeContactConflicts(uniqueNotionContacts, appleContacts);

      // Step 5: Generate safe sync report
      console.log('\n📋 Step 5: Generating safe sync recommendations...');
      this.generateSafeSyncReport();

    } catch (error) {
      console.error('❌ Error during safe sync analysis:', error);
      throw error;
    } finally {
      await this.contactSync.cleanup();
    }
  }

  private async exportAppleContacts(): Promise<any[]> {
    console.log('   🍎 Creating lightweight Apple Contacts export...');
    
    // Create a simpler, faster AppleScript that just gets basic info
    const simpleExportScript = `
      tell application "Contacts"
        set contactsList to {}
        set totalContacts to count of every person
        
        repeat with i from 1 to totalContacts
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
          
          if contactName is not "" or contactEmail is not "" then
            set contactRecord to contactName & "|||" & contactEmail
            set contactsList to contactsList & {contactRecord}
          end if
          
          -- Progress indicator for large contact lists
          if i mod 100 = 0 then
            log "Processed " & i & " of " & totalContacts & " contacts"
          end if
        end repeat
        
        return contactsList
      end tell
    `;

    try {
      const exportFile = `export-apple-contacts-${new Date().toISOString().split('T')[0]}.scpt`;
      writeFileSync(exportFile, simpleExportScript);
      
      console.log(`   📝 Saved export script: ${exportFile}`);
      console.log('   💡 You can run this manually if needed: osascript "' + exportFile + '"');
      
      console.log('   ⏳ Running export (this may take a few minutes for large contact lists)...');
      
      const result = execSync(`osascript "${exportFile}"`, { 
        encoding: 'utf8',
        timeout: 300000, // 5 minutes
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      const contacts = this.parseAppleExportResult(result);
      console.log(`   ✅ Successfully exported ${contacts.length} Apple contacts`);
      
      // Save to file for future reference
      const backupFile = `apple-contacts-backup-${new Date().toISOString().split('T')[0]}.json`;
      writeFileSync(backupFile, JSON.stringify(contacts, null, 2));
      console.log(`   💾 Backup saved: ${backupFile}`);
      
      return contacts;
      
    } catch (error) {
      console.error('   ⚠️ Apple Contacts export failed:', error instanceof Error ? error.message : String(error));
      console.log('\n   🔧 MANUAL BACKUP RECOMMENDED:');
      console.log('   1. Open Apple Contacts app');
      console.log('   2. Select All (Cmd+A)');
      console.log('   3. File > Export > Export vCard...');
      console.log('   4. Save as backup before proceeding');
      
      // Return empty array to continue analysis
      return [];
    }
  }

  private parseAppleExportResult(result: string): any[] {
    const contacts: any[] = [];
    const lines = result.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const parts = line.split('|||');
      if (parts.length >= 2) {
        contacts.push({
          name: parts[0]?.trim() || '',
          email: parts[1]?.trim() || ''
        });
      }
    }
    
    return contacts;
  }

  private removeDuplicatesKeepBest(contacts: Contact[]): Contact[] {
    const duplicateGroups = this.findDuplicateGroups(contacts);
    this.report.duplicateGroups = duplicateGroups.length;
    
    const uniqueContacts: Contact[] = [];
    const processed = new Set<string>();
    
    // Add best contact from each duplicate group
    for (const group of duplicateGroups) {
      const bestContact = this.selectBestContact(group.contacts);
      uniqueContacts.push(bestContact);
      group.contacts.forEach(c => processed.add(c.id || ''));
    }
    
    // Add non-duplicate contacts
    for (const contact of contacts) {
      if (!processed.has(contact.id || '')) {
        uniqueContacts.push(contact);
      }
    }
    
    return uniqueContacts;
  }

  private findDuplicateGroups(contacts: Contact[]): Array<{contacts: Contact[]}> {
    const groups: Array<{contacts: Contact[]}> = [];
    const processed = new Set<string>();

    for (const contact of contacts) {
      if (processed.has(contact.id || '')) continue;

      const duplicates = contacts.filter(other => 
        other.id !== contact.id &&
        !processed.has(other.id || '') &&
        this.areContactsDuplicate(contact, other)
      );

      if (duplicates.length > 0) {
        const groupContacts = [contact, ...duplicates];
        groups.push({ contacts: groupContacts });
        groupContacts.forEach(c => processed.add(c.id || ''));
      }
    }

    return groups;
  }

  private areContactsDuplicate(contact1: Contact, contact2: Contact): boolean {
    // Simplified duplicate detection for safety
    
    // Same email = definitely duplicate
    if (contact1.email && contact2.email && 
        contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
      return true;
    }
    
    // Same name and similar other properties
    if (contact1.name && contact2.name) {
      const name1 = this.normalizeName(contact1.name);
      const name2 = this.normalizeName(contact2.name);
      
      if (name1 === name2 && name1.length > 2) {
        // Same name - check if other properties suggest it's the same person
        const orgMatch = contact1.organization && contact2.organization &&
          this.normalizeName(contact1.organization) === this.normalizeName(contact2.organization);
        
        const phoneMatch = contact1.phone && contact2.phone &&
          contact1.phone.replace(/\D/g, '') === contact2.phone.replace(/\D/g, '');
          
        // If same name and at least one other property matches, it's a duplicate
        return orgMatch || phoneMatch || (!contact1.email && !contact2.email);
      }
    }
    
    return false;
  }

  private normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  }

  private selectBestContact(contacts: Contact[]): Contact {
    // Select the contact with the most complete information
    let best = contacts[0];
    let bestScore = this.calculateCompletenessScore(best);
    
    for (const contact of contacts.slice(1)) {
      const score = this.calculateCompletenessScore(contact);
      if (score > bestScore) {
        best = contact;
        bestScore = score;
      }
    }
    
    return best;
  }

  private calculateCompletenessScore(contact: Contact): number {
    let score = 0;
    if (contact.name && contact.name.length > 2) score += 2;
    if (contact.email) score += 3;
    if (contact.phone) score += 2;
    if (contact.organization) score += 1;
    if (contact.firstName) score += 1;
    if (contact.lastName) score += 1;
    return score;
  }

  private analyzeContactConflicts(notionContacts: Contact[], appleContacts: any[]): void {
    for (const notionContact of notionContacts) {
      let foundInApple = false;
      
      for (const appleContact of appleContacts) {
        if (this.contactsMatch(notionContact, appleContact)) {
          foundInApple = true;
          this.report.contactsAlreadyInApple.push(notionContact);
          
          // Check for potential conflicts (same person but different data)
          if (this.hasDataConflicts(notionContact, appleContact)) {
            this.report.potentialConflicts.push({
              notion: notionContact,
              apple: appleContact,
              reason: 'Data mismatch between Notion and Apple'
            });
          }
          break;
        }
      }
      
      if (!foundInApple) {
        this.report.contactsToAdd.push(notionContact);
      }
    }
  }

  private contactsMatch(notionContact: Contact, appleContact: any): boolean {
    // Check if they're the same person
    if (notionContact.email && appleContact.email && 
        notionContact.email.toLowerCase() === appleContact.email.toLowerCase()) {
      return true;
    }
    
    if (notionContact.name && appleContact.name &&
        this.normalizeName(notionContact.name) === this.normalizeName(appleContact.name)) {
      return true;
    }
    
    return false;
  }

  private hasDataConflicts(notionContact: Contact, appleContact: any): boolean {
    // Check if same person has different data
    return (notionContact.name !== appleContact.name) ||
           (notionContact.email !== appleContact.email);
  }

  private generateSafeSyncReport(): void {
    console.log('\n🛡️ Safe Sync Analysis Complete!');
    console.log('===============================');
    console.log(`📊 Existing Apple contacts: ${this.report.existingAppleContacts}`);
    console.log(`📊 Notion contacts analyzed: ${this.report.notionContactsAnalyzed}`);
    console.log(`🔄 Duplicate groups removed: ${this.report.duplicateGroups}`);
    console.log(`✅ Contacts already in Apple: ${this.report.contactsAlreadyInApple.length}`);
    console.log(`➕ New contacts to add: ${this.report.contactsToAdd.length}`);
    console.log(`⚠️ Potential conflicts: ${this.report.potentialConflicts.length}`);

    // Generate safe sync files
    const timestamp = new Date().toISOString().split('T')[0];
    
    // 1. Contacts to add (safe to sync)
    if (this.report.contactsToAdd.length > 0) {
      const addFile = `safe-contacts-to-add-${timestamp}.json`;
      writeFileSync(addFile, JSON.stringify(this.report.contactsToAdd, null, 2));
      console.log(`\n📝 Safe to add: ${addFile}`);
      
      // Generate conservative AppleScript
      this.generateConservativeAppleScript(this.report.contactsToAdd, timestamp);
    }
    
    // 2. Potential conflicts report
    if (this.report.potentialConflicts.length > 0) {
      const conflictFile = `contact-conflicts-${timestamp}.json`;
      writeFileSync(conflictFile, JSON.stringify(this.report.potentialConflicts, null, 2));
      console.log(`⚠️ Review conflicts: ${conflictFile}`);
    }
    
    // 3. Full report
    const reportFile = `safe-sync-report-${timestamp}.json`;
    writeFileSync(reportFile, JSON.stringify(this.report, null, 2));
    console.log(`📋 Full report: ${reportFile}`);

    console.log('\n🎯 Recommendations:');
    if (this.report.contactsToAdd.length > 0) {
      console.log(`✅ Safe to add ${this.report.contactsToAdd.length} new contacts`);
      console.log(`🍎 Run: osascript "safe-add-contacts-${timestamp}.scpt"`);
    }
    if (this.report.potentialConflicts.length > 0) {
      console.log(`⚠️ Review ${this.report.potentialConflicts.length} conflicts manually`);
    }
    if (this.report.contactsAlreadyInApple.length > 0) {
      console.log(`ℹ️ ${this.report.contactsAlreadyInApple.length} contacts already exist - no action needed`);
    }
  }

  private generateConservativeAppleScript(contacts: Contact[], timestamp: string): void {
    let script = `-- Safe Apple Contacts Add Script (Generated ${timestamp})
-- This script only adds NEW contacts that don't exist in Apple
-- ${contacts.length} contacts to add

tell application "Contacts"
  activate
  set addedCount to 0
  set skippedCount to 0
  
`;

    for (const contact of contacts.slice(0, 50)) { // Limit to 50 for safety
      script += `
  -- Adding: ${contact.name || 'Unknown'}
  try
    set newContact to make new person with properties {first name:"${contact.firstName || ''}", last name:"${contact.lastName || ''}", organization:"${contact.organization || ''}"}
    `;
      
      if (contact.email) {
        script += `make new email at end of emails of newContact with properties {label:"work", value:"${contact.email}"}
    `;
      }
      
      if (contact.phone) {
        script += `make new phone at end of phones of newContact with properties {label:"work", value:"${contact.phone}"}
    `;
      }
      
      script += `set addedCount to addedCount + 1
  on error
    set skippedCount to skippedCount + 1
  end try
`;
    }

    script += `
  display dialog "Added " & addedCount & " contacts. Skipped " & skippedCount & " (may already exist)."
end tell`;

    const scriptFile = `safe-add-contacts-${timestamp}.scpt`;
    writeFileSync(scriptFile, script);
    console.log(`🍎 Conservative script: ${scriptFile}`);
  }
}

// Main execution
async function main() {
  const safeSync = new SafeAppleSync();
  
  try {
    await safeSync.run();
    process.exit(0);
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { SafeAppleSync };
