"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
async function testAppleConnectionOnly() {
    console.log('🍎 Testing Apple MCP Server Connection (No Tool Calls)...');
    const transport = new stdio_js_1.StdioClientTransport({
        command: '/opt/homebrew/bin/apple-mcp',
        args: []
    });
    const client = new index_js_1.Client({
        name: 'apple-connection-test',
        version: '1.0.0'
    }, {});
    try {
        await client.connect(transport);
        console.log('✅ Apple MCP server connected successfully');
        const tools = await client.listTools();
        console.log(`📋 Available tools: ${tools.tools.length}`);
        tools.tools.forEach((tool, index) => {
            console.log(`  ${index + 1}. ${tool.name}: ${tool.description}`);
        });
        // Check if contacts tool exists
        const contactsTool = tools.tools.find(tool => tool.name === 'contacts');
        if (contactsTool) {
            console.log('\n✅ Contacts tool is available');
            console.log('🔧 If sync fails, run: npm run permissions');
        }
        else {
            console.log('\n❌ Contacts tool not found');
        }
        return true;
    }
    catch (error) {
        console.error('❌ Apple MCP connection failed:', error);
        return false;
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
testAppleConnectionOnly().catch(console.error);
