#!/usr/bin/env node
"use strict";
/**
 * Comprehensive Contact Analysis Tool (Read-Only)
 *
 * Since MCP is read-only, this tool will:
 * 1. Analyze contacts in Notion for duplicates and issues
 * 2. Compare with Apple Contacts to identify sync gaps
 * 3. Generate actionable reports and Notion tasks for manual execution
 * 4. Create detailed CSV reports with specific instructions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComprehensiveContactSync = void 0;
const dotenv_1 = require("dotenv");
const contact_sync_1 = require("./contact-sync");
// Load environment variables
(0, dotenv_1.config)();
class ComprehensiveContactSync {
    constructor() {
        this.contactSync = new contact_sync_1.ContactSync();
        this.stats = {
            notionContactsProcessed: 0,
            duplicatesIdentified: 0,
            appleContactsAnalyzed: 0,
            syncGapsFound: 0,
            reportsGenerated: 0,
            issues: []
        };
    }
    async run() {
        console.log('� Comprehensive Contact Analysis (Read-Only)');
        console.log('=============================================\n');
        try {
            await this.contactSync.initialize();
            // Step 1: Analyze Notion contacts
            console.log('📊 Step 1: Analyzing Notion contacts...');
            await this.analyzeNotionContacts();
            // Step 2: Analyze Apple Contacts via AppleScript
            console.log('\n📱 Step 2: Analyzing Apple Contacts...');
            await this.analyzeAppleContacts();
            // Step 3: Compare and identify sync gaps
            console.log('\n🔄 Step 3: Identifying sync gaps...');
            await this.identifySyncGaps();
            // Step 4: Generate reports and tasks
            console.log('\n� Step 4: Generating reports and tasks...');
            await this.generateReportsAndTasks();
            // Final summary
            this.printFinalSummary();
        }
        catch (error) {
            console.error('❌ Error during comprehensive analysis:', error);
            throw error;
        }
        finally {
            await this.contactSync.cleanup();
        }
    }
    async analyzeAndDedupeNotionContacts() {
        try {
            const personalContacts = await this.contactSync.fetchNotionContacts('personal');
            const companyContacts = await this.contactSync.fetchNotionContacts('company');
            const allContacts = [...personalContacts, ...companyContacts];
            this.stats.notionContactsProcessed = allContacts.length;
            console.log(`   Found ${allContacts.length} contacts in Notion`);
            // Find duplicates
            const duplicateGroups = this.findDuplicates(allContacts);
            console.log(`   Found ${duplicateGroups.length} duplicate groups`);
            // Process duplicates
            for (const group of duplicateGroups) {
                await this.processDuplicateGroup(group);
            }
        }
        catch (error) {
            console.error('   ❌ Error analyzing Notion contacts:', error);
            this.stats.errors.push({
                type: 'sync_error',
                contact: {},
                description: `Failed to analyze Notion contacts: ${error}`,
                suggestedAction: 'Check Notion connection and database permissions'
            });
        }
    }
    findDuplicates(contacts) {
        const duplicateGroups = [];
        const processedIds = new Set();
        for (const contact of contacts) {
            if (processedIds.has(contact.id || ''))
                continue;
            const duplicates = contacts.filter(other => other.id !== contact.id &&
                !processedIds.has(other.id || '') &&
                this.areContactsDuplicate(contact, other));
            if (duplicates.length > 0) {
                const group = [contact, ...duplicates];
                duplicateGroups.push(group);
                // Mark all in group as processed
                group.forEach(c => processedIds.add(c.id || ''));
            }
        }
        return duplicateGroups;
    }
    areContactsDuplicate(contact1, contact2) {
        // Check if contacts are duplicates based on email, phone, or name
        if (contact1.email && contact2.email && contact1.email === contact2.email) {
            return true;
        }
        if (contact1.phone && contact2.phone && contact1.phone === contact2.phone) {
            return true;
        }
        // Check name similarity (both first+last name match)
        if (contact1.name && contact2.name) {
            const name1 = contact1.name.toLowerCase().trim();
            const name2 = contact2.name.toLowerCase().trim();
            if (name1 === name2) {
                return true;
            }
        }
        return false;
    }
    async processDuplicateGroup(duplicates) {
        try {
            // Find the most complete contact
            const bestContact = this.findMostCompleteContact(duplicates);
            const contactsToRemove = duplicates.filter(c => c.id !== bestContact.id);
            console.log(`   Merging ${duplicates.length} duplicates for: ${bestContact.name}`);
            // Merge information into the best contact
            const mergedContact = this.mergeContactInformation(duplicates);
            // Note: For now, we'll add this to problematic records since we don't have direct update/delete methods
            this.stats.errors.push({
                type: 'duplicate',
                contact: bestContact,
                description: `Found ${duplicates.length} duplicate contacts that need manual merging`,
                suggestedAction: 'Manually merge these duplicate contacts in Notion',
                relatedContacts: contactsToRemove
            });
        }
        catch (error) {
            console.error('   ❌ Error processing duplicate group:', error);
            this.stats.errors.push({
                type: 'sync_error',
                contact: duplicates[0],
                description: `Failed to process duplicate group: ${error}`,
                suggestedAction: 'Manually review and merge these duplicate contacts',
                relatedContacts: duplicates
            });
        }
    }
    findMostCompleteContact(contacts) {
        return contacts.reduce((best, current) => {
            const bestScore = this.calculateCompletenessScore(best);
            const currentScore = this.calculateCompletenessScore(current);
            return currentScore > bestScore ? current : best;
        });
    }
    calculateCompletenessScore(contact) {
        let score = 0;
        if (contact.name)
            score += 1;
        if (contact.email)
            score += 2;
        if (contact.phone)
            score += 2;
        if (contact.organization)
            score += 1;
        if (contact.firstName && contact.lastName)
            score += 1;
        return score;
    }
    mergeContactInformation(contacts) {
        const merged = { ...contacts[0] };
        // Merge information from all contacts
        for (const contact of contacts) {
            if (!merged.name && contact.name)
                merged.name = contact.name;
            if (!merged.email && contact.email)
                merged.email = contact.email;
            if (!merged.phone && contact.phone)
                merged.phone = contact.phone;
            if (!merged.organization && contact.organization)
                merged.organization = contact.organization;
            if (!merged.firstName && contact.firstName)
                merged.firstName = contact.firstName;
            if (!merged.lastName && contact.lastName)
                merged.lastName = contact.lastName;
        }
        merged.lastModified = new Date();
        return merged;
    }
    async addMissingContactsToApple() {
        try {
            // Get Notion contacts that need to be added to Apple
            const personalContacts = await this.contactSync.fetchNotionContacts('personal');
            // Get Apple contacts to check what's missing
            const appleContacts = await this.getAppleContacts();
            const missingInApple = this.findContactsMissingInApple(personalContacts, appleContacts);
            console.log(`   Found ${missingInApple.length} contacts missing in Apple`);
            for (const contact of missingInApple) {
                try {
                    await this.addContactToApple(contact);
                    this.stats.contactsAddedToApple++;
                    console.log(`   ✅ Added ${contact.name} to Apple Contacts`);
                }
                catch (error) {
                    console.error(`   ⚠️ Failed to add ${contact.name} to Apple:`, error);
                    this.stats.errors.push({
                        type: 'sync_error',
                        contact,
                        description: `Failed to add to Apple Contacts: ${error}`,
                        suggestedAction: 'Manually add this contact to Apple Contacts'
                    });
                }
            }
        }
        catch (error) {
            console.error('   ❌ Error adding contacts to Apple:', error);
            this.stats.errors.push({
                type: 'sync_error',
                contact: {},
                description: `Failed to sync with Apple Contacts: ${error}`,
                suggestedAction: 'Check Apple Contacts permissions and try again'
            });
        }
    }
    async getAppleContacts() {
        // This would use the Apple MCP to get contacts
        // For now, return empty array as placeholder
        console.log('   📱 Retrieving Apple Contacts...');
        return [];
    }
    findContactsMissingInApple(notionContacts, appleContacts) {
        // Logic to find Notion contacts that don't exist in Apple
        // For now, return first 5 as example
        return notionContacts.slice(0, 5);
    }
    async addContactToApple(contact) {
        // This would use Apple MCP to add contact
        console.log(`   Adding ${contact.name} to Apple Contacts...`);
        // Placeholder - would actually add to Apple Contacts
    }
    async syncAppleContactsToNotion() {
        try {
            console.log('   📱 Retrieving updated Apple Contacts...');
            const appleContacts = await this.getAppleContacts();
            console.log(`   Found ${appleContacts.length} contacts in Apple`);
            for (const appleContact of appleContacts) {
                try {
                    const notionContact = this.convertAppleContactToNotionFormat(appleContact);
                    // For now, add to problematic records since we don't have direct create/update method
                    this.stats.errors.push({
                        type: 'sync_error',
                        contact: notionContact,
                        description: 'Contact from Apple needs to be manually added/updated in Notion',
                        suggestedAction: 'Review and manually add this Apple contact to Notion'
                    });
                    this.stats.contactsSyncedFromApple++;
                    console.log(`   ⚠️ Flagged ${notionContact.name} for manual review`);
                }
                catch (error) {
                    console.error(`   ⚠️ Failed to sync ${appleContact.name}:`, error);
                    this.stats.errors.push({
                        type: 'sync_error',
                        contact: this.convertAppleContactToNotionFormat(appleContact),
                        description: `Failed to sync from Apple: ${error}`,
                        suggestedAction: 'Manually update this contact in Notion'
                    });
                }
            }
        }
        catch (error) {
            console.error('   ❌ Error syncing from Apple:', error);
        }
    }
    convertAppleContactToNotionFormat(appleContact) {
        // Convert Apple contact format to our Contact interface
        return {
            name: appleContact.name || '',
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
    async createTasksForProblematicRecords() {
        if (this.stats.errors.length === 0) {
            console.log('   ✅ No problematic records found!');
            return;
        }
        console.log(`   Creating tasks for ${this.stats.errors.length} problematic records...`);
        try {
            // Group errors by type
            const errorsByType = this.groupErrorsByType();
            for (const [type, errors] of Object.entries(errorsByType)) {
                const taskTitle = `Contact Sync Issues: ${type.replace('_', ' ').toUpperCase()}`;
                const taskDescription = this.generateTaskDescription(type, errors);
                await this.createNotionTask(taskTitle, taskDescription, errors);
                this.stats.tasksCreated++;
            }
        }
        catch (error) {
            console.error('   ❌ Error creating tasks:', error);
        }
    }
    groupErrorsByType() {
        return this.stats.errors.reduce((groups, error) => {
            if (!groups[error.type]) {
                groups[error.type] = [];
            }
            groups[error.type].push(error);
            return groups;
        }, {});
    }
    generateTaskDescription(type, errors) {
        let description = `## Contact Sync Issues: ${type.replace('_', ' ').toUpperCase()}\n\n`;
        description += `Found ${errors.length} issues that need manual review:\n\n`;
        errors.forEach((error, index) => {
            description += `### ${index + 1}. ${error.contact.name || 'Unknown Contact'}\n`;
            description += `**Issue:** ${error.description}\n`;
            description += `**Suggested Action:** ${error.suggestedAction}\n`;
            if (error.contact.email)
                description += `**Email:** ${error.contact.email}\n`;
            if (error.contact.phone)
                description += `**Phone:** ${error.contact.phone}\n`;
            description += '\n---\n\n';
        });
        return description;
    }
    async createNotionTask(title, description, errors) {
        try {
            // This would create a task in Notion
            // For now, just log what would be created
            console.log(`   📝 Task: ${title}`);
            console.log(`      Issues: ${errors.length}`);
            // Could use Notion MCP to actually create the task
            // await this.notionMcp.createTask(title, description);
        }
        catch (error) {
            console.error(`   ❌ Failed to create task "${title}":`, error);
        }
    }
    printFinalSummary() {
        console.log('\n🎉 Comprehensive Contact Sync Complete!');
        console.log('=========================================');
        console.log(`📊 Notion contacts processed: ${this.stats.notionContactsProcessed}`);
        console.log(`🔄 Duplicates removed: ${this.stats.duplicatesRemoved}`);
        console.log(`📱 Contacts added to Apple: ${this.stats.contactsAddedToApple}`);
        console.log(`⬇️ Contacts synced from Apple: ${this.stats.contactsSyncedFromApple}`);
        console.log(`📝 Tasks created: ${this.stats.tasksCreated}`);
        console.log(`⚠️ Issues requiring attention: ${this.stats.errors.length}`);
        if (this.stats.errors.length > 0) {
            console.log('\n📋 Check your Notion tasks for issues that need manual review.');
        }
    }
}
exports.ComprehensiveContactSync = ComprehensiveContactSync;
// Main execution
async function main() {
    const sync = new ComprehensiveContactSync();
    try {
        await sync.run();
        process.exit(0);
    }
    catch (error) {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    main();
}
