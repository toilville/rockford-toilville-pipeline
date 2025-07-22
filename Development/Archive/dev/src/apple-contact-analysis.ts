#!/usr/bin/env node

/**
 * Comprehensive Contact Analysis Tool (Read-Only with AppleScript)
 * 
 * This tool analyzes and generates reports for contact management:
 * 1. Analyzes contacts in Notion for duplicates and issues
 * 2. Uses AppleScript to read Apple Contacts locally
 * 3. Identifies sync gaps between Notion and Apple Contacts
 * 4. Generates actionable reports, CSV files, and AppleScript automation
 */

import { config } from 'dotenv';
import { ContactSync, Contact } from './contact-sync';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Load environment variables
config();

interface AppleContact {
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  organization?: string;
}

interface ContactIssue {
  type: 'duplicate' | 'incomplete' | 'sync_error' | 'validation_error';
  contact: Contact;
  description: string;
  suggestedAction: string;
  relatedContacts?: Contact[];
}

interface AnalysisStats {
  notionContactsProcessed: number;
  duplicatesIdentified: number;
  appleContactsAnalyzed: number;
  syncGapsFound: number;
  reportsGenerated: number;
  issues: ContactIssue[];
}

class ComprehensiveContactAnalysis {
  private contactSync: ContactSync;
  private stats: AnalysisStats;
  private appleContacts: AppleContact[] = [];

  constructor() {
    this.contactSync = new ContactSync();
    this.stats = {
      notionContactsProcessed: 0,
      duplicatesIdentified: 0,
      appleContactsAnalyzed: 0,
      syncGapsFound: 0,
      reportsGenerated: 0,
      issues: []
    };
  }

  async run(): Promise<void> {
    console.log('🔍 Comprehensive Contact Analysis (Read-Only)');
    console.log('=============================================\n');

    try {
      // Step 0: Clean up old analysis files
      console.log('🧹 Step 0: Cleaning up old analysis files...');
      await this.cleanupOldFiles();

      await this.contactSync.initialize();

      // Step 1: Analyze Notion contacts
      console.log('📊 Step 1: Analyzing Notion contacts...');
      await this.analyzeNotionContacts();

      // Step 2: Get Apple Contacts via AppleScript
      console.log('\n📱 Step 2: Reading Apple Contacts...');
      await this.readAppleContacts();

      // Step 3: Compare and identify sync gaps
      console.log('\n🔄 Step 3: Identifying sync gaps...');
      await this.identifySyncGaps();

      // Step 4: Generate comprehensive reports
      console.log('\n📋 Step 4: Generating reports...');
      await this.generateReports();

      // Final summary
      this.printFinalSummary();

    } catch (error) {
      console.error('❌ Error during analysis:', error);
      throw error;
    } finally {
      await this.contactSync.cleanup();
    }
  }

  private async cleanupOldFiles(): Promise<void> {
    try {
      const currentDir = process.cwd();
      const files = fs.readdirSync(currentDir);
      
      // Patterns for files to clean up
      const cleanupPatterns = [
        /^contact-analysis-.*\.csv$/,
        /^contact-.*-\d{4}-\d{2}-\d{2}\.md$/,
        /^add-contacts-to-apple-.*\.scpt$/,
        /^export-apple-contacts-.*\.scpt$/,
        /^cleanup-suggestions-.*\.csv$/
      ];
      
      let deletedCount = 0;
      
      for (const file of files) {
        const shouldDelete = cleanupPatterns.some(pattern => pattern.test(file));
        
        if (shouldDelete) {
          try {
            fs.unlinkSync(path.join(currentDir, file));
            deletedCount++;
          } catch (error) {
            console.warn(`   ⚠️ Could not delete ${file}: ${error}`);
          }
        }
      }
      
      if (deletedCount > 0) {
        console.log(`   🗑️ Cleaned up ${deletedCount} old analysis files`);
      } else {
        console.log(`   ✅ No old analysis files to clean up`);
      }
      
    } catch (error) {
      console.warn('   ⚠️ Error during cleanup:', error);
      // Don't fail the whole analysis if cleanup fails
    }
  }

