#!/usr/bin/env node
"use strict";
/**
 * Test Notion integration with the provided token
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
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
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
async function testNotionWithToken() {
    console.log('🔑 Testing Notion integration with your token...');
    loadEnvVars();
    const notionToken = process.env.NOTION_API_TOKEN;
    if (!notionToken) {
        console.log('❌ No NOTION_API_TOKEN found in .env file');
        return false;
    }
    console.log(`🔍 Using token: ${notionToken.substring(0, 10)}...`);
    const transport = new stdio_js_1.StdioClientTransport({
        command: 'node',
        args: ['notion-mcp-server/bin/cli.mjs'],
        env: {
            ...process.env,
            NOTION_API_TOKEN: notionToken
        }
    });
    const client = new index_js_1.Client({
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
                    response.results.forEach((page, index) => {
                        const title = page.properties?.title?.title?.[0]?.text?.content ||
                            page.properties?.Name?.title?.[0]?.text?.content ||
                            'Untitled Page';
                        console.log(`  ${index + 1}. "${title}" (ID: ${page.id})`);
                    });
                    // Save the first page ID for potential database creation
                    const firstPageId = response.results[0].id;
                    console.log(`\n💡 You can create a contacts database in the first page using ID: ${firstPageId}`);
                    return { success: true, pageId: firstPageId };
                }
                else {
                    console.log('📝 No pages found - you may need to create a page first in Notion');
                    return { success: true, pageId: null };
                }
            }
        }
        console.log('⚠️  Unexpected response format');
        return { success: false, pageId: null };
    }
    catch (error) {
        console.log('❌ Notion integration test failed:', error);
        if (error instanceof Error) {
            console.log('Details:', error.message);
        }
        return { success: false, pageId: null };
    }
    finally {
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
        }
        else {
            console.log('\n📝 Next steps:');
            console.log('1. Create a page in Notion where you want the contacts database');
            console.log('2. Share that page with your "Contact Sync" integration');
            console.log('3. Run the setup wizard again');
        }
    }
    else {
        console.log('\n❌ Notion integration needs attention');
        console.log('1. Verify your token is correct');
        console.log('2. Make sure your integration has proper permissions');
        console.log('3. Check that you have pages in your Notion workspace');
    }
}
main().catch(console.error);
