import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function checkAppleMCPContactOperations() {
  console.log('🔍 Checking Apple MCP Contact Operations');
  console.log('=====================================\n');
  
  let appleClient: Client | null = null;
  
  try {
    console.log('📱 Connecting to Apple MCP server...');
    
    const appleTransport = new StdioClientTransport({
      command: "/opt/homebrew/bin/apple-mcp",
      args: []
    });
    
    appleClient = new Client(
      {
        name: "apple-contact-check",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    await appleClient.connect(appleTransport);
    console.log('✅ Apple MCP server connected\n');
    
    // List all available tools
    const tools = await appleClient.listTools();
    console.log(`📋 Available Apple MCP tools: ${tools.tools.length}\n`);
    
    // Focus on contact-related tools
    const contactTools = tools.tools.filter(tool => 
      tool.name.toLowerCase().includes('contact') || 
      (tool.description && tool.description.toLowerCase().includes('contact'))
    );
    
    if (contactTools.length > 0) {
      console.log('👥 Contact-related tools:');
      contactTools.forEach(tool => {
        console.log(`\n📱 Tool: ${tool.name}`);
        console.log(`   Description: ${tool.description}`);
        
        if (tool.inputSchema && typeof tool.inputSchema === 'object') {
          const schema = tool.inputSchema as any;
          if (schema.properties) {
            console.log('   Parameters:');
            Object.entries(schema.properties).forEach(([param, details]: [string, any]) => {
              const required = schema.required?.includes(param) ? ' (required)' : ' (optional)';
              console.log(`     - ${param}${required}: ${details.description || details.type || 'No description'}`);
            });
          }
        }
      });
    } else {
      console.log('⚠️  No contact-specific tools found. Let me list all tools:');
      tools.tools.forEach(tool => {
        console.log(`\n📱 Tool: ${tool.name}`);
        console.log(`   Description: ${tool.description}`);
        
        if (tool.inputSchema && typeof tool.inputSchema === 'object') {
          const schema = tool.inputSchema as any;
          if (schema.properties) {
            console.log('   Parameters:');
            Object.entries(schema.properties).forEach(([param, details]: [string, any]) => {
              const required = schema.required?.includes(param) ? ' (required)' : ' (optional)';
              console.log(`     - ${param}${required}: ${details.description || details.type || 'No description'}`);
            });
          }
        }
      });
    }
    
    // Try to get detailed info about the contacts tool specifically
    const contactsTool = tools.tools.find(tool => tool.name === 'contacts');
    if (contactsTool) {
      console.log('\n🔍 Detailed analysis of "contacts" tool:');
      console.log(JSON.stringify(contactsTool, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Failed to check Apple MCP operations:', error);
  } finally {
    if (appleClient) {
      await appleClient.close();
      console.log('\n🧹 Apple MCP connection closed');
    }
  }
}

if (require.main === module) {
  checkAppleMCPContactOperations().catch(console.error);
}