  private async analyzeNotionContacts(): Promise<void> {
    try {
      const personalContacts = await this.contactSync.fetchNotionContacts('personal');
      const companyContacts = await this.contactSync.fetchNotionContacts('company');
      
      console.log(`   📊 Raw data: ${personalContacts.length} personal, ${companyContacts.length} company contacts`);
      
      // Check all contacts for bizdev patterns
      const allContacts = [...personalContacts, ...companyContacts];
      const bizdevContacts = allContacts.filter(contact => 
        this.isBizdevContact(contact)
      );
      
      console.log(`   🔍 Analyzing bizdev users first (most problematic records)...`);
      console.log(`   Found ${bizdevContacts.length} potential bizdev contacts out of ${allContacts.length} total contacts`);
      console.log(`   Bizdev breakdown: ${bizdevContacts.filter(c => c.contactType === 'personal' || !c.contactType).length} from personal, ${bizdevContacts.filter(c => c.contactType === 'company').length} from company`);
      
      if (bizdevContacts.length > 0) {
        const bizdevDuplicates = this.findDuplicateGroups(bizdevContacts);
        console.log(`   📊 Bizdev analysis: ${bizdevDuplicates.length} duplicate groups found`);
        
        // Show detailed analysis for first few bizdev duplicates
        for (const [index, group] of bizdevDuplicates.slice(0, 3).entries()) {
          const analysis = this.analyzeMergeNeeds(group);
          console.log(`     └─ Group ${index + 1} of ${group.length}: ${analysis}`);
        }
        
        if (bizdevDuplicates.length > 3) {
          console.log(`     └─ ... and ${bizdevDuplicates.length - 3} more duplicate groups`);
        }
      }
      
      this.stats.notionContactsProcessed = allContacts.length;
      console.log(`   Found ${allContacts.length} total contacts in Notion (${personalContacts.length} personal + ${companyContacts.length} company)`);

      // Find duplicates across all contacts
      const duplicateGroups = this.findDuplicateGroups(allContacts);
      this.stats.duplicatesIdentified = duplicateGroups.length;
      
      console.log(`   Found ${duplicateGroups.length} duplicate groups total`);

      // Add duplicate issues
      for (const group of duplicateGroups) {
        const bestContact = this.findMostCompleteContact(group);
        const duplicates = group.filter(c => c.id !== bestContact.id);
        
        // Analyze what type of merge is needed
        const mergeAnalysis = this.analyzeMergeNeeds(group);
        
        this.stats.issues.push({
          type: 'duplicate',
          contact: bestContact,
          description: `Found ${group.length} duplicate contacts: ${mergeAnalysis}`,
          suggestedAction: 'Merge duplicate contacts, keep most complete record',
          relatedContacts: duplicates
        });
      }

      // Find incomplete contacts
      const incompleteContacts = allContacts.filter(contact => 
        this.isContactIncomplete(contact)
      );

      console.log(`   Found ${incompleteContacts.length} incomplete contacts`);

      for (const contact of incompleteContacts) {
        const missingFields = this.getMissingFields(contact);
        this.stats.issues.push({
          type: 'incomplete',
          contact,
          description: `Missing ${missingFields.join(', ')}`,
          suggestedAction: 'Add missing information or archive if obsolete'
        });
      }

    } catch (error) {
      console.error('   ❌ Error analyzing Notion contacts:', error);
      this.stats.issues.push({
        type: 'sync_error',
        contact: { name: 'System Error', lastModified: new Date(), source: 'notion' },
        description: `Failed to analyze Notion contacts: ${error}`,
        suggestedAction: 'Check Notion connection and permissions'
      });
    }
  }

  private async readAppleContacts(): Promise<void> {
    try {
      console.log('   🍎 Executing AppleScript to read contacts...');
      
      const applescriptCommand = `
        tell application "Contacts"
          set contactsList to {}
          repeat with aPerson in every person
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
          end repeat
          
          return contactsList
        end tell
      `;

      const result = execSync(`osascript -e '${applescriptCommand.replace(/'/g, "\\'")}'`, { 
        encoding: 'utf8',
        timeout: 60000 // 1 minute timeout
      });

      this.appleContacts = this.parseAppleScriptResult(result);
      this.stats.appleContactsAnalyzed = this.appleContacts.length;
      
      console.log(`   Found ${this.appleContacts.length} contacts in Apple Contacts`);

    } catch (error) {
      console.error('   ⚠️ AppleScript execution failed:', error);
      console.log('   💡 Make sure Terminal has Contacts access in System Preferences > Privacy & Security');
      
      this.stats.issues.push({
        type: 'sync_error',
        contact: { name: 'Apple Contacts Access', lastModified: new Date(), source: 'import' },
        description: 'Unable to read Apple Contacts via AppleScript',
        suggestedAction: 'Grant Terminal access to Contacts in System Preferences'
      });
    }
  }

  private parseAppleScriptResult(result: string): AppleContact[] {
    try {
      const contacts: AppleContact[] = [];
      
      // Parse the AppleScript output - each contact is separated by comma and fields by |||
      const lines = result.split(',').map(line => line.trim().replace(/^"|"$/g, ''));
      
      for (const line of lines) {
        if (line && line.includes('|||')) {
          const [name, firstName, lastName, email, phone, organization] = line.split('|||');
          
          if (name || email || phone) { // Only include contacts with basic info
            contacts.push({
              name: name || `${firstName} ${lastName}`.trim() || 'Unknown',
              firstName: firstName || '',
              lastName: lastName || '',
              email: email || '',
              phone: phone || '',
              organization: organization || ''
            });
          }
        }
      }
      
      console.log(`   📝 Parsed ${contacts.length} valid contacts from AppleScript output`);
      return contacts;
      
    } catch (error) {
      console.error('   ❌ Error parsing AppleScript result:', error);
      return [];
    }
  }

