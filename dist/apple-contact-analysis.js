#!/usr/bin/env node
"use strict";
/**
 * Comprehensive Contact Analysis Tool (Read-Only with AppleScript)
 *
 * This tool analyzes and generates reports for contact management:
 * 1. Analyzes contacts in Notion for duplicates and issues
 * 2. Uses AppleScript to read Apple Contacts locally
 * 3. Identifies sync gaps between Notion and Apple Contacts
 * 4. Generates actionable reports, CSV files, and AppleScript automation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComprehensiveContactAnalysis = void 0;
const dotenv_1 = require("dotenv");
const contact_sync_1 = require("./contact-sync");
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
// Load environment variables
(0, dotenv_1.config)();
class ComprehensiveContactAnalysis {
    constructor() {
        this.appleContacts = [];
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
        console.log('🔍 Comprehensive Contact Analysis (Read-Only)');
        console.log('=============================================\n');
        try {
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
        }
        catch (error) {
            console.error('❌ Error during analysis:', error);
            throw error;
        }
        finally {
            await this.contactSync.cleanup();
        }
    }
    async analyzeNotionContacts() {
        try {
            const personalContacts = await this.contactSync.fetchNotionContacts('personal');
            const companyContacts = await this.contactSync.fetchNotionContacts('company');
            const allContacts = [...personalContacts, ...companyContacts];
            this.stats.notionContactsProcessed = allContacts.length;
            console.log(`   Found ${allContacts.length} contacts in Notion`);
            // Find duplicates
            const duplicateGroups = this.findDuplicateGroups(allContacts);
            this.stats.duplicatesIdentified = duplicateGroups.length;
            console.log(`   Found ${duplicateGroups.length} duplicate groups`);
            // Add duplicate issues
            for (const group of duplicateGroups) {
                const bestContact = this.findMostCompleteContact(group);
                const duplicates = group.filter(c => c.id !== bestContact.id);
                this.stats.issues.push({
                    type: 'duplicate',
                    contact: bestContact,
                    description: `Found ${group.length} duplicate contacts (same email/phone/name)`,
                    suggestedAction: 'Merge duplicate contacts, keep most complete record',
                    relatedContacts: duplicates
                });
            }
            // Find incomplete contacts
            const incompleteContacts = allContacts.filter(contact => this.isContactIncomplete(contact));
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
        }
        catch (error) {
            console.error('   ❌ Error analyzing Notion contacts:', error);
            this.stats.issues.push({
                type: 'sync_error',
                contact: { name: 'System Error', lastModified: new Date(), source: 'notion' },
                description: `Failed to analyze Notion contacts: ${error}`,
                suggestedAction: 'Check Notion connection and permissions'
            });
        }
    }
    async readAppleContacts() {
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
            const result = (0, child_process_1.execSync)(`osascript -e '${applescriptCommand.replace(/'/g, "\\'")}'`, {
                encoding: 'utf8',
                timeout: 60000 // 1 minute timeout
            });
            this.appleContacts = this.parseAppleScriptResult(result);
            this.stats.appleContactsAnalyzed = this.appleContacts.length;
            console.log(`   Found ${this.appleContacts.length} contacts in Apple Contacts`);
        }
        catch (error) {
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
    parseAppleScriptResult(result) {
        try {
            const contacts = [];
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
        }
        catch (error) {
            console.error('   ❌ Error parsing AppleScript result:', error);
            return [];
        }
    }
    async identifySyncGaps() {
        try {
            const notionContacts = [
                ...(await this.contactSync.fetchNotionContacts('personal')),
                ...(await this.contactSync.fetchNotionContacts('company'))
            ];
            // Find contacts missing in Apple
            const missingInApple = this.findContactsMissingInApple(notionContacts);
            console.log(`   Found ${missingInApple.length} Notion contacts missing in Apple`);
            // Find contacts missing in Notion
            const missingInNotion = this.findContactsMissingInNotion(notionContacts);
            console.log(`   Found ${missingInNotion.length} Apple contacts missing in Notion`);
            this.stats.syncGapsFound = missingInApple.length + missingInNotion.length;
            // Add sync gap issues
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
        }
        catch (error) {
            console.error('   ❌ Error identifying sync gaps:', error);
        }
    }
    async generateReports() {
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
        }
        catch (error) {
            console.error('   ❌ Error generating reports:', error);
        }
    }
    async generateCSVReport() {
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
    async generateMarkdownReports() {
        const groupedIssues = this.groupIssuesByType();
        for (const [type, issues] of Object.entries(groupedIssues)) {
            const reportFile = `contact-${type}-${new Date().toISOString().split('T')[0]}.md`;
            const content = this.generateMarkdownReport(type, issues);
            fs.writeFileSync(reportFile, content);
            console.log(`   📝 ${type} report: ${reportFile}`);
        }
    }
    async generateAppleScriptFiles() {
        // Generate AppleScript to add missing contacts to Apple
        const missingInApple = this.stats.issues.filter(issue => issue.type === 'sync_error' &&
            issue.description.includes('missing in Apple'));
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
    findDuplicateGroups(contacts) {
        const groups = [];
        const processed = new Set();
        for (const contact of contacts) {
            if (processed.has(contact.id || ''))
                continue;
            const duplicates = contacts.filter(other => other.id !== contact.id &&
                !processed.has(other.id || '') &&
                this.areContactsDuplicate(contact, other));
            if (duplicates.length > 0) {
                const group = [contact, ...duplicates];
                groups.push(group);
                group.forEach(c => processed.add(c.id || ''));
            }
        }
        return groups;
    }
    areContactsDuplicate(contact1, contact2) {
        // Email match
        if (contact1.email && contact2.email &&
            contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
            return true;
        }
        // Phone match (normalize)
        if (contact1.phone && contact2.phone) {
            const phone1 = contact1.phone.replace(/\D/g, '');
            const phone2 = contact2.phone.replace(/\D/g, '');
            if (phone1 === phone2 && phone1.length > 6) {
                return true;
            }
        }
        // Name match
        if (contact1.name && contact2.name) {
            const name1 = contact1.name.toLowerCase().trim();
            const name2 = contact2.name.toLowerCase().trim();
            if (name1 === name2 && name1.length > 2) {
                return true;
            }
        }
        return false;
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
        if (contact.name && contact.name.length > 2)
            score += 2;
        if (contact.email && contact.email.includes('@'))
            score += 3;
        if (contact.phone && contact.phone.length > 6)
            score += 3;
        if (contact.organization)
            score += 1;
        if (contact.firstName && contact.lastName)
            score += 1;
        return score;
    }
    isContactIncomplete(contact) {
        return !contact.email && !contact.phone;
    }
    getMissingFields(contact) {
        const missing = [];
        if (!contact.email)
            missing.push('email');
        if (!contact.phone)
            missing.push('phone');
        return missing;
    }
    findContactsMissingInApple(notionContacts) {
        return notionContacts.filter(notionContact => {
            if (!notionContact.email && !notionContact.phone)
                return false;
            return !this.appleContacts.some(appleContact => this.contactsMatch(notionContact, appleContact));
        });
    }
    findContactsMissingInNotion(notionContacts) {
        return this.appleContacts.filter(appleContact => {
            if (!appleContact.email && !appleContact.phone)
                return false;
            return !notionContacts.some(notionContact => this.contactsMatch(notionContact, appleContact));
        });
    }
    contactsMatch(notionContact, appleContact) {
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
    convertAppleContactToNotionFormat(appleContact) {
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
    groupIssuesByType() {
        return this.stats.issues.reduce((groups, issue) => {
            if (!groups[issue.type]) {
                groups[issue.type] = [];
            }
            groups[issue.type].push(issue);
            return groups;
        }, {});
    }
    generateMarkdownReport(type, issues) {
        const title = type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
        let content = `# Contact ${title} Report\n\n`;
        content += `Generated: ${new Date().toISOString()}\n`;
        content += `Issues found: ${issues.length}\n\n`;
        issues.forEach((issue, index) => {
            content += `## ${index + 1}. ${issue.contact.name || 'Unknown Contact'}\n\n`;
            content += `**Issue:** ${issue.description}\n\n`;
            content += `**Action:** ${issue.suggestedAction}\n\n`;
            if (issue.contact.email)
                content += `**Email:** ${issue.contact.email}\n\n`;
            if (issue.contact.phone)
                content += `**Phone:** ${issue.contact.phone}\n\n`;
            if (issue.contact.organization)
                content += `**Organization:** ${issue.contact.organization}\n\n`;
            if (issue.relatedContacts && issue.relatedContacts.length > 0) {
                content += `**Related Contacts:**\n`;
                issue.relatedContacts.forEach(related => {
                    content += `- ${related.name}`;
                    if (related.email)
                        content += ` (${related.email})`;
                    content += '\n';
                });
                content += '\n';
            }
            content += '---\n\n';
        });
        return content;
    }
    generateAddContactsAppleScript(issues) {
        let script = `-- AppleScript to add missing contacts to Apple Contacts\n`;
        script += `-- Generated: ${new Date().toISOString()}\n\n`;
        script += `tell application "Contacts"\n`;
        for (const issue of issues) {
            const contact = issue.contact;
            script += `\t-- Adding ${contact.name}\n`;
            script += `\tset newPerson to make new person\n`;
            if (contact.firstName)
                script += `\tset first name of newPerson to "${contact.firstName}"\n`;
            if (contact.lastName)
                script += `\tset last name of newPerson to "${contact.lastName}"\n`;
            if (contact.organization)
                script += `\tset organization of newPerson to "${contact.organization}"\n`;
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
    generateExportAppleScript() {
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
    printFinalSummary() {
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
            console.log('3. Run AppleScript files to automate contact additions');
            console.log('4. Manually merge duplicates and complete missing info');
        }
        else {
            console.log('\n✨ Your contacts are perfectly synchronized!');
        }
    }
}
exports.ComprehensiveContactAnalysis = ComprehensiveContactAnalysis;
// Main execution
async function main() {
    const analysis = new ComprehensiveContactAnalysis();
    try {
        await analysis.run();
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
