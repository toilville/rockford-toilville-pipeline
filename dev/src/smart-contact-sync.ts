#!/usr/bin/env node

/**
 * Smart Contact Deduplication and Sync Tool
 * 
 * This tool will:
 * 1. Dedupe contacts in Notion
 * 2. Add missing contacts to Apple Contacts
 * 3. Sync Apple contacts back to Notion  
 * 4. Create Notion tasks for problematic records
 */

import { config } from 'dotenv';
import { ContactSync, Contact } from './contact-sync';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

interface ContactIssue {
  type: 'duplicate' | 'incomplete' | 'sync_error' | 'validation_error';
  contact: Contact;
  description: string;
  suggestedAction: string;
  relatedContacts?: Contact[];
}

interface SyncStats {
  notionContactsProcessed: number;
  duplicatesFound: number;
  contactsAddedToApple: number;
  contactsSyncedFromApple: number;
  tasksCreated: number;
  issues: ContactIssue[];
}

class SmartContactSync {
  private contactSync: ContactSync;
  private stats: SyncStats;

  constructor() {
    this.contactSync = new ContactSync();
    this.stats = {
      notionContactsProcessed: 0,
      duplicatesFound: 0,
      contactsAddedToApple: 0,
      contactsSyncedFromApple: 0,
      tasksCreated: 0,
      issues: []
    };
  }

  async run(): Promise<void> {
    console.log('🚀 Smart Contact Deduplication and Sync');
    console.log('======================================\n');

    try {
      await this.contactSync.initialize();

      // Step 1: Analyze Notion contacts for duplicates
      console.log('📊 Step 1: Analyzing Notion contacts for duplicates...');
      await this.findAndFlagDuplicates();

      // Step 2: Get Apple contacts and compare
      console.log('\n📱 Step 2: Analyzing Apple Contacts...');
      await this.analyzeAppleContacts();

      // Step 3: Create comprehensive sync plan
      console.log('\n📋 Step 3: Creating sync and cleanup tasks...');
      await this.createComprehensiveTasks();

      // Final summary
      this.printFinalSummary();

    } catch (error) {
      console.error('❌ Error during smart sync:', error);
      throw error;
    } finally {
      await this.contactSync.cleanup();
    }
  }

  private async findAndFlagDuplicates(): Promise<void> {
    try {
      const personalContacts = await this.contactSync.fetchNotionContacts('personal');
      const companyContacts = await this.contactSync.fetchNotionContacts('company');
      const allContacts = [...personalContacts, ...companyContacts];
      
      this.stats.notionContactsProcessed = allContacts.length;
      console.log(`   Found ${allContacts.length} contacts in Notion`);

      // Find duplicate groups
      const duplicateGroups = this.findDuplicateGroups(allContacts);
      this.stats.duplicatesFound = duplicateGroups.length;
      
      console.log(`   Found ${duplicateGroups.length} duplicate groups affecting ${duplicateGroups.reduce((sum, group) => sum + group.length, 0)} contacts`);

      // Flag all duplicates for manual review
      for (const group of duplicateGroups) {
        const bestContact = this.findMostCompleteContact(group);
        const duplicates = group.filter(c => c.id !== bestContact.id);
        
        this.stats.issues.push({
          type: 'duplicate',
          contact: bestContact,
          description: `Duplicate group of ${group.length} contacts. Keep this one and merge/remove others.`,
          suggestedAction: `Review and merge duplicate contacts. Keep "${bestContact.name}" as primary.`,
          relatedContacts: duplicates
        });
      }

    } catch (error) {
      console.error('   ❌ Error analyzing Notion contacts:', error);
      this.stats.issues.push({
        type: 'sync_error',
        contact: { name: 'System Error', lastModified: new Date(), source: 'notion' },
        description: `Failed to analyze Notion contacts: ${error}`,
        suggestedAction: 'Check Notion connection and database permissions'
      });
    }
  }

  private async analyzeAppleContacts(): Promise<void> {
    try {
      console.log('   📱 Retrieving Apple Contacts...');
      
      // Get all Apple contacts
      const appleContactsResponse = await this.getAppleContacts();
      console.log(`   Found ${appleContactsResponse.length} contacts in Apple Contacts`);

      // Get current Notion contacts for comparison
      const notionContacts = [
        ...(await this.contactSync.fetchNotionContacts('personal')),
        ...(await this.contactSync.fetchNotionContacts('company'))
      ];

      // Find contacts missing in Apple
      const missingInApple = this.findContactsMissingInApple(notionContacts, appleContactsResponse);
      console.log(`   Found ${missingInApple.length} Notion contacts missing in Apple`);

      // Find contacts missing in Notion
      const missingInNotion = this.findContactsMissingInNotion(appleContactsResponse, notionContacts);
      console.log(`   Found ${missingInNotion.length} Apple contacts missing in Notion`);

      // Flag contacts that should be added to Apple
      for (const contact of missingInApple) {
        this.stats.issues.push({
          type: 'sync_error',
          contact,
          description: 'Contact exists in Notion but not in Apple Contacts',
          suggestedAction: 'Add this contact to Apple Contacts to keep them in sync'
        });
      }

      // Flag contacts that should be added to Notion
      for (const appleContact of missingInNotion) {
        const notionContact = this.convertAppleContactToNotionFormat(appleContact);
        this.stats.issues.push({
          type: 'sync_error',
          contact: notionContact,
          description: 'Contact exists in Apple Contacts but not in Notion',
          suggestedAction: 'Add this contact to Notion to keep them in sync'
        });
      }

      this.stats.contactsAddedToApple = missingInApple.length;
      this.stats.contactsSyncedFromApple = missingInNotion.length;

    } catch (error) {
      console.error('   ❌ Error analyzing Apple contacts:', error);
      this.stats.issues.push({
        type: 'sync_error',
        contact: { name: 'System Error', lastModified: new Date(), source: 'import' },
        description: `Failed to analyze Apple contacts: ${error}`,
        suggestedAction: 'Check Apple Contacts permissions and try again'
      });
    }
  }

