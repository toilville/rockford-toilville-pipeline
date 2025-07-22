#!/usr/bin/env node
"use strict";
/**
 * Systematic Contact Cleanup Tool
 * Analyzes contacts for duplicates, inconsistencies, and cleanup opportunities
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
exports.ContactCleanup = void 0;
const dotenv_1 = require("dotenv");
const contact_sync_1 = require("./contact-sync");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Load environment variables
(0, dotenv_1.config)();
class ContactCleanup {
    constructor() {
        this.contactSync = new contact_sync_1.ContactSync({ dryRun: true });
        this.report = {
            totalContacts: 0,
            totalIssues: 0,
            suggestions: [],
            summary: {
                duplicates: 0,
                incomplete: 0,
                inconsistent: 0,
                mergeCandidates: 0
            }
        };
    }
    /**
     * Run comprehensive contact cleanup analysis
     */
    async analyzeContacts() {
        console.log('🔍 Starting systematic contact cleanup analysis...\n');
        try {
            await this.contactSync.initialize();
            // Fetch all contacts from Notion databases
            const notionPersonalContacts = await this.fetchNotionContacts('personal');
            const notionCompanyContacts = await this.fetchNotionContacts('company');
            const allContacts = [...notionPersonalContacts, ...notionCompanyContacts];
            this.report.totalContacts = allContacts.length;
            console.log(`📊 Analyzing ${allContacts.length} total contacts...`);
            console.log(`   • ${notionPersonalContacts.length} from Notion Personal`);
            console.log(`   • ${notionCompanyContacts.length} from Notion Company\n`);
            // Run various cleanup analyses
            await this.findDuplicates(allContacts);
            await this.findIncompleteContacts(allContacts);
            await this.findInconsistentContacts(allContacts);
            this.report.totalIssues = this.report.suggestions.length;
            console.log('\n📋 Cleanup Analysis Summary:');
            console.log(`   • ${this.report.summary.duplicates} duplicate contacts`);
            console.log(`   • ${this.report.summary.incomplete} incomplete contacts`);
            console.log(`   • ${this.report.summary.inconsistent} inconsistent contacts`);
            // Generate cleanup report file
            await this.generateCleanupReport();
            return this.report;
        }
        catch (error) {
            console.error('❌ Cleanup analysis failed:', error);
            throw error;
        }
        finally {
            await this.contactSync.cleanup();
        }
    }
    /**
     * Find duplicate contacts
     */
    async findDuplicates(contacts) {
        console.log('🔍 Analyzing for duplicate contacts...');
        const duplicateGroups = [];
        const processed = new Set();
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            const contactKey = this.getContactKey(contact);
            if (processed.has(contactKey))
                continue;
            const duplicates = contacts.filter((c, index) => index !== i && this.contactsAreDuplicates(contact, c));
            if (duplicates.length > 0) {
                const group = [contact, ...duplicates];
                duplicateGroups.push(group);
                // Mark all as processed
                group.forEach(c => processed.add(this.getContactKey(c)));
            }
        }
        for (const group of duplicateGroups) {
            const primaryContact = group[0];
            const suggestion = {
                type: 'duplicate',
                contact: primaryContact,
                issue: `Found ${group.length} duplicate contacts with same email/phone/name`,
                suggestedAction: `Merge into single contact, keeping most complete information`,
                relatedContacts: group.slice(1)
            };
            this.report.suggestions.push(suggestion);
            this.report.summary.duplicates++;
        }
        console.log(`   Found ${duplicateGroups.length} duplicate groups`);
    }
    /**
     * Find incomplete contacts (missing email, phone, or name)
     */
    async findIncompleteContacts(contacts) {
        console.log('🔍 Analyzing for incomplete contacts...');
        let incompleteCount = 0;
        for (const contact of contacts) {
            const issues = [];
            if (!contact.email || contact.email.trim() === '') {
                issues.push('missing email');
            }
            if (!contact.phone || contact.phone.trim() === '') {
                issues.push('missing phone');
            }
            if (!contact.name || contact.name.trim() === '' || contact.name === 'Unknown') {
                issues.push('missing or invalid name');
            }
            if (issues.length > 0) {
                const suggestion = {
                    type: 'incomplete',
                    contact: contact,
                    issue: `Incomplete contact: ${issues.join(', ')}`,
                    suggestedAction: `Review and add missing information or consider removal if obsolete`
                };
                this.report.suggestions.push(suggestion);
                this.report.summary.incomplete++;
                incompleteCount++;
            }
        }
        console.log(`   Found ${incompleteCount} incomplete contacts`);
    }
    /**
     * Find inconsistent contacts (same person with different info across systems)
     */
    async findInconsistentContacts(contacts) {
        console.log('🔍 Analyzing for inconsistent contacts...');
        let inconsistentCount = 0;
        // Group contacts by email or phone to find same person with different info
        const contactGroups = this.groupContactsByIdentity(contacts);
        for (const group of contactGroups) {
            if (group.length > 1) {
                const inconsistencies = this.findInconsistenciesInGroup(group);
                if (inconsistencies.length > 0) {
                    const primaryContact = group[0];
                    const suggestion = {
                        type: 'inconsistent',
                        contact: primaryContact,
                        issue: `Inconsistent information: ${inconsistencies.join(', ')}`,
                        suggestedAction: `Standardize information across all instances`,
                        relatedContacts: group.slice(1)
                    };
                    this.report.suggestions.push(suggestion);
                    this.report.summary.inconsistent++;
                    inconsistentCount++;
                }
            }
        }
        console.log(`   Found ${inconsistentCount} inconsistent contact groups`);
    }
    /**
     * Remove merge candidates analysis since we're Notion-only now
     */
    /**
     * Helper methods
     */
    getContactKey(contact) {
        return `${contact.source}-${contact.name}-${contact.email || ''}-${contact.phone || ''}`;
    }
    contactsAreDuplicates(contact1, contact2) {
        // Same email
        if (contact1.email && contact2.email &&
            contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
            return true;
        }
        // Same phone (normalized)
        if (contact1.phone && contact2.phone) {
            const phone1 = contact1.phone.replace(/\D/g, '');
            const phone2 = contact2.phone.replace(/\D/g, '');
            if (phone1 && phone2 && phone1 === phone2) {
                return true;
            }
        }
        // Same name (exact match for Notion-only analysis)
        if (contact1.name && contact2.name &&
            contact1.name.toLowerCase() === contact2.name.toLowerCase()) {
            return true;
        }
        return false;
    }
    groupContactsByIdentity(contacts) {
        const groups = [];
        const processed = new Set();
        for (const contact of contacts) {
            const key = this.getContactKey(contact);
            if (processed.has(key))
                continue;
            const group = contacts.filter(c => (contact.email && c.email && contact.email.toLowerCase() === c.email.toLowerCase()) ||
                (contact.phone && c.phone && contact.phone.replace(/\D/g, '') === c.phone.replace(/\D/g, '')));
            if (group.length > 1) {
                groups.push(group);
                group.forEach(c => processed.add(this.getContactKey(c)));
            }
        }
        return groups;
    }
    findInconsistenciesInGroup(group) {
        const inconsistencies = [];
        // Check for different names
        const names = new Set(group.map(c => c.name).filter(n => n));
        if (names.size > 1) {
            inconsistencies.push(`different names: ${Array.from(names).join(', ')}`);
        }
        // Check for different organizations
        const orgs = new Set(group.map(c => c.organization).filter(o => o));
        if (orgs.size > 1) {
            inconsistencies.push(`different organizations: ${Array.from(orgs).join(', ')}`);
        }
        return inconsistencies;
    }
    /**
     * Generate cleanup report CSV file
     */
    async generateCleanupReport() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `cleanup-suggestions-${timestamp}.csv`;
        const filepath = path.join(process.cwd(), filename);
        const csvHeaders = [
            'Type',
            'Contact Name',
            'Source',
            'Issue',
            'Email',
            'Phone',
            'Recommended Action',
            'Related Contacts'
        ];
        const csvLines = [csvHeaders.join(',')];
        for (const suggestion of this.report.suggestions) {
            const relatedNames = suggestion.relatedContacts?.map(c => c.name).join('; ') || '';
            const row = [
                suggestion.type,
                `"${suggestion.contact.name || ''}"`,
                suggestion.contact.source,
                `"${suggestion.issue}"`,
                suggestion.contact.email || '',
                suggestion.contact.phone || '',
                `"${suggestion.suggestedAction}"`,
                `"${relatedNames}"`
            ];
            csvLines.push(row.join(','));
        }
        fs.writeFileSync(filepath, csvLines.join('\n'));
        console.log(`\n📄 Cleanup report saved to: ${filename}`);
    }
    /**
     * Wrapper methods to access ContactSync functionality
     */
    async fetchNotionContacts(type) {
        return this.contactSync.fetchNotionContacts(type);
    }
}
exports.ContactCleanup = ContactCleanup;
/**
 * CLI interface
 */
async function main() {
    console.log('🧹 Systematic Contact Cleanup');
    console.log('=============================\n');
    const cleanup = new ContactCleanup();
    try {
        const report = await cleanup.analyzeContacts();
        console.log('\n✅ Cleanup analysis completed successfully!');
        console.log(`\n📊 Final Summary:`);
        console.log(`   • Total contacts analyzed: ${report.totalContacts}`);
        console.log(`   • Total issues found: ${report.totalIssues}`);
        console.log(`   • Cleanup suggestions generated and saved to CSV`);
    }
    catch (error) {
        console.error('💥 Cleanup analysis failed:', error);
        process.exit(1);
    }
}
// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}