  private async identifySyncGaps(): Promise<void> {
    try {
      const notionContacts = [
        ...(await this.contactSync.fetchNotionContacts('personal')),
        ...(await this.contactSync.fetchNotionContacts('company'))
      ];

      // Remove duplicates from Notion contacts before checking Apple sync
      const deduplicatedContacts = this.removeDuplicatesKeepBest(notionContacts);
      const duplicatesRemoved = notionContacts.length - deduplicatedContacts.length;
      
      if (duplicatesRemoved > 0) {
        console.log(`   🧹 Removed ${duplicatesRemoved} duplicate contacts before Apple sync check`);
      }

      // Find contacts missing in Apple (using deduplicated list)
      const missingInApple = this.findContactsMissingInApple(deduplicatedContacts);
      console.log(`   Found ${missingInApple.length} unique Notion contacts missing in Apple`);

      // Find contacts missing in Notion
      const missingInNotion = this.findContactsMissingInNotion(deduplicatedContacts);
      console.log(`   Found ${missingInNotion.length} Apple contacts missing in Notion`);

      this.stats.syncGapsFound = missingInApple.length + missingInNotion.length;

      // Add sync gap issues (only for deduplicated contacts)
      for (const contact of missingInApple) {
        this.stats.issues.push({
          type: 'sync_error',
          contact,
          description: 'Contact exists in Notion but missing in Apple Contacts',
          suggestedAction: 'Add to Apple Contacts using generated AppleScript'
        });
      }

      for (const appleContact of missingInNotion) {
        const notionContact = this.convertAppleContactToNotionFormat(appleContact);
        this.stats.issues.push({
          type: 'sync_error',
          contact: notionContact,
          description: 'Contact exists in Apple Contacts but missing in Notion',
          suggestedAction: 'Manually add to Notion database'
        });
      }

    } catch (error) {
      console.error('   ❌ Error identifying sync gaps:', error);
    }
  }

  private async generateReports(): Promise<void> {
    try {
      if (this.stats.issues.length === 0) {
        console.log('   ✅ No issues found! Contacts are perfectly organized.');
        return;
      }

      console.log(`   Generating reports for ${this.stats.issues.length} issues...`);

      // Generate CSV report
      await this.generateCSVReport();
      
      // Generate markdown reports by type
      await this.generateMarkdownReports();
      
      // Generate AppleScript for adding missing contacts
      await this.generateAppleScriptFiles();

      this.stats.reportsGenerated = 3;

    } catch (error) {
      console.error('   ❌ Error generating reports:', error);
    }
  }

  private async generateCSVReport(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvFile = `contact-analysis-${timestamp}.csv`;
    
    let csvContent = 'Type,Contact Name,Email,Phone,Organization,Issue,Recommended Action,Related Contacts\n';
    
    for (const issue of this.stats.issues) {
      const relatedNames = issue.relatedContacts?.map(c => c.name).join('; ') || '';
      const fields = [
        issue.type,
        issue.contact.name || '',
        issue.contact.email || '',
        issue.contact.phone || '',
        issue.contact.organization || '',
        issue.description,
        issue.suggestedAction,
        relatedNames
      ].map(field => `"${field.replace(/"/g, '""')}"`);
      
      csvContent += fields.join(',') + '\n';
    }
    
    fs.writeFileSync(csvFile, csvContent);
    console.log(`   📊 CSV report: ${csvFile}`);
  }

  private async generateMarkdownReports(): Promise<void> {
    const groupedIssues = this.groupIssuesByType();
    
    for (const [type, issues] of Object.entries(groupedIssues)) {
      const reportFile = `contact-${type}-${new Date().toISOString().split('T')[0]}.md`;
      const content = this.generateMarkdownReport(type, issues);
      
      fs.writeFileSync(reportFile, content);
      console.log(`   📝 ${type} report: ${reportFile}`);
    }
  }

  private async generateAppleScriptFiles(): Promise<void> {
    // Generate AppleScript to add missing contacts to Apple
    const missingInApple = this.stats.issues.filter(issue => 
      issue.type === 'sync_error' && 
      issue.description.includes('missing in Apple')
    );
    
    if (missingInApple.length > 0) {
      const scriptFile = `add-contacts-to-apple-${new Date().toISOString().split('T')[0]}.scpt`;
      const scriptContent = this.generateAddContactsAppleScript(missingInApple);
      
      fs.writeFileSync(scriptFile, scriptContent);
      console.log(`   🍎 AppleScript: ${scriptFile}`);
      console.log(`      Run: osascript "${scriptFile}" to add ${missingInApple.length} contacts`);
    }

    // Generate AppleScript to export Apple contacts for Notion import
    const exportScriptFile = `export-apple-contacts-${new Date().toISOString().split('T')[0]}.scpt`;
    const exportScript = this.generateExportAppleScript();
    
    fs.writeFileSync(exportScriptFile, exportScript);
    console.log(`   📤 Export script: ${exportScriptFile}`);
  }

