#!/usr/bin/env node

/**
 * Test if the database IDs in .env are valid
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
function loadEnvVars() {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envVars = envContent.split('\n').reduce((acc, line) => {
            const [key, value] = line.split('=');
            if (key && value) {
                acc[key.trim()] = value.trim();
            }
            return acc;
        }, {} as Record<string, string>);
        
        // Set environment variables
        Object.entries(envVars).forEach(([key, value]) => {
            process.env[key] = value;
        });
        
        return envVars;
    }
    return {};
}

function validateDatabaseId(id: string, name: string): boolean {
    console.log(`🔍 Checking ${name}:`);
    console.log(`   ID: ${id}`);
    
    // Notion database IDs should be 32 characters of hex (no hyphens)
    const cleanId = id.replace(/-/g, '');
    console.log(`   Clean ID: ${cleanId}`);
    console.log(`   Length: ${cleanId.length}`);
    
    if (cleanId.length !== 32) {
        console.log(`   ❌ Invalid length (should be 32, got ${cleanId.length})`);
        return false;
    }
    
    if (!/^[a-f0-9]+$/i.test(cleanId)) {
        console.log(`   ❌ Invalid format (should be hex)`);
        return false;
    }
    
    console.log(`   ✅ Format looks correct`);
    return true;
}

async function testDatabaseAccess(id: string, name: string) {
    console.log(`\n🧪 Testing access to ${name}...`);
    
    try {
        const { ContactSync } = await import('./contact-sync');
        const manager = new ContactSync();
        await manager.initialize();
        
        // Try to fetch a limited set of contacts
        if (name.includes('personal')) {
            const contacts = await manager.fetchNotionContacts('personal');
            console.log(`✅ Successfully accessed ${name}: ${contacts.length} contacts found`);
            return true;
        } else {
            const contacts = await manager.fetchNotionContacts('company');
            console.log(`✅ Successfully accessed ${name}: ${contacts.length} contacts found`);
            return true;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`❌ Failed to access ${name}: ${errorMessage}`);
        return false;
    }
}

async function main() {
    console.log('🔎 Database ID Validation Test');
    console.log('===============================\n');
    
    const envVars = loadEnvVars();
    
    console.log('📋 Current database IDs in .env:');
    const personalId = envVars.NOTION_PERSONAL_CONTACTS_DATABASE_ID;
    const companyId = envVars.NOTION_COMPANY_CONTACTS_DATABASE_ID;
    
    if (!personalId || !companyId) {
        console.log('❌ Missing database IDs in .env file');
        return;
    }
    
    // Validate format
    console.log('\n🔍 Format validation:');
    const personalValid = validateDatabaseId(personalId, 'Personal Contacts DB');
    const companyValid = validateDatabaseId(companyId, 'Company Contacts DB');
    
    if (!personalValid || !companyValid) {
        console.log('\n❌ Database ID format validation failed');
        console.log('💡 Notion database IDs should be 32-character hex strings');
        console.log('💡 You can find them in the URL when viewing the database in Notion');
        return;
    }
    
    // Test actual access
    console.log('\n🚀 Testing actual database access...');
    
    const personalAccess = await testDatabaseAccess(personalId, 'Personal Contacts DB');
    const companyAccess = await testDatabaseAccess(companyId, 'Company Contacts DB');
    
    if (personalAccess && companyAccess) {
        console.log('\n🎉 All database IDs are working correctly!');
    } else {
        console.log('\n⚠️  Some database IDs may be incorrect or inaccessible');
        console.log('💡 Check that:');
        console.log('   - The database IDs are correct');
        console.log('   - Your Notion integration has access to these databases');
        console.log('   - The databases exist and aren\'t deleted');
    }
}

main().catch(console.error);
