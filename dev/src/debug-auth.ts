#!/usr/bin/env node

/**
 * Debug Notion API authentication
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

async function testDirectNotionAPI() {
    console.log('🔍 Testing Direct Notion API Call\n');
    
    const envVars = loadEnvVars();
    const token = envVars.NOTION_API_TOKEN;
    const dbId = envVars.NOTION_PERSONAL_CONTACTS_DATABASE_ID;
    
    console.log(`🔑 Token: ${token?.substring(0, 15)}...`);
    console.log(`🗄️  Database ID: ${dbId}`);
    console.log('📡 Making direct API call to Notion...\n');
    
    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                page_size: 1
            })
        });
        
        console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
        
        const responseText = await response.text();
        console.log('📄 Response Body:');
        
        try {
            const jsonResponse = JSON.parse(responseText);
            console.log(JSON.stringify(jsonResponse, null, 2));
        } catch {
            console.log(responseText);
        }
        
        if (response.ok) {
            console.log('\n✅ Direct API call successful!');
            return true;
        } else {
            console.log('\n❌ Direct API call failed');
            return false;
        }
        
    } catch (error) {
        console.error('💥 Error making direct API call:', error);
        return false;
    }
}

async function testMCPServerConfig() {
    console.log('\n🔧 Testing MCP Server Configuration\n');
    
    // Check if the MCP server is reading env vars correctly
    console.log('Environment variables being passed to MCP:');
    console.log(`- NOTION_API_TOKEN: ${process.env.NOTION_API_TOKEN?.substring(0, 15)}...`);
    console.log(`- OPENAPI_MCP_HEADERS: ${process.env.OPENAPI_MCP_HEADERS?.substring(0, 50)}...`);
    
    // Check MCP server startup
    try {
        const { ContactSync } = await import('./contact-sync');
        const manager = new ContactSync();
        
        console.log('\n🚀 Initializing ContactSync...');
        await manager.initialize();
        
        console.log('✅ MCP server initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ MCP server initialization failed:', error);
        return false;
    }
}

async function main() {
    console.log('🐛 Notion API Authentication Debug');
    console.log('===================================\n');
    
    // Test 1: Direct API call
    const directSuccess = await testDirectNotionAPI();
    
    // Test 2: MCP server configuration
    const mcpSuccess = await testMCPServerConfig();
    
    console.log('\n📋 Debug Summary:');
    console.log(`- Direct Notion API: ${directSuccess ? '✅ Working' : '❌ Failed'}`);
    console.log(`- MCP Server Setup: ${mcpSuccess ? '✅ Working' : '❌ Failed'}`);
    
    if (!directSuccess) {
        console.log('\n💡 Troubleshooting Steps:');
        console.log('1. Check that your Notion API token is valid and not expired');
        console.log('2. Verify the integration has access to your database');
        console.log('3. Make sure the database ID is correct');
        console.log('4. Check if the database exists and isn\'t deleted');
    }
}

main().catch(console.error);
