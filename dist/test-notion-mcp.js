"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
async function testNotionMCP() {
    console.log('Testing Notion MCP server connection...');
    const transport = new stdio_js_1.StdioClientTransport({
        command: 'node',
        args: ['notion-mcp-server/bin/cli.mjs']
    });
    const client = new index_js_1.Client({
        name: 'notion-test-client',
        version: '1.0.0'
    }, {
        capabilities: {}
    });
    try {
        await client.connect(transport);
        console.log('✅ Connected to Notion MCP server');
        const tools = await client.listTools();
        console.log(`📋 Available tools: ${tools.tools.length}`);
        tools.tools.forEach((tool, index) => {
            console.log(`  ${index + 1}. ${tool.name}`);
        });
        console.log('🎉 Notion MCP server is working correctly!');
    }
    catch (error) {
        console.error('❌ Error connecting to Notion MCP server:', error);
        if (error instanceof Error) {
            console.error('Details:', error.message);
        }
    }
    finally {
        try {
            await transport.close();
        }
        catch (e) {
            // Ignore cleanup errors
        }
    }
}
testNotionMCP().catch(console.error);
