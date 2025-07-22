import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
function loadEnvVars(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env');
  const envVars: Record<string, string> = {};
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          envVars[key] = valueParts.join('=');
        }
      }
    }
  }
  
  return envVars;
}

async function testNotionConnection() {
  const envVars = loadEnvVars();
  
  console.log('🔧 Testing Notion MCP Connection...');
  console.log('Environment variables loaded:');
  console.log('- NOTION_API_TOKEN:', envVars.NOTION_API_TOKEN ? `${envVars.NOTION_API_TOKEN.substring(0, 10)}...` : 'NOT SET');
  console.log('- OPENAPI_MCP_HEADERS:', envVars.OPENAPI_MCP_HEADERS ? 'SET' : 'NOT SET');
  console.log('- NOTION_PERSONAL_CONTACTS_DATABASE_ID:', envVars.NOTION_PERSONAL_CONTACTS_DATABASE_ID || 'NOT SET');
  
  // Set environment variables for the subprocess
  Object.assign(process.env, envVars);
  
  let notionClient: Client | null = null;
  
  try {
    console.log('\n📄 Connecting to Notion MCP server...');
    
    const notionTransport = new StdioClientTransport({
      command: "node",
      args: ["notion-mcp-server/bin/cli.mjs"],
      env: process.env as Record<string, string>
    });
    
    notionClient = new Client(
      {
        name: "contact-sync-test",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    await notionClient.connect(notionTransport);
    console.log('✅ Notion MCP server connected');
    
    // List available tools
    const tools = await notionClient.listTools();
    console.log(`📋 Available Notion tools: ${tools.tools.length}`);
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    
    // Test a simple query to the personal contacts database
    console.log('\n🔍 Testing database query...');
    const personalDbId = envVars.NOTION_PERSONAL_CONTACTS_DATABASE_ID;
    
    const result = await notionClient.callTool({
      name: "API-post-database-query",
      arguments: {
        database_id: personalDbId,
        page_size: 5
      }
    });
    
    if (result.isError) {
      console.log('❌ Database query failed:', result.content);
    } else {
      console.log('✅ Database query successful');
      console.log('Response:', JSON.stringify(result.content, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
  } finally {
    if (notionClient) {
      await notionClient.close();
      console.log('🧹 Notion connection closed');
    }
  }
}

if (require.main === module) {
  testNotionConnection().catch(console.error);
}
