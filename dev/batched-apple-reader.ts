#!/usr/bin/env node

/**
 * Batched Apple Contacts Reader
 * 
 * Uses the same pagination strategy as Notion to read Apple Contacts in batches
 * This prevents timeouts when dealing with large contact databases
 */

import { config } from 'dotenv';
import { ContactSync, Contact } from './src/contact-sync';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

// Load environment variables
config();

interface AppleContact {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organization: string;
}

class BatchedAppleContactReader {
  private contactSync: ContactSync;
  private batchSize: number = 100; // Process 100 contacts at a time

  constructor() {
    this.contactSync = new ContactSync();
  }

  async run(): Promise<void> {
    console.log('📱 Batched Apple Contacts Analysis');
    console.log('==================================\n');

    try {
      // Step 1: Get total count first
      console.log('📊 Step 1: Getting Apple Contacts count...');
      const totalCount = await this.getAppleContactsCount();
      console.log(`   Found ${totalCount} total contacts in Apple`);

      // Step 2: Read contacts in batches
      console.log('\n📋 Step 2: Reading Apple Contacts in batches...');
      const allAppleContacts = await this.readAppleContactsInBatches(totalCount);
      console.log(`   Successfully read ${allAppleContacts.length} Apple contacts`);

      // Step 3: Get our cleaned Notion contacts
      console.log('\n🔍 Step 3: Getting deduplicated Notion contacts...');
      await this.contactSync.initialize();
      
      const personalContacts = await this.contactSync.fetchNotionContacts('personal');
      const companyContacts = await this.contactSync.fetchNotionContacts('company');
      const allNotionContacts = [...personalContacts, ...companyContacts];
      
      console.log(`   Raw Notion contacts: ${allNotionContacts.length}`);
      
      const uniqueNotionContacts = this.removeDuplicatesKeepBest(allNotionContacts);
      console.log(`   Deduplicated Notion contacts: ${uniqueNotionContacts.length}`);

      // Step 4: Compare and analyze
      console.log('\n🔍 Step 4: Comparing Notion vs Apple contacts...');
      const analysis = this.compareContacts(uniqueNotionContacts, allAppleContacts);
      this.generateReport(analysis, uniqueNotionContacts, allAppleContacts);

    } catch (error) {
      console.error('❌ Error during batched analysis:', error);
      throw error;
    } finally {
      await this.contactSync.cleanup();
    }
  }

  private async getAppleContactsCount(): Promise<number> {
    const countScript = `
      tell application "Contacts"
        return count of every person
      end tell
    `;

    try {
      const result = execSync(`osascript -e '${countScript}'`, { 
        encoding: 'utf8',
        timeout: 10000 // 10 seconds should be enough for count
      });
      
      return parseInt(result.trim());
    } catch (error) {
      console.error('   ⚠️ Failed to get Apple Contacts count:', error);
      return 0;
    }
  }

  private async readAppleContactsInBatches(totalCount: number): Promise<AppleContact[]> {
    const allContacts: AppleContact[] = [];
    const totalBatches = Math.ceil(totalCount / this.batchSize);
    
    console.log(`   📄 Reading ${totalBatches} batches of ${this.batchSize} contacts each...`);

    for (let batch = 1; batch <= totalBatches; batch++) {
      const startIndex = (batch - 1) * this.batchSize + 1;
      const endIndex = Math.min(batch * this.batchSize, totalCount);
      
      console.log(`   📄 Batch ${batch}/${totalBatches}: contacts ${startIndex}-${endIndex}...`);
      
      try {
        const batchContacts = await this.readAppleContactBatch(startIndex, endIndex);
        allContacts.push(...batchContacts);
        console.log(`   ✅ Batch ${batch}: ${batchContacts.length} contacts (total: ${allContacts.length})`);
        
        // Small delay to prevent overwhelming the system
        await this.sleep(100);
        
      } catch (error) {
        console.error(`   ❌ Batch ${batch} failed:`, error);
        // Continue with next batch instead of failing completely
      }
    }

    return allContacts;
  }

