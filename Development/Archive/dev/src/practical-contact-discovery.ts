import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as fs from 'fs';
import * as path from 'path';

/**
 * Practical Contact Discovery Workflow
 * 
 * Since Apple MCP times out with 190+ contacts, this tool:
 * 1. Gets all existing Notion contacts (this works fine - 131 found)
 * 2. Searches Apple for random/common names to discover new contacts
 * 3. Creates validation tasks for Peter Swimm for any novel contacts found
 */

interface Contact {
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  organization?: string;
  source: 'apple';
  needsValidation: boolean;
}

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

class PracticalContactDiscovery {
  private appleClient: Client | null = null;
  private notionClient: Client | null = null;
  private envConfig: Record<string, string>;
  private dryRun: boolean;

  constructor(dryRun = false) {
    this.envConfig = loadEnvVars();
    this.dryRun = dryRun;
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Practical Contact Discovery...');
    
    // Set environment variables for subprocesses
    Object.assign(process.env, this.envConfig);

    await this.connectToApple();
    await this.connectToNotion();
  }

  private async connectToApple(): Promise<void> {
    console.log('📱 Connecting to Apple MCP server...');
    
    const appleTransport = new StdioClientTransport({
      command: "/opt/homebrew/bin/apple-mcp",
      args: []
    });
    
    this.appleClient = new Client(
      {
        name: "practical-contact-discovery",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    await this.appleClient.connect(appleTransport);
    console.log('✅ Apple MCP server connected');
  }

  private async connectToNotion(): Promise<void> {
    console.log('📄 Connecting to Notion MCP server...');
    
    const notionTransport = new StdioClientTransport({
      command: "node",
      args: ["notion-mcp-server/bin/cli.mjs"],
      env: process.env as Record<string, string>
    });
    
    this.notionClient = new Client(
      {
        name: "practical-contact-discovery",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    await this.notionClient.connect(notionTransport);
    console.log('✅ Notion MCP server connected');
  }

  /**
   * Search Apple contacts by specific name
   */
  private async searchAppleContacts(searchName: string): Promise<Contact[]> {
    if (!this.appleClient) throw new Error('Apple client not initialized');

    console.log(`   🔍 Searching Apple contacts for "${searchName}"...`);
    
    const result = await this.appleClient.callTool({
      name: "contacts",
      arguments: { name: searchName }
    });

    if (result.isError || !result.content) {
      console.log(`     ⚠️  Search failed for "${searchName}"`);
      return [];
    }

    const firstContent = Array.isArray(result.content) ? result.content[0] : result.content;
    const contactText = (firstContent && typeof firstContent === 'object' && 'text' in firstContent) 
                       ? (firstContent as any).text 
                       : '';
    
    const contacts = this.parseAppleContacts(contactText);
    console.log(`     📱 Found ${contacts.length} matches for "${searchName}"`);
    return contacts;
  }

  /**
   * Parse Apple contacts from text response
   */
  private parseAppleContacts(contactText: string): Contact[] {
    const contacts: Contact[] = [];
    const lines = contactText.split('\n').filter(line => line.trim() && !line.startsWith('Found '));

    for (const line of lines) {
      const match = line.match(/^(.+?):\s*(.*)$/);
      if (match) {
        const [, name, details] = match;
        const parts = details.split(', ').filter(p => p.trim());
        
        const contact: Contact = {
          name: name.trim(),
          source: 'apple',
          needsValidation: true
        };

        // Parse contact details
        for (const part of parts) {
          if (part.includes('@')) {
            contact.email = part.trim();
          } else if (part.match(/[\d\-\(\)\+\s]{7,}/)) {
            contact.phone = part.trim();
          } else if (part.includes('Organization:')) {
            contact.organization = part.replace('Organization:', '').trim();
          }
        }

        // Try to extract first/last name
        const nameParts = name.trim().split(' ');
        if (nameParts.length >= 2) {
          contact.firstName = nameParts[0];
          contact.lastName = nameParts.slice(1).join(' ');
        } else {
          contact.firstName = name.trim();
        }

        contacts.push(contact);
      }
    }

    return contacts;
  }

  /**
   * Get existing Notion contacts as a Set for fast lookup
   */
  private async getNotionContactsIndex(): Promise<Set<string>> {
    if (!this.notionClient) throw new Error('Notion client not initialized');

    const existingContacts = new Set<string>();

    // Fetch from personal database
    await this.addNotionContactsToSet(this.envConfig.NOTION_PERSONAL_CONTACTS_DATABASE_ID, existingContacts);
    
    // Fetch from company database  
    await this.addNotionContactsToSet(this.envConfig.NOTION_COMPANY_CONTACTS_DATABASE_ID, existingContacts);

    return existingContacts;
  }

  private async addNotionContactsToSet(databaseId: string, contactSet: Set<string>): Promise<void> {
    if (!databaseId || !this.notionClient) return;

    try {
      const result = await this.notionClient.callTool({
        name: "API-post-database-query",
        arguments: {
          database_id: databaseId,
          page_size: 100
        }
      });

      if (!result.isError && result.content && Array.isArray(result.content) && result.content[0]) {
        const content = result.content[0];
        if (typeof content === 'object' && 'text' in content) {
          const response = JSON.parse((content as any).text);
          const contacts = response.results || [];
          
          contacts.forEach((contact: any) => {
            const props = contact.properties || {};
            const name = props.Name?.title?.[0]?.plain_text || '';
            const firstName = props['First Name']?.rich_text?.[0]?.plain_text || '';
            const lastName = props['Last Name']?.rich_text?.[0]?.plain_text || '';
            const email = props.Email?.email || '';
            
            // Add various name combinations to catch matches
            if (name) contactSet.add(name.toLowerCase().trim());
            if (firstName && lastName) contactSet.add(`${firstName} ${lastName}`.toLowerCase().trim());
            if (email) contactSet.add(email.toLowerCase().trim());
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to fetch contacts from database ${databaseId}:`, error);
    }
  }

  /**
   * Check if a contact is novel (not in Notion)
   */
  private isContactNovel(contact: Contact, existingContacts: Set<string>): boolean {
    const nameMatch = existingContacts.has(contact.name.toLowerCase().trim());
    const emailMatch = contact.email && existingContacts.has(contact.email.toLowerCase().trim());
    const fullNameMatch = contact.firstName && contact.lastName && 
      existingContacts.has(`${contact.firstName} ${contact.lastName}`.toLowerCase().trim());
    
    return !nameMatch && !emailMatch && !fullNameMatch;
  }

  /**
   * Create validation task in Notion for novel contact
   */
  private async createValidationTask(contact: Contact): Promise<boolean> {
    if (!this.notionClient) throw new Error('Notion client not initialized');

    if (this.dryRun) {
      console.log(`   🔍 [DRY RUN] Would create validation task for: ${contact.name}`);
      console.log(`      Email: ${contact.email || 'None'}`);
      console.log(`      Phone: ${contact.phone || 'None'}`);
      console.log(`      Organization: ${contact.organization || 'None'}`);
      console.log(`      Assignee: Peter Swimm`);
      console.log(`      Action: Validate and add to sales pipeline`);
      return true;
    }

    try {
      // Create new contact record in personal database with validation task
      const result = await this.notionClient.callTool({
        name: "API-post-page",
        arguments: {
          parent: {
            database_id: this.envConfig.NOTION_PERSONAL_CONTACTS_DATABASE_ID
          },
          properties: {
            Name: {
              title: [{ text: { content: contact.name } }]
            },
            "First Name": {
              rich_text: contact.firstName ? [{ text: { content: contact.firstName } }] : []
            },
            "Last Name": {
              rich_text: contact.lastName ? [{ text: { content: contact.lastName } }] : []
            },
            Email: {
              email: contact.email || null
            },
            Phone: {
              phone_number: contact.phone || null
            },
            Status: {
              multi_select: [{ name: "Needs Validation" }]
            },
            "Form message": {
              rich_text: [{ 
                text: { 
                  content: `Novel contact discovered from Apple Contacts. Assigned to Peter Swimm for validation and sales pipeline evaluation. ${contact.email ? `Email: ${contact.email}. ` : ''}${contact.phone ? `Phone: ${contact.phone}. ` : ''}${contact.organization ? `Organization: ${contact.organization}.` : ''}`
                } 
              }]
            }
          }
        }
      });

      return !result.isError;
    } catch (error) {
      console.error(`❌ Failed to create validation task for ${contact.name}:`, error);
      return false;
    }
  }

  /**
   * Main discovery workflow using targeted searches
   */
  async discoverNovelContacts(): Promise<void> {
    try {
      console.log('\n🔍 Starting Practical Contact Discovery Workflow...');
      console.log('========================================================');
      console.log('Strategy: Search Apple for common names to find novel contacts');
      
      // Get existing Notion contacts
      console.log('\n📋 Building index of existing Notion contacts...');
      const existingNotionContacts = await this.getNotionContactsIndex();
      console.log(`📊 Found ${existingNotionContacts.size} existing contacts in Notion databases`);

      // Search Apple for common names to discover new contacts
      console.log('\n📱 Searching Apple contacts using common name patterns...');
      const novelContacts: Contact[] = [];
      
      // Use common first names and some variations
      const searchTerms = [
        // Common first names
        'John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Chris', 'Amy',
        'Tom', 'Mary', 'Steve', 'Anna', 'Paul', 'Emma', 'Mark', 'Kate',
        'Alex', 'Jessica', 'Dan', 'Jennifer', 'Kevin', 'Linda', 'Matt', 'Lisa',
        // Some business-related terms
        'CEO', 'Manager', 'Director', 'Sales', 'Marketing',
        // Some partial surname searches
        'Smith', 'Johnson', 'Brown', 'Davis', 'Wilson', 'Miller'
      ];

      for (const searchTerm of searchTerms) {
        try {
          const appleResults = await this.searchAppleContacts(searchTerm);
          
          // Check each result against Notion
          for (const appleContact of appleResults) {
            const isNovel = this.isContactNovel(appleContact, existingNotionContacts);
            if (isNovel && !novelContacts.find(c => c.name.toLowerCase() === appleContact.name.toLowerCase())) {
              novelContacts.push(appleContact);
              console.log(`     🆕 Novel contact: ${appleContact.name}${appleContact.email ? ` (${appleContact.email})` : ''}`);
            }
          }
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.warn(`⚠️  Failed to search for "${searchTerm}":`, error);
        }
      }

      console.log(`\n🆕 Discovered ${novelContacts.length} novel contacts not in Notion:`);

      if (novelContacts.length === 0) {
        console.log('✅ No new contacts discovered with the current search terms.');
        console.log('💡 This might mean most Apple contacts are already in Notion, or different search terms are needed.');
        return;
      }

      // Show preview
      console.log('\n📋 Preview of novel contacts:');
      novelContacts.slice(0, 10).forEach((contact: Contact, index: number) => {
        console.log(`   ${index + 1}. ${contact.name}${contact.email ? ` (${contact.email})` : ''}${contact.phone ? ` (${contact.phone})` : ''}`);
      });

      // Create validation tasks for novel contacts
      console.log('\n📝 Creating validation tasks for Peter Swimm...');
      let successCount = 0;
      const contactsToProcess = novelContacts.slice(0, 15); // Process up to 15 contacts
      
      for (const contact of contactsToProcess) {
        const success = await this.createValidationTask(contact);
        if (success) {
          successCount++;
          console.log(`   ✅ Created validation task: ${contact.name}`);
        } else {
          console.log(`   ❌ Failed to create task: ${contact.name}`);
        }
      }

      console.log(`\n✅ Practical Contact Discovery Complete!`);
      console.log(`📊 Summary:`);
      console.log(`   • ${existingNotionContacts.size} existing contacts in Notion`);
      console.log(`   • ${novelContacts.length} novel contacts discovered`);
      console.log(`   • ${successCount} validation tasks created`);
      console.log(`   • Assigned to: Peter Swimm`);
      console.log(`   • Next step: Review validation tasks in Notion and add to sales pipeline`);

      if (novelContacts.length > contactsToProcess.length) {
        console.log(`\n📝 Note: ${novelContacts.length - contactsToProcess.length} additional novel contacts found.`);
        console.log(`   Increase the processing limit to handle all contacts.`);
      }

    } catch (error: any) {
      console.error('❌ Practical contact discovery failed:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up connections...');
    if (this.appleClient) {
      await this.appleClient.close();
    }
    if (this.notionClient) {
      await this.notionClient.close();
    }
  }
}

// Main execution
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('🔄 Practical Contact Discovery Tool');
  console.log('===================================');
  console.log(`🏃 Mode: ${dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
  
  const discovery = new PracticalContactDiscovery(dryRun);
  
  try {
    await discovery.initialize();
    await discovery.discoverNovelContacts();
  } catch (error) {
    console.error('💥 Discovery process failed:', error);
    process.exit(1);
  } finally {
    await discovery.cleanup();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
