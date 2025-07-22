#!/usr/bin/env node
"use strict";
/**
 * Test if the database IDs in .env are valid
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
        }, {});
        // Set environment variables
        Object.entries(envVars).forEach(([key, value]) => {
            process.env[key] = value;
        });
        return envVars;
    }
    return {};
}
function validateDatabaseId(id, name) {
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
async function testDatabaseAccess(id, name) {
    console.log(`\n🧪 Testing access to ${name}...`);
    try {
        const { ContactSync } = await Promise.resolve().then(() => __importStar(require('./contact-sync')));
        const manager = new ContactSync();
        await manager.initialize();
        // Try to fetch a limited set of contacts
        if (name.includes('personal')) {
            const contacts = await manager.fetchNotionContacts('personal');
            console.log(`✅ Successfully accessed ${name}: ${contacts.length} contacts found`);
            return true;
        }
        else {
            const contacts = await manager.fetchNotionContacts('company');
            console.log(`✅ Successfully accessed ${name}: ${contacts.length} contacts found`);
            return true;
        }
    }
    catch (error) {
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
    }
    else {
        console.log('\n⚠️  Some database IDs may be incorrect or inaccessible');
        console.log('💡 Check that:');
        console.log('   - The database IDs are correct');
        console.log('   - Your Notion integration has access to these databases');
        console.log('   - The databases exist and aren\'t deleted');
    }
}
main().catch(console.error);