  private async readAppleContactBatch(startIndex: number, endIndex: number): Promise<AppleContact[]> {
    const batchScript = `
      tell application "Contacts"
        set contactsList to {}
        
        repeat with i from ${startIndex} to ${endIndex}
          try
            set aPerson to person i
            set contactName to ""
            set contactFirstName to ""
            set contactLastName to ""
            set contactOrg to ""
            set contactEmail to ""
            set contactPhone to ""
            
            try
              set contactName to name of aPerson
            end try
            
            try
              set contactFirstName to first name of aPerson
            end try
            
            try
              set contactLastName to last name of aPerson
            end try
            
            try
              set contactOrg to organization of aPerson
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
            
            set contactRecord to contactName & "|||" & contactFirstName & "|||" & contactLastName & "|||" & contactEmail & "|||" & contactPhone & "|||" & contactOrg
            set contactsList to contactsList & {contactRecord}
          on error
            -- Skip problematic contacts
          end try
        end repeat
        
        return contactsList
      end tell
    `;

    const result = execSync(`osascript -e '${batchScript.replace(/'/g, "\\'")}'`, { 
      encoding: 'utf8',
      timeout: 30000, // 30 seconds per batch
      maxBuffer: 2 * 1024 * 1024 // 2MB buffer per batch
    });

    return this.parseAppleScriptBatch(result);
  }

  private parseAppleScriptBatch(result: string): AppleContact[] {
    const contacts: AppleContact[] = [];
    const lines = result.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const parts = line.split('|||');
      if (parts.length >= 6) {
        contacts.push({
          name: parts[0]?.trim() || '',
          firstName: parts[1]?.trim() || '',
          lastName: parts[2]?.trim() || '',
          email: parts[3]?.trim() || '',
          phone: parts[4]?.trim() || '',
          organization: parts[5]?.trim() || ''
        });
      }
    }
    