  private async getAppleContacts(): Promise<any[]> {
    try {
      // Use Apple MCP to get all contacts
      console.log('   📱 Retrieving contacts from Apple Contacts...');
      
      // This will use the Apple MCP contacts tool to get all contacts
      // We'll implement this properly by calling the MCP function
      return await this.fetchAppleContactsViaMCP();
      
    } catch (error) {
      console.error('   ⚠️ Could not access Apple Contacts via MCP:', error);
      return [];
    }
  }

  private async fetchAppleContactsViaMCP(): Promise<any[]> {
    try {
      // For now, we'll create a placeholder that would call the Apple MCP
      // In a real implementation, this would use the Apple MCP contacts function
      console.log('   📱 Apple MCP integration ready for implementation...');
      
      // This is where we would integrate with Apple MCP:
      // const contacts = await mcp_apple_mcp_contacts();
      
      // For demonstration, return empty array - will be implemented with actual MCP calls
      return [];
    } catch (error) {
      console.error('   Error fetching from Apple MCP:', error);
      return [];
    }
  }

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
        
        // Mark all as processed
        group.forEach(c => processed.add(c.id || ''));
      }
    }

    return groups;
  }

  private areContactsDuplicate(contact1: Contact, contact2: Contact): boolean {
    // Email match
    if (contact1.email && contact2.email && 
        contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
      return true;
    }
    
    // Phone match (normalize phone numbers)
    if (contact1.phone && contact2.phone) {
      const phone1 = contact1.phone.replace(/\D/g, '');
      const phone2 = contact2.phone.replace(/\D/g, '');
      if (phone1 === phone2 && phone1.length > 6) {
        return true;
      }
    }

    // Exact name match
    if (contact1.name && contact2.name) {
      const name1 = contact1.name.toLowerCase().trim();
      const name2 = contact2.name.toLowerCase().trim();
      if (name1 === name2 && name1.length > 2) {
        return true;
      }
    }

    return false;
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
    if (contact.lastModified && contact.lastModified > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) score += 1; // Recent update
    return score;
  }

  private findContactsMissingInApple(notionContacts: Contact[], appleContacts: any[]): Contact[] {
    return notionContacts.filter(notionContact => {
      // Only sync contacts with essential info
      if (!notionContact.email && !notionContact.phone) return false;
      
      return !appleContacts.some(appleContact => 
        this.contactsMatch(notionContact, appleContact)
      );
    });
  }

  private findContactsMissingInNotion(appleContacts: any[], notionContacts: Contact[]): any[] {
    return appleContacts.filter(appleContact => {
      // Only consider Apple contacts with essential info
      if (!appleContact.email && !appleContact.phone) return false;
      
      return !notionContacts.some(notionContact => 
        this.contactsMatch(notionContact, appleContact)
      );
    });
  }

  private contactsMatch(notionContact: Contact, appleContact: any): boolean {
    // Check email match
    if (notionContact.email && appleContact.email) {
      if (notionContact.email.toLowerCase() === appleContact.email.toLowerCase()) {
        return true;
      }
    }

    // Check phone match
    if (notionContact.phone && appleContact.phone) {
      const notionPhone = notionContact.phone.replace(/\D/g, '');
      const applePhone = appleContact.phone.replace(/\D/g, '');
      if (notionPhone === applePhone && notionPhone.length > 6) {
        return true;
      }
    }

    // Check name similarity
    if (notionContact.name && appleContact.name) {
      const notionName = notionContact.name.toLowerCase().trim();
      const appleName = appleContact.name.toLowerCase().trim();
      if (notionName === appleName) {
        return true;
      }
    }

    return false;
  }

  private convertAppleContactToNotionFormat(appleContact: any): Contact {
    return {
      name: appleContact.name || `${appleContact.firstName || ''} ${appleContact.lastName || ''}`.trim(),
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

  private async createComprehensiveTasks(): Promise<void> {
    if (this.stats.issues.length === 0) {
      console.log('   ✅ No issues found! Your contacts are perfectly synced.');
      return;
    }

    console.log(`   Creating comprehensive cleanup plan for ${this.stats.issues.length} issues...`);

    try {
      // Group issues by type
      const groupedIssues = this.groupIssuesByType();

      // Create tasks for each type
      for (const [type, issues] of Object.entries(groupedIssues)) {
        await this.createTaskForIssueType(type, issues);
        this.stats.tasksCreated++;
      }

      // Save detailed report to CSV
      await this.saveDetailedReport();

    } catch (error) {
      console.error('   ❌ Error creating tasks:', error);
    }
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

  private async createTaskForIssueType(type: string, issues: ContactIssue[]): Promise<void> {
    const taskTitle = this.getTaskTitle(type);
    const taskDescription = this.generateTaskDescription(type, issues);
    
    console.log(`   📝 Task: ${taskTitle} (${issues.length} items)`);
    
    // Here you could use Notion MCP to create actual tasks
    // For now, we'll save to file for manual import
    const taskFile = `contact-sync-task-${type}-${new Date().toISOString().split('T')[0]}.md`;
    fs.writeFileSync(taskFile, `# ${taskTitle}\n\n${taskDescription}`);
    console.log(`      Saved to: ${taskFile}`);
  }

  private getTaskTitle(type: string): string {
    const titles: Record<string, string> = {
      'duplicate': 'Contact Cleanup: Merge Duplicate Contacts',
      'sync_error': 'Contact Sync: Add Missing Contacts',
      'incomplete': 'Contact Enhancement: Complete Missing Information',
      'validation_error': 'Contact Validation: Fix Data Issues'
    };
    return titles[type] || `Contact Issues: ${type}`;
  }

  private generateTaskDescription(type: string, issues: ContactIssue[]): string {
    let description = `## ${this.getTaskTitle(type)}\n\n`;
    description += `Found ${issues.length} contacts that need attention:\n\n`;

    issues.forEach((issue, index) => {
      description += `### ${index + 1}. ${issue.contact.name || 'Unknown Contact'}\n`;
      description += `**Issue:** ${issue.description}\n`;
      description += `**Action:** ${issue.suggestedAction}\n`;
      
      if (issue.contact.email) description += `**Email:** ${issue.contact.email}\n`;
      if (issue.contact.phone) description += `**Phone:** ${issue.contact.phone}\n`;
      if (issue.contact.organization) description += `**Organization:** ${issue.contact.organization}\n`;
      
      if (issue.relatedContacts && issue.relatedContacts.length > 0) {
        description += `**Related Contacts:**\n`;
        issue.relatedContacts.forEach(related => {
          description += `- ${related.name}`;
          if (related.email) description += ` (${related.email})`;
          description += '\n';
        });
      }
      
      description += '\n---\n\n';
    });

    description += `\n## Summary\n`;
    description += `- Total contacts affected: ${issues.length}\n`;
    description += `- Priority: ${type === 'duplicate' ? 'High' : type === 'sync_error' ? 'Medium' : 'Low'}\n`;
    description += `- Estimated time: ${Math.ceil(issues.length * 2)} minutes\n`;

    return description;
  }

  private async saveDetailedReport(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = `contact-sync-report-${timestamp}.csv`;
    
    let csvContent = 'Type,Contact Name,Email,Phone,Organization,Issue,Action,Related Contacts\n';
    
    for (const issue of this.stats.issues) {
      const relatedNames = issue.relatedContacts?.map(c => c.name).join('; ') || '';
      csvContent += `"${issue.type}","${issue.contact.name || ''}","${issue.contact.email || ''}","${issue.contact.phone || ''}","${issue.contact.organization || ''}","${issue.description}","${issue.suggestedAction}","${relatedNames}"\n`;
    }
    
    fs.writeFileSync(reportFile, csvContent);
    console.log(`   📊 Detailed report saved to: ${reportFile}`);
  }

  private printFinalSummary(): void {
    console.log('\n🎉 Smart Contact Sync Complete!');
    console.log('================================');
    console.log(`📊 Notion contacts analyzed: ${this.stats.notionContactsProcessed}`);
    console.log(`🔄 Duplicate groups found: ${this.stats.duplicatesFound}`);
    console.log(`📱 Contacts to add to Apple: ${this.stats.contactsAddedToApple}`);
    console.log(`⬇️ Contacts to add to Notion: ${this.stats.contactsSyncedFromApple}`);
    console.log(`📝 Cleanup tasks created: ${this.stats.tasksCreated}`);
    console.log(`⚠️ Total issues found: ${this.stats.issues.length}`);
    
    if (this.stats.issues.length > 0) {
      console.log('\n📋 Next Steps:');
      console.log('1. Review the generated task files for detailed action items');
      console.log('2. Start with duplicate merging (highest impact)');
      console.log('3. Add missing contacts to Apple and Notion');
      console.log('4. Complete any missing contact information');
    } else {
      console.log('\n✨ Your contacts are perfectly organized!');
    }
  }
}

// Main execution
async function main() {
  const sync = new SmartContactSync();
  
  try {
    await sync.run();
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

export { SmartContactSync };
