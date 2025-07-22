#!/usr/bin/env node
"use strict";
/**
 * Complete setup guide for Contact Sync between Apple Contacts and Notion
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
const NOTION_INTEGRATION_URL = 'https://www.notion.so/my-integrations';
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
async function testAppleMCP() {
    console.log('\n🍎 Testing Apple MCP Server...');
    const transport = new stdio_js_1.StdioClientTransport({
        command: '/opt/homebrew/bin/apple-mcp',
        args: []
    });
    const client = new index_js_1.Client({
        name: 'setup-apple-test',
        version: '1.0.0'
    }, {});
    try {
        await client.connect(transport);
        // Test basic connection by listing available tools
        const tools = await client.listTools();
        console.log(`✅ Apple MCP connected - ${tools.tools.length} tools available`);
        // Check if contacts tool is available
        const contactsTool = tools.tools.find(tool => tool.name === 'contacts');
        if (contactsTool) {
            console.log('📱 Contacts tool is available');
            // Try a quick contacts call with timeout
            try {
                const result = await Promise.race([
                    client.callTool({ name: 'contacts', arguments: {} }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Tool call timeout')), 5000))
                ]);
                if (result && typeof result === 'object' && 'content' in result) {
                    console.log('✅ Contacts access working');
                    return true;
                }
            }
            catch (toolError) {
                console.log('⚠️  Contacts tool available but may need permissions');
                console.log('� Try running: bun trigger-permission.js');
                return true; // Connection works, just permissions issue
            }
        }
        else {
            console.log('⚠️  Contacts tool not found in available tools');
        }
        return true; // Connection successful
    }
    catch (error) {
        console.log('❌ Apple MCP connection failed:', error);
        return false;
    }
    finally {
        await transport.close();
    }
}
async function testNotionMCP() {
    console.log('\n📄 Testing Notion MCP Server...');
    const transport = new stdio_js_1.StdioClientTransport({
        command: 'node',
        args: ['notion-mcp-server/bin/cli.mjs']
    });
    const client = new index_js_1.Client({
        name: 'setup-notion-test',
        version: '1.0.0'
    }, {});
    try {
        await client.connect(transport);
        const tools = await client.listTools();
        console.log(`✅ Notion MCP working - ${tools.tools.length} tools available`);
        return true;
    }
    catch (error) {
        console.log('❌ Notion MCP connection failed:', error);
        return false;
    }
    finally {
        await transport.close();
    }
}
async function searchNotionPages() {
    console.log('\n🔍 Searching for existing Notion pages...');
    const transport = new stdio_js_1.StdioClientTransport({
        command: 'node',
        args: ['notion-mcp-server/bin/cli.mjs']
    });
    const client = new index_js_1.Client({
        name: 'setup-page-search',
        version: '1.0.0'
    }, {});
    try {
        await client.connect(transport);
        // Search for pages
        const result = await client.callTool({
            name: 'API-post-search',
            arguments: {
                filter: {
                    property: 'object',
                    value: 'page'
                },
                page_size: 10
            }
        });
        if (result.content && Array.isArray(result.content) && result.content[0]) {
            const content = result.content[0];
            if (typeof content === 'object' && 'text' in content) {
                const response = JSON.parse(content.text);
                console.log(`📋 Found ${response.results?.length || 0} pages in Notion`);
                if (response.results && response.results.length > 0) {
                    console.log('\nAvailable pages for database creation:');
                    response.results.forEach((page, index) => {
                        const title = page.properties?.title?.title?.[0]?.text?.content ||
                            page.properties?.Name?.title?.[0]?.text?.content ||
                            'Untitled Page';
                        console.log(`  ${index + 1}. "${title}" (ID: ${page.id})`);
                    });
                    return response.results;
                }
            }
        }
        console.log('📝 No pages found - you may need to create a page first');
        return [];
    }
    catch (error) {
        console.log('❌ Failed to search Notion pages:', error);
        console.log('🔑 This likely means you need to set up your Notion integration token');
        return [];
    }
    finally {
        await transport.close();
    }
}
function printSetupInstructions() {
    console.log('\n📋 SETUP INSTRUCTIONS');
    console.log('=====================');
    console.log('\n1. 🔑 Set up Notion Integration:');
    console.log(`   - Go to: ${NOTION_INTEGRATION_URL}`);
    console.log('   - Click "New integration"');
    console.log('   - Give it a name like "Contact Sync"');
    console.log('   - Copy the "Internal Integration Secret"');
    console.log('   - Set it as NOTION_API_TOKEN environment variable');
    console.log('\n2. 📄 Prepare a Notion page:');
    console.log('   - Create or choose a page where the contacts database will be created');
    console.log('   - Share the page with your integration (click Share → add your integration)');
    console.log('   - Copy the page ID from the URL');
    console.log('\n3. 🔄 Run the contact sync:');
    console.log('   - Test first: npm run sync:dry-run');
    console.log('   - Full sync: npm run sync');
    console.log('\n4. 📱 Ensure Apple permissions:');
    console.log('   - Contacts access should already be granted');
    console.log('   - If not, run: bun trigger-permission.js');
}
async function main() {
    console.log('🚀 Contact Sync Setup Wizard');
    console.log('============================');
    // Load environment variables
    loadEnvVars();
    // Check if Notion token is available
    const notionToken = process.env.NOTION_API_TOKEN;
    if (notionToken) {
        console.log('🔑 Notion integration token found');
    }
    else {
        console.log('⚠️  No Notion integration token found in .env file');
    }
    // Test both MCP servers
    const appleWorking = await testAppleMCP();
    const notionWorking = await testNotionMCP();
    if (appleWorking && notionWorking) {
        console.log('\n✅ Both MCP servers are working!');
        // Try to find existing pages
        const pages = await searchNotionPages();
        if (pages.length > 0) {
            console.log('\n🎉 Ready to create contacts database!');
            console.log('\nNext steps:');
            console.log('1. Choose a page ID from the list above');
            console.log('2. Run: npm run sync:dry-run');
        }
        else {
            console.log('\n⚠️  No pages found in Notion');
            printSetupInstructions();
        }
    }
    else {
        console.log('\n❌ Setup issues detected');
        if (!appleWorking) {
            console.log('\n🍎 Apple MCP Issues:');
            console.log('   - Ensure Apple MCP is installed: brew install dhravya/tap/apple-mcp');
            console.log('   - Grant contacts permissions: bun trigger-permission.js');
        }
        if (!notionWorking) {
            console.log('\n📄 Notion MCP Issues:');
            printSetupInstructions();
        }
    }
    console.log('\n💡 Need help? Check the README.md for detailed instructions');
}
main().catch(console.error);
