#!/usr/bin/env node

/**
 * Single record test for Notion contact management
 * If successful, automatically runs full cleanup operation
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
    }
}

async function testSingleRecord() {
    console.log('🧪 Testing single Notion record access...');
    
    const { ContactSync } = await import('./contact-sync');
    const manager = new ContactSync();
    
    try {
        // Initialize the client first
        console.log('🔧 Initializing Notion client...');
        await manager.initialize();
        
        // Test connection by fetching just personal contacts first
        console.log('📡 Connecting to Notion...');
        const contacts = await manager.fetchNotionContacts('personal'); // Fetch personal contacts
        
        if (contacts.length > 0) {
            console.log('✅ Single record test SUCCESS!');
            console.log(`📊 Found ${contacts.length} contact(s)`);
            console.log(`👤 Sample contact: ${contacts[0].name} (${contacts[0].source})`);
            return true;
        } else {
            console.log('⚠️  No contacts found in database');
            return false;
        }
    } catch (error) {
        console.error('❌ Single record test FAILED:', error);
        return false;
    }
}

async function runFullCleanup() {
    console.log('\n🚀 Single record test passed! Running full cleanup operation...\n');
    
    const { ContactCleanup } = await import('./systematic-contact-cleanup');
    const cleanup = new ContactCleanup();
    
    try {
        console.log('📊 Analyzing all contacts for cleanup opportunities...');
        await cleanup.analyzeContacts();
        console.log('✅ Full cleanup analysis completed successfully!');
    } catch (error) {
        console.error('❌ Full cleanup failed:', error);
    }
}

async function main() {
    console.log('🔬 Single Record Test & Auto Cleanup');
    console.log('=====================================\n');
    
    // Load environment variables
    loadEnvVars();
    
    // Test single record first
    const singleTestPassed = await testSingleRecord();
    
    if (singleTestPassed) {
        // Automatically proceed to full cleanup
        await runFullCleanup();
    } else {
        console.log('\n❌ Single record test failed. Not proceeding with full cleanup.');
        console.log('💡 Please check your Notion API token and database configuration.');
    }
}

main().catch(console.error);