  // Helper methods
  private findDuplicateGroups(contacts: Contact[]): Contact[][] {
    const groups: Contact[][] = [];
    const processed = new Set<string>();

    for (const contact of contacts) {
      if (processed.has(contact.id || '')) continue;

      const duplicates = contacts.filter(other => 
        other.id !== contact.id &&
        !processed.has(other.id || '') &&
        this.areContactsDuplicate(contact, other)
      );

      if (duplicates.length > 0) {
        const group = [contact, ...duplicates];
        groups.push(group);
        group.forEach(c => processed.add(c.id || ''));
      }
    }

    return groups;
  }

  private areContactsDuplicate(contact1: Contact, contact2: Contact): boolean {
    // Calculate similarity score based on matching properties
    const score = this.calculateSimilarityScore(contact1, contact2);
    
    // Strong matches (any single strong indicator = duplicate)
    if (score.strongMatches.length > 0) {
      return true;
    }
    
    // Majority rule: if 60% or more properties match, consider duplicate
    if (score.percentage >= 60) {
      return true;
    }
    
    // Special case: if names match and at least one other property matches
    if (score.nameMatch && score.total >= 4) {
      return true;
    }

    return false;
  }

  private calculateSimilarityScore(contact1: Contact, contact2: Contact): {
    total: number;
    maxPossible: number;
    percentage: number;
    breakdown: string[];
    strongMatches: string[];
    nameMatch: boolean;
  } {
    let score = 0;
    let maxPossible = 0;
    const breakdown: string[] = [];
    const strongMatches: string[] = [];
    let nameMatch = false;
    
    // Email match (weight: 3, strong indicator)
    if (contact1.email && contact2.email) {
      maxPossible += 3;
      if (contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
        score += 3;
        breakdown.push('same email (+3)');
        strongMatches.push('same email');
      } else {
        breakdown.push('different email (+0)');
      }
    } else if (contact1.email || contact2.email) {
      maxPossible += 1; // Partial credit if only one has email
      breakdown.push('missing email (+0)');
    }
    
    // Phone match (weight: 3, strong indicator)
    if (contact1.phone && contact2.phone) {
      maxPossible += 3;
      const phone1 = contact1.phone.replace(/\D/g, '');
      const phone2 = contact2.phone.replace(/\D/g, '');
      if (phone1 === phone2 && phone1.length > 6) {
        score += 3;
        breakdown.push('same phone (+3)');
        strongMatches.push('same phone');
      } else {
        breakdown.push('different phone (+0)');
      }
    } else if (contact1.phone || contact2.phone) {
      maxPossible += 1; // Partial credit if only one has phone
      breakdown.push('missing phone (+0)');
    }
    
    // Name matching (weight: 2-4 depending on type)
    if (contact1.name && contact2.name) {
      maxPossible += 4;
      const name1 = this.normalizeName(contact1.name);
      const name2 = this.normalizeName(contact2.name);
      
      if (name1 === name2 && name1.length > 2) {
        score += 4;
        breakdown.push('exact name (+4)');
        nameMatch = true;
        strongMatches.push('exact name');
      } else if (this.areNicknameVariations(contact1, contact2)) {
        score += 3;
        breakdown.push('nickname variation (+3)');
        nameMatch = true;
      } else if (this.namesMatch(contact1, contact2)) {
        score += 3;
        breakdown.push('first+last match (+3)');
        nameMatch = true;
      } else if (this.hasSimilarNames(contact1, contact2)) {
        score += 2;
        breakdown.push('similar names (+2)');
        nameMatch = true;
      } else {
        breakdown.push('different names (+0)');
      }
    } else {
      maxPossible += 2;
      breakdown.push('missing name (+0)');
    }
    
    // Organization match (weight: 2)
    if (contact1.organization && contact2.organization) {
      maxPossible += 2;
      const org1 = this.normalizeName(contact1.organization);
      const org2 = this.normalizeName(contact2.organization);
      if (org1 === org2 && org1.length > 2) {
        score += 2;
        breakdown.push('same organization (+2)');
      } else {
        breakdown.push('different organization (+0)');
      }
    } else if (contact1.organization || contact2.organization) {
      maxPossible += 1;
      breakdown.push('missing organization (+0)');
    }
    
    // First name match (weight: 1)
    if (contact1.firstName && contact2.firstName) {
      maxPossible += 1;
      const firstName1 = this.normalizeName(contact1.firstName);
      const firstName2 = this.normalizeName(contact2.firstName);
      if (firstName1 === firstName2) {
        score += 1;
        breakdown.push('same firstName (+1)');
      } else {
        breakdown.push('different firstName (+0)');
      }
    } else if (contact1.firstName || contact2.firstName) {
      maxPossible += 0.5;
      breakdown.push('missing firstName (+0)');
    }
    
    // Last name match (weight: 2)
    if (contact1.lastName && contact2.lastName) {
      maxPossible += 2;
      const lastName1 = this.normalizeName(contact1.lastName);
      const lastName2 = this.normalizeName(contact2.lastName);
      if (lastName1 === lastName2) {
        score += 2;
        breakdown.push('same lastName (+2)');
      } else {
        breakdown.push('different lastName (+0)');
      }
    } else if (contact1.lastName || contact2.lastName) {
      maxPossible += 1;
      breakdown.push('missing lastName (+0)');
    }
    
    const percentage = maxPossible > 0 ? (score / maxPossible) * 100 : 0;
    
    return {
      total: score,
      maxPossible: maxPossible,
      percentage: percentage,
      breakdown: breakdown,
      strongMatches: strongMatches,
      nameMatch: nameMatch
    };
  }

