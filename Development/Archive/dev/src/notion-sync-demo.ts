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

async function testNotionSyncDemo() {
  const envVars = loadEnvVars();
  
  console.log('🔄 Notion Contact Sync Demo');
  console.log('===========================\n');
  
  // Set environment variables for the subprocess
  Object.assign(process.env, envVars);
  
  let notionClient: Client | null = null;
  
  try {
    console.log('📄 Connecting to Notion MCP server...');
    
    const notionTransport = new StdioClientTransport({
      command: "node",
      args: ["notion-mcp-server/bin/cli.mjs"],
      env: process.env as Record<string, string>
    });
    
    notionClient = new Client(
      {
        name: "notion-sync-demo",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    await notionClient.connect(notionTransport);
    console.log('✅ Notion MCP server connected\n');
    
    // Fetch existing contacts from Notion
    console.log('📋 Fetching existing contacts from Notion personal database...');
    const personalDbId = envVars.NOTION_PERSONAL_CONTACTS_DATABASE_ID;
    
    const result = await notionClient.callTool({
      name: "API-post-database-query",
      arguments: {
        database_id: personalDbId,
        page_size: 10
      }
    });
    
    if (result.isError) {
      console.log('❌ Database query failed:', result.content);
      return;
    }
    
    const content = Array.isArray(result.content) && result.content.length > 0 ? result.content[0] : null;
    if (content && typeof content === 'object' && 'text' in content) {
      const response = JSON.parse((content as any).text);
      const contacts = response.results || [];
      
      console.log(`📊 Found ${contacts.length} existing contacts in Notion:`);
      
      contacts.forEach((contact: any, index: number) => {
        const props = contact.properties || {};
        const name = props.Name?.title?.[0]?.plain_text || 'Unnamed';
        const email = props.Email?.email || 'No email';
        const phone = props.Phone?.phone_number || 'No phone';
        const firstName = props['First Name']?.rich_text?.[0]?.plain_text || '';
        const lastName = props['Last Name']?.rich_text?.[0]?.plain_text || '';
        
        console.log(`  ${index + 1}. ${name}`);
        if (firstName || lastName) {
          console.log(`     Name: ${firstName} ${lastName}`.trim());
        }
        if (email !== 'No email') {
          console.log(`     Email: ${email}`);
        }
        if (phone !== 'No phone') {
          console.log(`     Phone: ${phone}`);
        }
        console.log('');
      });
      
      // Demo: Add a test contact
      console.log('📝 Demo: Adding a test contact to Notion...');
      const testResult = await notionClient.callTool({
        name: "API-post-page",
        arguments: {
          parent: {
            database_id: personalDbId
          },
          properties: {
            Name: {
              title: [
                {
                  text: {
                    content: "Test Contact from MCP Sync"
                  }
                }
              ]
            },
            "First Name": {
              rich_text: [
                {
                  text: {
                    content: "Test"
                  }
                }
              ]
            },
            "Last Name": {
              rich_text: [
                {
                  text: {
                    content: "Contact"
                  }
                }
              ]
            },
            Email: {
              email: "test@example.com"
            },
            Phone: {
              phone_number: "555-1234"
            }
          }
        }
      });
      
      if (testResult.isError) {
        console.log('❌ Failed to create test contact:', testResult.content);
      } else {
        console.log('✅ Successfully created test contact in Notion!');
        console.log('🎉 Notion sync capability confirmed working!');
      }
    }
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    if (notionClient) {
      await notionClient.close();
      console.log('\n🧹 Notion connection closed');
    }
  }
}

if (require.main === module) {
  testNotionSyncDemo().catch(console.error);
}
