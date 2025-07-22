#!/usr/bin/env node
"use strict";
/**
 * Single record test for Notion contact management
 * If successful, automatically runs full cleanup operation
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
    }
}
async function testSingleRecord() {
    console.log('🧪 Testing single Notion record access...');
    const { ContactSync } = await Promise.resolve().then(() => __importStar(require('./contact-sync')));
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
        }
        else {
            console.log('⚠️  No contacts found in database');
            return false;
        }
    }
    catch (error) {
        console.error('❌ Single record test FAILED:', error);
        return false;
    }
}
async function runFullCleanup() {
    console.log('\n🚀 Single record test passed! Running full cleanup operation...\n');
    const { ContactCleanup } = await Promise.resolve().then(() => __importStar(require('./systematic-contact-cleanup')));
    const cleanup = new ContactCleanup();
    try {
        console.log('📊 Analyzing all contacts for cleanup opportunities...');
        await cleanup.analyzeContacts();
        console.log('✅ Full cleanup analysis completed successfully!');
    }
    catch (error) {
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
    }
    else {
        console.log('\n❌ Single record test failed. Not proceeding with full cleanup.');
        console.log('💡 Please check your Notion API token and database configuration.');
    }
}
main().catch(console.error);