  private normalizeName(name: string): string {
    return name.toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  private namesMatch(contact1: Contact, contact2: Contact): boolean {
    // Check if first+last name combinations match
    const name1Full = `${contact1.firstName || ''} ${contact1.lastName || ''}`.trim();
    const name2Full = `${contact2.firstName || ''} ${contact2.lastName || ''}`.trim();
    
    if (name1Full && name2Full && name1Full.length > 2) {
      return this.normalizeName(name1Full) === this.normalizeName(name2Full);
    }
    
    // Check if one's full name matches the other's first+last
    if (contact1.name && name2Full) {
      return this.normalizeName(contact1.name) === this.normalizeName(name2Full);
    }
    
    if (contact2.name && name1Full) {
      return this.normalizeName(contact2.name) === this.normalizeName(name1Full);
    }
    
    return false;
  }

  private hasSimilarNames(contact1: Contact, contact2: Contact): boolean {
    const name1 = this.normalizeName(contact1.name || '');
    const name2 = this.normalizeName(contact2.name || '');
    
    if (!name1 || !name2 || name1.length < 3 || name2.length < 3) {
      return false;
    }
    
    // Check if one name contains the other (e.g., "John Smith" vs "John")
    return name1.includes(name2) || name2.includes(name1);
  }

  private areNicknameVariations(contact1: Contact, contact2: Contact): boolean {
    // Common nickname mappings
    const nicknameMap = new Map([
      ['anthony', ['tony', 'ant']],
      ['anthony', ['tony', 'ant']],
      ['robert', ['rob', 'bob', 'bobby']],
      ['william', ['will', 'bill', 'billy']],
      ['michael', ['mike', 'mick']],
      ['christopher', ['chris']],
      ['elizabeth', ['liz', 'beth', 'betty']],
      ['jennifer', ['jen', 'jenny']],
      ['katherine', ['kate', 'katie', 'kathy']],
      ['patricia', ['pat', 'patty']],
      ['richard', ['rick', 'rich', 'dick']],
      ['thomas', ['tom', 'tommy']],
      ['daniel', ['dan', 'danny']],
      ['matthew', ['matt']],
      ['jonathan', ['jon', 'john']],
      ['benjamin', ['ben', 'benny']],
      ['alexander', ['alex', 'al']],
      ['nicholas', ['nick']],
      ['rebecca', ['becca', 'becky']],
      ['stephanie', ['steph']],
      ['samantha', ['sam']],
      ['michelle', ['shell']],
      ['amanda', ['mandy']],
      ['joshua', ['josh']],
      ['andrew', ['andy', 'drew']],
      ['kenneth', ['ken', 'kenny']],
      ['joseph', ['joe', 'joey']],
      ['charles', ['charlie', 'chuck']],
      ['david', ['dave', 'davy']],
      ['james', ['jim', 'jimmy', 'jamie']],
      ['timothy', ['tim', 'timmy']],
      ['gregory', ['greg']],
      ['ronald', ['ron', 'ronnie']]
    ]);

    // Get name components for both contacts
    const name1Parts = this.getNameParts(contact1);
    const name2Parts = this.getNameParts(contact2);

    // Check if they have the same last name
    if (name1Parts.lastName && name2Parts.lastName) {
      const lastName1 = this.normalizeName(name1Parts.lastName);
      const lastName2 = this.normalizeName(name2Parts.lastName);
      
      if (lastName1 === lastName2) {
        // Same last name, check if first names are nickname variations
        const firstName1 = this.normalizeName(name1Parts.firstName || '');
        const firstName2 = this.normalizeName(name2Parts.firstName || '');
        
        if (firstName1 && firstName2) {
          // Check both directions: is firstName1 a nickname of firstName2, or vice versa
          return this.isNicknameOf(firstName1, firstName2, nicknameMap) ||
                 this.isNicknameOf(firstName2, firstName1, nicknameMap);
        }
      }
    }

    return false;
  }

  private getNameParts(contact: Contact): { firstName: string; lastName: string } {
    // Try to extract first and last name from various fields
    let firstName = contact.firstName || '';
    let lastName = contact.lastName || '';

    // If firstName/lastName are empty, try to parse from full name
    if (!firstName && !lastName && contact.name) {
      const nameParts = contact.name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts[nameParts.length - 1]; // Last word as last name
      } else if (nameParts.length === 1) {
        firstName = nameParts[0];
      }
    }

    return { firstName, lastName };
  }

