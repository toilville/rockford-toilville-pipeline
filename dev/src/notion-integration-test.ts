#!/usr/bin/env node

/**
 * Test Notion integration with the provided token
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
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

async function testNotionWithToken() {
    console.log('🔑 Testing Notion integration with your token...');
    
    loadEnvVars();
    
    const notionToken = process.env.NOTION_API_TOKEN;
    if (!notionToken) {
        console.log('❌ No NOTION_API_TOKEN found in .env file');
        return false;
    }
    
    console.log(`🔍 Using token: ${notionToken.substring(0, 10)}...`);
    
    const transport = new StdioClientTransport({
        command: 'node',
        args: ['notion-mcp-server/bin/cli.mjs'],
        env: {
            ...process.env,
            NOTION_API_TOKEN: notionToken
        }
    });

    const client = new Client({
        name: 'notion-token-test',
        version: '1.0.0'
    }, {});

    try {
        await client.connect(transport);
        console.log('✅ Connected to Notion MCP server');

        // Test search for pages
        console.log('🔍 Searching for pages...');
        const result = await client.callTool({
            name: 'API-post-search',
            arguments: {
                filter: {
                    property: 'object',
                    value: 'page'
                },
                page_size: 5
            }
        });

        if (result.content && Array.isArray(result.content) && result.content[0]) {
            const content = result.content[0];
            if (typeof content === 'object' && 'text' in content) {
                const response = JSON.parse(content.text);
                console.log(`📋 Found ${response.results?.length || 0} pages in your Notion workspace`);
                
                if (response.results && response.results.length > 0) {
                    console.log('\nAvailable pages:');
                    response.results.forEach((page: any, index: number) => {
                        const title = page.properties?.title?.title?.[0]?.text?.content || 
                                     page.properties?.Name?.title?.[0]?.text?.content || 
                                     'Untitled Page';
                        console.log(`  ${index + 1}. "${title}" (ID: ${page.id})`);
                    });
                    
                    // Save the first page ID for potential database creation
                    const firstPageId = response.results[0].id;
                    console.log(`\n💡 You can create a contacts database in the first page using ID: ${firstPageId}`);
                    
                    return { success: true, pageId: firstPageId };
                } else {
                    console.log('📝 No pages found - you may need to create a page first in Notion');
                    return { success: true, pageId: null };
                }
            }
        }
        
        console.log('⚠️  Unexpected response format');
        return { success: false, pageId: null };
        
    } catch (error) {
        console.log('❌ Notion integration test failed:', error);
        if (error instanceof Error) {
            console.log('Details:', error.message);
        }
        return { success: false, pageId: null };
    } finally {
        await transport.close();
    }
}

async function main() {
    console.log('🔑 Notion Integration Test');
    console.log('==========================\n');
    
    const result = await testNotionWithToken();
    
    if (result && typeof result === 'object' && result.success) {
        console.log('\n🎉 Notion integration is working!');
        
        if (result.pageId) {
            console.log('\n🚀 Next steps:');
            console.log('1. Run: npm run setup (to test the complete system)');
            console.log('2. Run: npm run sync:dry-run (to test contact sync)');
            console.log('3. Run: npm run sync (for full synchronization)');
        } else {
            console.log('\n📝 Next steps:');
            console.log('1. Create a page in Notion where you want the contacts database');
            console.log('2. Share that page with your "Contact Sync" integration');
            console.log('3. Run the setup wizard again');
        }
    } else {
        console.log('\n❌ Notion integration needs attention');
        console.log('1. Verify your token is correct');
        console.log('2. Make sure your integration has proper permissions');
        console.log('3. Check that you have pages in your Notion workspace');
    }
}

main().catch(console.error);