    return contacts;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private removeDuplicatesKeepBest(contacts: Contact[]): Contact[] {
    const duplicateGroups = this.findDuplicateGroups(contacts);
    
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
          
        return orgMatch || phoneMatch || (!contact1.email && !contact2.email);
      }
    }
    
    return false;
  }

  private normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  }

  private selectBestContact(contacts: Contact[]): Contact {
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

  private compareContacts(notionContacts: Contact[], appleContacts: AppleContact[]): {
    contactsToAdd: Contact[];
    contactsAlreadyInApple: Contact[];
    conflictsFound: Array<{notion: Contact; apple: AppleContact; reason: string}>;
    appleOnlyContacts: AppleContact[];
  } {
    const contactsToAdd: Contact[] = [];
    const contactsAlreadyInApple: Contact[] = [];
    const conflictsFound: Array<{notion: Contact; apple: AppleContact; reason: string}> = [];
    const matchedAppleContacts = new Set<number>();

    // Check each Notion contact against Apple
    for (const notionContact of notionContacts) {
      let foundMatch = false;
      
      for (let i = 0; i < appleContacts.length; i++) {
        const appleContact = appleContacts[i];
        
        if (this.contactsMatch(notionContact, appleContact)) {
          foundMatch = true;
          matchedAppleContacts.add(i);
          contactsAlreadyInApple.push(notionContact);
          
          // Check for data conflicts
          if (this.hasDataConflicts(notionContact, appleContact)) {
            conflictsFound.push({
              notion: notionContact,
              apple: appleContact,
              reason: 'Data mismatch between Notion and Apple'
            });
          }
          break;
        }
      }
      
      if (!foundMatch) {
        contactsToAdd.push(notionContact);
      }
    }

    // Find Apple-only contacts
    const appleOnlyContacts = appleContacts.filter((_, index) => !matchedAppleContacts.has(index));

    return {
      contactsToAdd,
      contactsAlreadyInApple,
      conflictsFound,
      appleOnlyContacts
    };
  }

  private contactsMatch(notionContact: Contact, appleContact: AppleContact): boolean {
    // Email match
    if (notionContact.email && appleContact.email && 
        notionContact.email.toLowerCase() === appleContact.email.toLowerCase()) {
      return true;
    }
    
    // Name match
    if (notionContact.name && appleContact.name &&
        this.normalizeName(notionContact.name) === this.normalizeName(appleContact.name)) {
      return true;
    }
    
    // First + Last name match
    if (notionContact.firstName && notionContact.lastName && 
        appleContact.firstName && appleContact.lastName) {
      const notionFullName = this.normalizeName(`${notionContact.firstName} ${notionContact.lastName}`);
      const appleFullName = this.normalizeName(`${appleContact.firstName} ${appleContact.lastName}`);
      return notionFullName === appleFullName;
    }
    
    return false;
  }

  private hasDataConflicts(notionContact: Contact, appleContact: AppleContact): boolean {
    const conflicts: string[] = [];
    
    if (notionContact.email && appleContact.email && 
        notionContact.email !== appleContact.email) {
      conflicts.push('email');
    }
    
    if (notionContact.phone && appleContact.phone && 
        notionContact.phone.replace(/\D/g, '') !== appleContact.phone.replace(/\D/g, '')) {
      conflicts.push('phone');
    }
    
    return conflicts.length > 0;
  }

  private generateReport(analysis: any, notionContacts: Contact[], appleContacts: AppleContact[]): void {
    const timestamp = new Date().toISOString().split('T')[0];
    
    console.log('\n📊 Batched Contact Analysis Complete!');
    console.log('====================================');
    console.log(`📱 Apple contacts analyzed: ${appleContacts.length}`);
    console.log(`📋 Notion contacts analyzed: ${notionContacts.length}`);
    console.log(`✅ Already in Apple: ${analysis.contactsAlreadyInApple.length}`);
    console.log(`➕ To add to Apple: ${analysis.contactsToAdd.length}`);
    console.log(`⚠️ Conflicts found: ${analysis.conflictsFound.length}`);
    console.log(`🍎 Apple-only contacts: ${analysis.appleOnlyContacts.length}`);

    // Save detailed reports
    const reportData = {
      summary: {
        appleContactsTotal: appleContacts.length,
        notionContactsTotal: notionContacts.length,
        alreadyInApple: analysis.contactsAlreadyInApple.length,
        toAddToApple: analysis.contactsToAdd.length,
        conflictsFound: analysis.conflictsFound.length,
        appleOnlyContacts: analysis.appleOnlyContacts.length
      },
      contactsToAdd: analysis.contactsToAdd,
      conflicts: analysis.conflictsFound,
      appleBackup: appleContacts
    };

    // Main report
    const reportFile = `batched-contact-analysis-${timestamp}.json`;
    writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
    console.log(`\n📋 Full report: ${reportFile}`);

    // Safe contacts to add
    if (analysis.contactsToAdd.length > 0) {
      const safeAddFile = `safe-contacts-to-add-${timestamp}.json`;
      writeFileSync(safeAddFile, JSON.stringify(analysis.contactsToAdd, null, 2));
      console.log(`✅ Safe to add: ${safeAddFile}`);
      
      this.generateSafeAppleScript(analysis.contactsToAdd, timestamp);
    }

    // Apple backup
    const backupFile = `apple-contacts-backup-${timestamp}.json`;
    writeFileSync(backupFile, JSON.stringify(appleContacts, null, 2));
    console.log(`💾 Apple backup: ${backupFile}`);

    console.log('\n🎯 Next Steps:');
    if (analysis.contactsToAdd.length > 0) {
      console.log(`✅ You can safely add ${analysis.contactsToAdd.length} new contacts to Apple`);
      console.log(`🍎 Run: osascript "safe-add-${timestamp}.scpt"`);
    } else {
      console.log('ℹ️ All Notion contacts already exist in Apple - no sync needed!');
    }
    
    if (analysis.conflictsFound.length > 0) {
      console.log(`⚠️ Review ${analysis.conflictsFound.length} data conflicts manually`);
    }
  }

  private generateSafeAppleScript(contacts: Contact[], timestamp: string): void {
    let script = `-- Safe Apple Contacts Add Script (Generated ${timestamp})
-- Adding ${contacts.length} new contacts that don't exist in Apple

tell application "Contacts"
  activate
  set addedCount to 0
  
`;

    // Limit to first 100 for safety
    const contactsToProcess = contacts.slice(0, 100);
    
    for (const contact of contactsToProcess) {
      script += `
  -- Adding: ${contact.name || 'Unknown'}
  try
    set newContact to make new person with properties {first name:"${contact.firstName || ''}", last name:"${contact.lastName || ''}", organization:"${contact.organization || ''}"}`;
      
      if (contact.email) {
        script += `
    make new email at end of emails of newContact with properties {label:"work", value:"${contact.email}"}`;
      }
      
      if (contact.phone) {
        script += `
    make new phone at end of phones of newContact with properties {label:"work", value:"${contact.phone}"}`;
      }
      
      script += `
    set addedCount to addedCount + 1
  on error
    -- Skip if already exists
  end try
`;
    }

    script += `
  display dialog "Successfully added " & addedCount & " new contacts to Apple Contacts!"
end tell`;

    const scriptFile = `safe-add-${timestamp}.scpt`;
    writeFileSync(scriptFile, script);
    console.log(`🍎 Safe add script: ${scriptFile}`);
  }
}

// Main execution
async function main() {
  const reader = new BatchedAppleContactReader();
  
  try {
    await reader.run();
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

export { BatchedAppleContactReader };