  private isNicknameOf(name1: string, name2: string, nicknameMap: Map<string, string[]>): boolean {
    // Check if name1 is a nickname of name2
    const nicknames = nicknameMap.get(name2.toLowerCase());
    return nicknames ? nicknames.includes(name1.toLowerCase()) : false;
  }

  private analyzeMergeNeeds(group: Contact[]): string {
    const emails = group.filter(c => c.email).map(c => c.email!.toLowerCase());
    const phones = group.filter(c => c.phone).map(c => c.phone!);
    const names = group.map(c => c.name || 'Unknown');
    
    const uniqueEmails = [...new Set(emails)];
    const uniquePhones = [...new Set(phones.map(p => p.replace(/\D/g, '')))];
    const uniqueNames = [...new Set(names.map(n => this.normalizeName(n)))];
    
    const issues: string[] = [];
    
    if (uniqueNames.length > 1) {
      issues.push(`different names (${uniqueNames.join(', ')})`);
    } else {
      issues.push(`same name "${names[0]}"`);
    }
    
    if (uniqueEmails.length > 1) {
      issues.push(`different emails (${uniqueEmails.join(', ')})`);
    } else if (uniqueEmails.length === 1) {
      issues.push(`same email`);
    } else {
      issues.push(`missing emails`);
    }
    
    if (uniquePhones.length > 1) {
      issues.push(`different phones`);
    } else if (uniquePhones.length === 1) {
      issues.push(`same phone`);
    } else {
      issues.push(`missing phones`);
    }
    
    return issues.join(', ');
  }

