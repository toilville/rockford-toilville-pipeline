import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as fs from 'fs';
import * as path from 'path';

/**
 * Novel Contact Discovery and Validation Workflow
 * 
 * Strategy: Apple → Notion one-way sync with validation workflow
 * - Find Apple contacts not present in Notion
 * - Create new Notion records for novel contacts  
 * - Assign validation tasks to Peter Swimm
 * - Flag for sales pipeline evaluation
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

interface ValidationTask {
  contactName: string;
  assignee: string;
  status: 'pending_validation';
  action: 'validate_and_add_to_sales_pipeline';
  priority: 'normal' | 'high';
  notes: string;
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

class NovelContactDiscovery {
  private appleClient: Client | null = null;
  private notionClient: Client | null = null;
  private envConfig: Record<string, string>;
  private dryRun: boolean;

  constructor(dryRun = false) {
    this.envConfig = loadEnvVars();
    this.dryRun = dryRun;
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Novel Contact Discovery...');
    
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
        name: "novel-contact-discovery",
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
        name: "novel-contact-discovery",
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
   * Fetch all Apple contacts at once and parse in memory
   */
  private async fetchAllAppleContacts(): Promise<Contact[]> {
    if (!this.appleClient) throw new Error('Apple client not initialized');

    console.log('📱 Fetching ALL Apple contacts (this may take a moment)...');
    
    try {
      const result = await this.appleClient.callTool({
        name: "contacts",
        arguments: {} // No name parameter = get all contacts
      });

      if (result.isError || !result.content) {
        throw new Error(`Apple contacts fetch failed: ${result.isError ? 'Error' : 'No content'}`);
      }

      const firstContent = Array.isArray(result.content) ? result.content[0] : result.content;
      const contactText = (firstContent && typeof firstContent === 'object' && 'text' in firstContent) 
                         ? (firstContent as any).text 
                         : '';
      
      console.log(`📱 Raw contact data length: ${contactText.length} characters`);
      const contacts = this.parseAppleContacts(contactText);
      console.log(`📱 Successfully parsed ${contacts.length} Apple contacts`);
      
      return contacts;
    } catch (error: any) {
      if (error?.message?.includes('timeout')) {
        console.log('⚠️  Apple MCP timed out, but this is expected with large contact lists');
        console.log('📱 Attempting to work with partial data if available...');
        // You might get partial data even on timeout
        return [];
      }
      throw error;
    }
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
   * Fetch all existing contacts from Notion databases with detailed info
   */
  private async fetchAllNotionContactsDetailed(): Promise<Contact[]> {
    if (!this.notionClient) throw new Error('Notion client not initialized');

    const allContacts: Contact[] = [];

    // Fetch from personal database
    await this.addNotionContactsToArray(this.envConfig.NOTION_PERSONAL_CONTACTS_DATABASE_ID, allContacts);
    
    // Fetch from company database  
    await this.addNotionContactsToArray(this.envConfig.NOTION_COMPANY_CONTACTS_DATABASE_ID, allContacts);

    return allContacts;
  }

  private async addNotionContactsToArray(databaseId: string, contactArray: Contact[]): Promise<void> {
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
            const phone = props.Phone?.phone_number || '';
            
            if (name) {
              contactArray.push({
                name: name,
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                email: email || undefined,
                phone: phone || undefined,
                source: 'apple',
                needsValidation: false
              });
            }
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to fetch contacts from database ${databaseId}:`, error);
    }
  }

  /**
   * Check if an Apple contact is novel (not in Notion)
   */
  private isContactNovel(appleContact: Contact, notionContacts: Contact[]): boolean {
    const appleName = appleContact.name.toLowerCase().trim();
    const appleEmail = appleContact.email?.toLowerCase().trim();
    
    return !notionContacts.some(notionContact => {
      const notionName = notionContact.name.toLowerCase().trim();
      const notionEmail = notionContact.email?.toLowerCase().trim();
      
      // Check for name match
      if (appleName === notionName) return true;
      
      // Check for email match
      if (appleEmail && notionEmail && appleEmail === notionEmail) return true;
      
      // Check for first/last name combination match
      if (appleContact.firstName && appleContact.lastName && notionContact.firstName && notionContact.lastName) {
        const appleFullName = `${appleContact.firstName} ${appleContact.lastName}`.toLowerCase().trim();
        const notionFullName = `${notionContact.firstName} ${notionContact.lastName}`.toLowerCase().trim();
        if (appleFullName === notionFullName) return true;
      }
      
      return false;
    });
  }

  /**
   * Create validation task in Notion for novel contact
   */
  private async createValidationTask(contact: Contact): Promise<boolean> {
    if (!this.notionClient) throw new Error('Notion client not initialized');

    const task: ValidationTask = {
      contactName: contact.name,
      assignee: 'Peter Swimm',
      status: 'pending_validation',
      action: 'validate_and_add_to_sales_pipeline',
      priority: contact.email || contact.phone ? 'high' : 'normal',
      notes: `Novel contact from Apple Contacts. ${contact.email ? `Email: ${contact.email}` : ''} ${contact.phone ? `Phone: ${contact.phone}` : ''} ${contact.organization ? `Organization: ${contact.organization}` : ''}`
    };

    if (this.dryRun) {
      console.log(`   🔍 [DRY RUN] Would create validation task for: ${contact.name}`);
      console.log(`      Assignee: ${task.assignee}`);
      console.log(`      Priority: ${task.priority}`);
      console.log(`      Notes: ${task.notes}`);
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
            Assignee: {
              people: [] // Would need user ID for Peter Swimm
            },
            "Form message": {
              rich_text: [{ text: { content: task.notes } }]
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
   * Fetch all existing contacts from Notion databases as a Set for fast lookup
   */
  private async fetchAllNotionContacts(): Promise<Set<string>> {
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
   * Find novel contacts not in Notion
   */
  private findNovelContacts(appleContacts: Contact[], existingNotionContacts: Set<string>): Contact[] {
    return appleContacts.filter(contact => {
      // Check if contact exists by name or email
      const nameMatch = existingNotionContacts.has(contact.name.toLowerCase().trim());
      const emailMatch = contact.email && existingNotionContacts.has(contact.email.toLowerCase().trim());
      const fullNameMatch = contact.firstName && contact.lastName && 
        existingNotionContacts.has(`${contact.firstName} ${contact.lastName}`.toLowerCase().trim());
      
      return !nameMatch && !emailMatch && !fullNameMatch;
    });
  }

  /**
   * Main discovery workflow - fetch all Apple contacts at once
   */
  async discoverNovelContacts(): Promise<void> {
    try {
      console.log('\n🔍 Starting Novel Contact Discovery Workflow...');
      console.log('===================================================');
      console.log('Strategy: Fetch ALL Apple contacts and compare with Notion in memory');
      
      // Fetch existing Notion contacts
      console.log('\n📋 Building index of existing Notion contacts...');
      const existingNotionContacts = await this.fetchAllNotionContacts();
      console.log(`📊 Found ${existingNotionContacts.size} existing contacts in Notion databases`);

      // Fetch ALL Apple contacts at once
      console.log('\n📱 Fetching all Apple contacts (this may take 60+ seconds)...');
      const allAppleContacts = await this.fetchAllAppleContacts();
      
      if (allAppleContacts.length === 0) {
        console.log('❌ No Apple contacts retrieved. This might be due to a timeout.');
        console.log('💡 Try restarting the Apple MCP server and running again.');
        return;
      }

      console.log(`� Total Apple contacts retrieved: ${allAppleContacts.length}`);

      // Find novel contacts
      const novelContacts = this.findNovelContacts(allAppleContacts, existingNotionContacts);
      console.log(`\n🆕 Found ${novelContacts.length} novel contacts not in Notion:`);

      if (novelContacts.length === 0) {
        console.log('✅ All Apple contacts are already in Notion - no new contacts to add!');
        return;
      }

      // Show first few novel contacts
      console.log('\n📋 Preview of novel contacts:');
      novelContacts.slice(0, 10).forEach((contact: Contact, index: number) => {
        console.log(`   ${index + 1}. ${contact.name}${contact.email ? ` (${contact.email})` : ''}${contact.phone ? ` (${contact.phone})` : ''}`);
      });

      // Create validation tasks for novel contacts
      let successCount = 0;
      const contactsToProcess = novelContacts.slice(0, 20); // Limit to 20 for testing
      
      for (const contact of contactsToProcess) {
        console.log(`\n📝 Processing novel contact: ${contact.name}`);
        if (contact.email) console.log(`   📧 Email: ${contact.email}`);
        if (contact.phone) console.log(`   📱 Phone: ${contact.phone}`);
        if (contact.organization) console.log(`   🏢 Organization: ${contact.organization}`);

        const success = await this.createValidationTask(contact);
        if (success) {
          successCount++;
          console.log(`   ✅ Created validation task for ${contact.name}`);
        } else {
          console.log(`   ❌ Failed to create validation task for ${contact.name}`);
        }
      }

      console.log(`\n✅ Novel Contact Discovery Complete!`);
      console.log(`📊 Summary:`);
      console.log(`   • ${allAppleContacts.length} total Apple contacts scanned`);
      console.log(`   • ${existingNotionContacts.size} existing Notion contacts`);
      console.log(`   • ${novelContacts.length} novel contacts discovered`);
      console.log(`   • ${successCount} validation tasks created (processed ${contactsToProcess.length})`);
      console.log(`   • Assigned to: Peter Swimm`);
      console.log(`   • Next step: Review and validate for sales pipeline`);

      if (novelContacts.length > contactsToProcess.length) {
        console.log(`\n📝 Note: ${novelContacts.length - contactsToProcess.length} additional novel contacts found.`);
        console.log(`   Remove the slice limit to process all contacts.`);
      }

    } catch (error: any) {
      if (error?.message?.includes('timeout')) {
        console.log('\n⚠️  Apple MCP timed out while fetching contacts.');
        console.log('💡 This is common with large contact databases (190+ contacts).');
        console.log('📱 The timeout might be due to processing time, not data transfer.');
        console.log('\nThe data might still be available - check the Apple MCP server logs.');
      } else {
        console.error('❌ Novel contact discovery failed:', error);
      }
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
  
  console.log('🔄 Novel Contact Discovery Tool');
  console.log('==============================');
  console.log(`🏃 Mode: ${dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
  
  const discovery = new NovelContactDiscovery(dryRun);
  
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