  private findMostCompleteContact(contacts: Contact[]): Contact {
    return contacts.reduce((best, current) => {
      const bestScore = this.calculateCompletenessScore(best);
      const currentScore = this.calculateCompletenessScore(current);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateCompletenessScore(contact: Contact): number {
    let score = 0;
    if (contact.name && contact.name.length > 2) score += 2;
    if (contact.email && contact.email.includes('@')) score += 3;
    if (contact.phone && contact.phone.length > 6) score += 3;
    if (contact.organization) score += 1;
    if (contact.firstName && contact.lastName) score += 1;
    return score;
  }

  private isContactIncomplete(contact: Contact): boolean {
    return !contact.email && !contact.phone;
  }

  private isBizdevContact(contact: Contact): boolean {
    // Identify potential bizdev contacts by organization patterns and characteristics
    const org = (contact.organization || '').toLowerCase();
    const name = (contact.name || '').toLowerCase();
    
    // Common business/startup patterns
    const businessPatterns = [
      'inc', 'llc', 'corp', 'ltd', 'co.', 'company',
      'startup', 'ventures', 'capital', 'partners',
      'consulting', 'solutions', 'services', 'group',
      'technologies', 'tech', 'labs', 'media',
      'agency', 'studio', 'firm', 'enterprises'
    ];
    
    // Check if organization has business patterns
    const hasBusinessOrg = businessPatterns.some(pattern => org.includes(pattern));
    
    // Check if they have organization but incomplete personal info
    const hasOrgButIncompletePersonal = contact.organization && 
      (!contact.firstName || !contact.lastName);
    
    // Check if name contains business indicators
    const nameHasBusinessIndicators = businessPatterns.some(pattern => name.includes(pattern));
    
    return hasBusinessOrg || hasOrgButIncompletePersonal || nameHasBusinessIndicators;
  }

  private getMissingFields(contact: Contact): string[] {
    const missing: string[] = [];
    if (!contact.email) missing.push('email');
    if (!contact.phone) missing.push('phone');
    return missing;
  }

  private removeDuplicatesKeepBest(contacts: Contact[]): Contact[] {
    const duplicateGroups = this.findDuplicateGroups(contacts);
    const duplicateIds = new Set<string>();
    const bestContacts: Contact[] = [];

    // For each duplicate group, keep only the best contact
    for (const group of duplicateGroups) {
      const bestContact = this.findMostCompleteContact(group);
      bestContacts.push(bestContact);
      
      // Mark all others as duplicates to remove
      for (const contact of group) {
        if (contact.id !== bestContact.id) {
          duplicateIds.add(contact.id || '');
        }
      }
    }

    // Return contacts that are either not duplicates or are the best from their group
    return contacts.filter(contact => 
      !duplicateIds.has(contact.id || '') || 
      bestContacts.some(best => best.id === contact.id)
    );
  }

  private findContactsMissingInApple(notionContacts: Contact[]): Contact[] {
    return notionContacts.filter(notionContact => {
      if (!notionContact.email && !notionContact.phone) return false;
      
      return !this.appleContacts.some(appleContact => 
        this.contactsMatch(notionContact, appleContact)
      );
    });
  }

  private findContactsMissingInNotion(notionContacts: Contact[]): AppleContact[] {
    return this.appleContacts.filter(appleContact => {
      if (!appleContact.email && !appleContact.phone) return false;
      
      return !notionContacts.some(notionContact => 
        this.contactsMatch(notionContact, appleContact)
      );
    });
  }

  private contactsMatch(notionContact: Contact, appleContact: AppleContact): boolean {
    // Email match
    if (notionContact.email && appleContact.email) {
      if (notionContact.email.toLowerCase() === appleContact.email.toLowerCase()) {
        return true;
      }
    }

    // Phone match
    if (notionContact.phone && appleContact.phone) {
      const notionPhone = notionContact.phone.replace(/\D/g, '');
      const applePhone = appleContact.phone.replace(/\D/g, '');
      if (notionPhone === applePhone && notionPhone.length > 6) {
        return true;
      }
    }

    // Name match
    if (notionContact.name && appleContact.name) {
      const notionName = notionContact.name.toLowerCase().trim();
      const appleName = appleContact.name.toLowerCase().trim();
      if (notionName === appleName) {
        return true;
      }
    }

    return false;
  }

  private convertAppleContactToNotionFormat(appleContact: AppleContact): Contact {
    return {
      name: appleContact.name,
      email: appleContact.email || '',
      phone: appleContact.phone || '',
      firstName: appleContact.firstName || '',
      lastName: appleContact.lastName || '',
      organization: appleContact.organization || '',
      lastModified: new Date(),
      contactType: 'personal',
      source: 'import'
    };
  }

  private groupIssuesByType(): Record<string, ContactIssue[]> {
    return this.stats.issues.reduce((groups, issue) => {
      if (!groups[issue.type]) {
        groups[issue.type] = [];
      }
      groups[issue.type].push(issue);
      return groups;
    }, {} as Record<string, ContactIssue[]>);
  }

  private generateMarkdownReport(type: string, issues: ContactIssue[]): string {
    const title = type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
    let content = `# Contact ${title} Report\n\n`;
    content += `Generated: ${new Date().toISOString()}\n`;
    content += `Issues found: ${issues.length}\n\n`;

    issues.forEach((issue, index) => {
      content += `## ${index + 1}. ${issue.contact.name || 'Unknown Contact'}\n\n`;
      content += `**Issue:** ${issue.description}\n\n`;
      content += `**Action:** ${issue.suggestedAction}\n\n`;
      
      if (issue.contact.email) content += `**Email:** ${issue.contact.email}\n\n`;
      if (issue.contact.phone) content += `**Phone:** ${issue.contact.phone}\n\n`;
      if (issue.contact.organization) content += `**Organization:** ${issue.contact.organization}\n\n`;
      
      if (issue.relatedContacts && issue.relatedContacts.length > 0) {
        content += `**Related Contacts:**\n`;
        issue.relatedContacts.forEach(related => {
          content += `- ${related.name}`;
          if (related.email) content += ` (${related.email})`;
          content += '\n';
        });
        content += '\n';
      }
      
      content += '---\n\n';
    });

    return content;
  }

  private generateAddContactsAppleScript(issues: ContactIssue[]): string {
    let script = `-- AppleScript to add missing contacts to Apple Contacts\n`;
    script += `-- Generated: ${new Date().toISOString()}\n\n`;
    script += `tell application "Contacts"\n`;
    
    for (const issue of issues) {
      const contact = issue.contact;
      script += `\t-- Adding ${contact.name}\n`;
      script += `\tset newPerson to make new person\n`;
      
      if (contact.firstName) script += `\tset first name of newPerson to "${contact.firstName}"\n`;
      if (contact.lastName) script += `\tset last name of newPerson to "${contact.lastName}"\n`;
      if (contact.organization) script += `\tset organization of newPerson to "${contact.organization}"\n`;
      
      if (contact.email) {
        script += `\tmake new email at end of emails of newPerson with properties {value:"${contact.email}", label:"work"}\n`;
      }
      
      if (contact.phone) {
        script += `\tmake new phone at end of phones of newPerson with properties {value:"${contact.phone}", label:"work"}\n`;
      }
      
      script += `\t\n`;
    }
    
    script += `\tsave\n`;
    script += `end tell\n\n`;
    script += `display dialog "Added ${issues.length} contacts to Apple Contacts" buttons {"OK"} default button "OK"\n`;
    
    return script;
  }

  private generateExportAppleScript(): string {
    let script = `-- AppleScript to export Apple Contacts for Notion import\n`;
    script += `-- Generated: ${new Date().toISOString()}\n\n`;
    script += `set csvContent to "Name,First Name,Last Name,Email,Phone,Organization" & return\n\n`;
    script += `tell application "Contacts"\n`;
    script += `\trepeat with aPerson in every person\n`;
    script += `\t\tset contactName to ""\n`;
    script += `\t\tset firstName to ""\n`;
    script += `\t\tset lastName to ""\n`;
    script += `\t\tset emailAddr to ""\n`;
    script += `\t\tset phoneNum to ""\n`;
    script += `\t\tset orgName to ""\n\n`;
    
    script += `\t\ttry\n`;
    script += `\t\t\tset contactName to name of aPerson\n`;
    script += `\t\tend try\n\n`;
    
    script += `\t\ttry\n`;
    script += `\t\t\tset firstName to first name of aPerson\n`;
    script += `\t\tend try\n\n`;
    
    script += `\t\ttry\n`;
    script += `\t\t\tset lastName to last name of aPerson\n`;
    script += `\t\tend try\n\n`;
    
    script += `\t\ttry\n`;
    script += `\t\t\tset orgName to organization of aPerson\n`;
    script += `\t\tend try\n\n`;
    
    script += `\t\ttry\n`;
    script += `\t\t\tif (count of emails of aPerson) > 0 then\n`;
    script += `\t\t\t\tset emailAddr to value of first email of aPerson\n`;
    script += `\t\t\tend if\n`;
    script += `\t\tend try\n\n`;
    
    script += `\t\ttry\n`;
    script += `\t\t\tif (count of phones of aPerson) > 0 then\n`;
    script += `\t\t\t\tset phoneNum to value of first phone of aPerson\n`;
    script += `\t\t\tend if\n`;
    script += `\t\tend try\n\n`;
    
    script += `\t\tset csvLine to "\\"" & contactName & "\\",\\"" & firstName & "\\",\\"" & lastName & "\\",\\"" & emailAddr & "\\",\\"" & phoneNum & "\\",\\"" & orgName & "\\""\n`;
    script += `\t\tset csvContent to csvContent & csvLine & return\n`;
    script += `\tend repeat\n`;
    script += `end tell\n\n`;
    
    script += `set fileName to "apple-contacts-export-" & (do shell script "date +%Y-%m-%d") & ".csv"\n`;
    script += `set filePath to (path to desktop as string) & fileName\n`;
    script += `set fileRef to open for access file filePath with write permission\n`;
    script += `write csvContent to fileRef\n`;
    script += `close access fileRef\n\n`;
    
    script += `display dialog "Exported Apple Contacts to " & fileName & " on Desktop" buttons {"OK"} default button "OK"\n`;
    
    return script;
  }

  private printFinalSummary(): void {
    console.log('\n🎉 Comprehensive Contact Analysis Complete!');
    console.log('==========================================');
    console.log(`📊 Notion contacts analyzed: ${this.stats.notionContactsProcessed}`);
    console.log(`📱 Apple contacts analyzed: ${this.stats.appleContactsAnalyzed}`);
    console.log(`🔄 Duplicate groups found: ${this.stats.duplicatesIdentified}`);
    console.log(`🔗 Sync gaps identified: ${this.stats.syncGapsFound}`);
    console.log(`📋 Reports generated: ${this.stats.reportsGenerated}`);
    console.log(`⚠️ Total issues found: ${this.stats.issues.length}`);
    
    if (this.stats.issues.length > 0) {
      console.log('\n📋 Next Steps:');
      console.log('1. Review CSV report for complete issue breakdown');
      console.log('2. Use markdown reports for detailed issue analysis');
      console.log('3. Run AppleScript files to automate contact additions (duplicates already filtered out)');
      console.log('4. Manually merge duplicates and complete missing info');
      console.log('\n💡 Note: AppleScript will only add the best contact from each duplicate group');
    } else {
      console.log('\n✨ Your contacts are perfectly synchronized!');
    }
  }
}

// Main execution
async function main() {
  const analysis = new ComprehensiveContactAnalysis();
  
  try {
    await analysis.run();
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

export { ComprehensiveContactAnalysis };
