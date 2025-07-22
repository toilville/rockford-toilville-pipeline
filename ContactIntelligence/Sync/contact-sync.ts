import { config } from 'dotenv';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

/**
 * Standardized contact data structure
 */
interface Contact {
  id?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  organization?: string;
  notionId?: string;
  lastUpdated?: string;
  contactType?: 'personal' | 'company';
  lastModified: Date;
  source: 'notion' | 'import';
}

/**
 * Sync configuration and options
 */
interface SyncOptions {
  dryRun: boolean;
  direction: 'notion-only' | 'import-to-notion';
  conflictResolution: 'latest' | 'notion-wins' | 'import-wins';
  batchSize: number;
}

/**
 * Environment configuration
 */
interface EnvConfig {
  notionApiToken: string;
  personalDatabaseId: string;
  companyDatabaseId: string;
  defaultContactType: 'personal' | 'company';
}

// Load environment variables from .env file
function loadEnvVars(): EnvConfig {
  const envPath = path.join(process.cwd(), '.env');
  const envVars: Record<string, string> = {};
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim();
      }
    });
  }

  return {
    notionApiToken: envVars.NOTION_API_TOKEN || '',
    personalDatabaseId: envVars.NOTION_PERSONAL_CONTACTS_DATABASE_ID || '',
    companyDatabaseId: envVars.NOTION_COMPANY_CONTACTS_DATABASE_ID || '',
    defaultContactType: (envVars.DEFAULT_CONTACT_TYPE as 'personal' | 'company') || 'personal'
  };
}

/**
 * Contact Management Engine
 * Manages contacts within Notion databases and supports import functionality
 */
class ContactSync {
  private notionClient: Client | null = null;
  private notionTransport: StdioClientTransport | null = null;
  private options: SyncOptions;
  private envConfig: EnvConfig;

  constructor(options: Partial<SyncOptions> = {}) {
    this.envConfig = loadEnvVars();
    this.options = {
      dryRun: false,
      direction: 'notion-only',
      conflictResolution: 'latest',
      batchSize: 50,
      ...options
    };
  }

  /**
   * Initialize connections to Notion MCP server
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Contact Manager...');
    
    try {
      // Connect to Notion MCP server
      console.log('📄 Connecting to Notion MCP server...');
      console.log('🐛 Debug - Environment variables being passed:');
      console.log('   NOTION_API_TOKEN:', process.env.NOTION_API_TOKEN?.substring(0, 15) + '...');
      console.log('   OPENAPI_MCP_HEADERS:', process.env.OPENAPI_MCP_HEADERS);
      
      this.notionTransport = new StdioClientTransport({
        command: "node",
        args: ["notion-mcp-server/bin/cli.mjs"],
        env: {
          ...process.env,
          OPENAPI_MCP_HEADERS: process.env.OPENAPI_MCP_HEADERS || '{}',
          NOTION_API_TOKEN: process.env.NOTION_API_TOKEN || ''
        }
      });

      this.notionClient = new Client({
        name: "contact-manager-notion",
        version: "1.0.0"
      }, {});

      await this.notionClient.connect(this.notionTransport);
      console.log('✅ Notion MCP server connected');

    } catch (error) {
      console.error('❌ Failed to initialize MCP connection:', error);
      throw error;
    }
  }

  /**
   * Import contacts from CSV file
   */
  async importContactsFromCSV(filePath: string): Promise<Contact[]> {
    console.log(`� Importing contacts from CSV: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }

    const csvContent = fs.readFileSync(filePath, 'utf8');
    const contacts = this.parseCSVContacts(csvContent);
    
    console.log(`� Found ${contacts.length} contacts in CSV`);
    return contacts;
  }

  /**
   * Parse contacts from CSV content
   */
  private parseCSVContacts(csvContent: string): Contact[] {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const contacts: Contact[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      
      if (values.length !== headers.length) continue;

      const contact: Contact = {
        name: '',
        lastModified: new Date(),
        source: 'import' as const,
        contactType: 'personal'
      };

      headers.forEach((header, index) => {
        const value = values[index];
        switch (header) {
          case 'name':
          case 'full name':
          case 'contact name':
            contact.name = value;
            break;
          case 'first name':
          case 'firstname':
            contact.firstName = value;
            break;
          case 'last name':
          case 'lastname':
            contact.lastName = value;
            break;
          case 'email':
          case 'email address':
            contact.email = value;
            break;
          case 'phone':
          case 'phone number':
            contact.phone = value;
            break;
          case 'company':
          case 'organization':
            contact.organization = value;
            if (value) contact.contactType = 'company';
            break;
        }
      });

      // Generate name if missing but have first/last
      if (!contact.name && (contact.firstName || contact.lastName)) {
        contact.name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
      }

      if (contact.name) {
        contacts.push(contact);
      }
    }

    return contacts;
  }

  /**
   * Categorize contact as personal or company based on name and details
   */
  private categorizeContact(name: string, details: string): 'personal' | 'company' {
    // Company indicators
    const companyKeywords = [
      'inc', 'corp', 'company', 'llc', 'ltd', 'services', 'group', 
      'associates', 'partners', 'consulting', 'solutions', 'systems',
      'technologies', 'enterprises', 'industries', 'organization',
      'agency', 'firm', 'studio', 'clinic', 'hospital', 'restaurant',
      'cafe', 'store', 'shop', 'center', 'office'
    ];

    const nameAndDetails = (name + ' ' + details).toLowerCase();
    
    // Check if name contains company keywords
    if (companyKeywords.some(keyword => nameAndDetails.includes(keyword))) {
      return 'company';
    }

    // Check for business email domains
    if (details.includes('@') && !details.includes('@gmail.') && !details.includes('@yahoo.') && 
        !details.includes('@hotmail.') && !details.includes('@icloud.')) {
      return 'company';
    }

    // Default to personal
    return this.envConfig.defaultContactType;
  }

  /**
   * Create contacts database in Notion if it doesn't exist
   */
  private async ensureNotionContactsDatabase(): Promise<string> {
    if (!this.notionClient) throw new Error('Notion client not initialized');

    console.log('📄 Creating Notion contacts database...');

    // This would need a parent page ID - for now we'll return a placeholder
    // In a real implementation, you'd need to specify where to create the database
    const databaseProperties = {
      "Name": {
        "title": {}
      },
      "Email": {
        "email": {}
      },
      "Phone": {
        "phone_number": {}
      },
      "Company": {
        "rich_text": {}
      },
      "Last Modified": {
        "last_edited_time": {}
      },
      "Source": {
        "select": {
          "options": [
            { "name": "Apple", "color": "blue" },
            { "name": "Notion", "color": "green" },
            { "name": "Synced", "color": "purple" }
          ]
        }
      }
    };

    // Return placeholder database ID for now
    console.log('📄 Contacts database schema prepared');
    return 'contacts-db-placeholder';
  }

  /**
   * Sync contacts from Apple to Notion
   */
  private async syncAppleToNotion(appleContacts: Contact[]): Promise<void> {
    console.log(`🔄 Syncing ${appleContacts.length} contacts from Apple to Notion...`);

    // Separate contacts by type
    // Group contacts by type for routing to appropriate databases
    const personalContacts = appleContacts.filter(c => c.contactType === 'personal');
    const companyContacts = appleContacts.filter(c => c.contactType === 'company');

    console.log(`📊 Categorized: ${personalContacts.length} personal, ${companyContacts.length} company contacts`);

    if (this.options.dryRun) {
      console.log('🔍 DRY RUN: Would sync the following contacts to Notion:');
      console.log(`📱 Personal contacts (${personalContacts.length}):`);
      personalContacts.slice(0, 3).forEach(contact => {
        console.log(`  - ${contact.name} (${contact.email || 'no email'})`);
      });
      
      console.log(`🏢 Company contacts (${companyContacts.length}):`);
      companyContacts.slice(0, 3).forEach(contact => {
        console.log(`  - ${contact.name} (${contact.email || 'no email'})`);
      });
      
      if (appleContacts.length > 6) {
        console.log(`  ... and ${appleContacts.length - 6} more contacts`);
      }
      return;
    }

    // Sync personal contacts to personal database
    if (personalContacts.length > 0) {
      await this.syncContactsToDatabase(personalContacts, this.envConfig.personalDatabaseId, 'Personal');
    }

    // Sync company contacts to company database
    if (companyContacts.length > 0) {
      await this.syncContactsToDatabase(companyContacts, this.envConfig.companyDatabaseId, 'Company');
    }
  }

  /**
   * Sync contacts to a specific Notion database
   */
  private async syncContactsToDatabase(contacts: Contact[], databaseId: string, databaseType: string): Promise<void> {
    console.log(`📄 Syncing ${contacts.length} contacts to ${databaseType} database (${databaseId})`);

    for (const contact of contacts.slice(0, this.options.batchSize)) {
      try {
        console.log(`📝 Syncing ${databaseType.toLowerCase()} contact: ${contact.name}`);
        
        // Create page in the specified database
        const result = await this.notionClient!.callTool({
          name: 'API-post-page',
          arguments: {
            parent: {
              database_id: databaseId
            },
            properties: {
              title: [
                {
                  text: {
                    content: contact.name
                  }
                }
              ]
            }
          }
        });

        if (result.isError) {
          console.error(`❌ Failed to create page for ${contact.name}`);
        } else {
          console.log(`✅ Created page for ${contact.name}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to sync contact ${contact.name}:`, error);
      }
    }
  }

  /**
   * Main contact management process
   */
  async manage(): Promise<void> {
    try {
      await this.initialize();

      console.log('\n📊 Contact Management Summary:');
      console.log(`🏃 Mode: ${this.options.dryRun ? 'DRY RUN' : 'LIVE'}`);
      console.log(` Direction: ${this.options.direction}`);

      // Perform Notion-based contact management
      await this.manageNotionContacts();

      console.log('\n✅ Contact management completed successfully!');

    } catch (error) {
      console.error('\n❌ Contact management failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Notion-focused contact management
   */
  async manageNotionContacts(): Promise<void> {
    if (!this.notionClient) {
      throw new Error('Notion client not initialized');
    }

    console.log('� Managing Notion contacts...');

    try {
      // Fetch contacts from both Notion databases
      const notionPersonalContacts = await this.fetchNotionContacts('personal');
      const notionCompanyContacts = await this.fetchNotionContacts('company');
      
      console.log(`📊 Found ${notionPersonalContacts.length} personal contacts, ${notionCompanyContacts.length} company contacts`);

      if (this.options.direction === 'import-to-notion') {
        // Handle CSV import if specified
        console.log('📁 Import mode - looking for CSV files to import...');
        // This could be enhanced to specify CSV file path
      } else {
        // Notion-only management - analyze existing contacts
        await this.analyzeNotionContacts(notionPersonalContacts, notionCompanyContacts);
      }

    } catch (error) {
      console.error('❌ Notion contact management failed:', error);
      throw error;
    }
  }

  /**
   * Analyze existing Notion contacts for issues
   */
  private async analyzeNotionContacts(personalContacts: Contact[], companyContacts: Contact[]): Promise<void> {
    const allContacts = [...personalContacts, ...companyContacts];
    console.log(`🔍 Analyzing ${allContacts.length} total contacts for issues...`);

    // Find duplicates
    const duplicates = this.findDuplicatesInContacts(allContacts);
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} potential duplicate groups`);
    }

    // Find incomplete contacts
    const incomplete = allContacts.filter(c => !c.email || !c.phone || !c.name || c.name === 'Unknown');
    if (incomplete.length > 0) {
      console.log(`⚠️  Found ${incomplete.length} incomplete contacts`);
    }

    console.log(`✅ Contact analysis complete`);
  }

  /**
   * Find duplicate contacts
   */
  private findDuplicatesInContacts(contacts: Contact[]): Contact[][] {
    const duplicateGroups: Contact[][] = [];
    const processed = new Set<string>();

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const contactKey = `${contact.name}-${contact.email || ''}-${contact.phone || ''}`;
      
      if (processed.has(contactKey)) continue;
      
      const duplicates = contacts.filter((c, index) => 
        index !== i && this.contactsMatch(contact, c)
      );

      if (duplicates.length > 0) {
        duplicateGroups.push([contact, ...duplicates]);
        [contact, ...duplicates].forEach(c => {
          const key = `${c.name}-${c.email || ''}-${c.phone || ''}`;
          processed.add(key);
        });
      }
    }

    return duplicateGroups;
  }

  /**
   * Check if two contacts match (same person)
   */
  private contactsMatch(contact1: Contact, contact2: Contact): boolean {
    // Match by email if both have email
    if (contact1.email && contact2.email && contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
      return true;
    }

    // Match by phone if both have phone
    if (contact1.phone && contact2.phone) {
      const phone1 = contact1.phone.replace(/\D/g, ''); // Remove non-digits
      const phone2 = contact2.phone.replace(/\D/g, '');
      if (phone1 && phone2 && phone1 === phone2) {
        return true;
      }
    }

    // Match by full name if very similar
    if (contact1.name && contact2.name) {
      const name1 = contact1.name.toLowerCase().trim();
      const name2 = contact2.name.toLowerCase().trim();
      if (name1 === name2) {
        return true;
      }
    }

    return false;
  }

  /**
   * Merge data from import contact into Notion contact
   */
  private async mergeContactData(importContact: Contact, notionContact: Contact): Promise<void> {
    console.log(`� Merging data for ${importContact.name}`);
    
    // Create merged contact with import data taking precedence for missing fields
    const mergedContact: Contact = {
      ...notionContact,
      email: importContact.email || notionContact.email,
      phone: importContact.phone || notionContact.phone,
      organization: importContact.organization || notionContact.organization,
      firstName: importContact.firstName || notionContact.firstName,
      lastName: importContact.lastName || notionContact.lastName,
      lastUpdated: new Date().toISOString(),
      lastModified: new Date(),
      source: 'notion'
    };

    // Update the Notion contact
    if (!this.options.dryRun) {
      await this.updateNotionContact(mergedContact, notionContact);
    } else {
      console.log(`   🔍 [DRY RUN] Would merge: ${importContact.name}`);
    }
  }

  /**
   * Add a new contact to Notion
   */
  private async addContactToNotion(contact: Contact, databaseId: string, contactType: 'personal' | 'company'): Promise<void> {
    if (!this.notionClient) throw new Error('Notion client not initialized');

    console.log(`➕ Adding ${contactType} contact to Notion: ${contact.name}`);

    if (this.options.dryRun) {
      console.log(`   🔍 [DRY RUN] Would add: ${contact.name} (${contact.email})`);
      return;
    }

    try {
      await this.notionClient.callTool({
        name: "API-post-page",
        arguments: {
          parent: {
            database_id: databaseId
          },
          properties: {
            "Name": {
              title: [
                {
                  text: {
                    content: contact.name || "Unknown"
                  }
                }
              ]
            },
            "Email": {
              email: contact.email || null
            },
            "Phone": {
              phone_number: contact.phone || null
            },
            "Organization": {
              rich_text: [
                {
                  text: {
                    content: contact.organization || ""
                  }
                }
              ]
            },
            "First Name": {
              rich_text: [
                {
                  text: {
                    content: contact.firstName || ""
                  }
                }
              ]
            },
            "Last Name": {
              rich_text: [
                {
                  text: {
                    content: contact.lastName || ""
                  }
                }
              ]
            },
            "Contact Type": {
              select: {
                name: contactType
              }
            },
            "Sync Status": {
              select: {
                name: "Synced"
              }
            }
          }
        }
      });

      console.log(`✅ Successfully added ${contact.name} to Notion`);
    } catch (error) {
      console.error(`❌ Failed to add ${contact.name} to Notion:`, error);
    }
  }

  /**
   * Update an existing Notion contact
   */
  private async updateNotionContact(updatedContact: Contact, existingContact: Contact): Promise<void> {
    console.log(`🔄 Updating Notion contact: ${updatedContact.name}`);
    
    if (this.options.dryRun) {
      console.log(`   📧 Email: ${existingContact.email} → ${updatedContact.email}`);
      console.log(`   📱 Phone: ${existingContact.phone} → ${updatedContact.phone}`);
      console.log(`   🏢 Organization: ${existingContact.organization} → ${updatedContact.organization}`);
      return;
    }

    // TODO: Implement actual Notion contact update using API-patch-page
    // For now, just log what would be updated
    console.log(`   📧 Email: ${existingContact.email} → ${updatedContact.email}`);
    console.log(`   📱 Phone: ${existingContact.phone} → ${updatedContact.phone}`);
    console.log(`   🏢 Organization: ${existingContact.organization} → ${updatedContact.organization}`);
  }

  /**
   * Fetch contacts from a specific Notion database
   */
  async fetchNotionContacts(type: 'personal' | 'company'): Promise<Contact[]> {
    if (!this.notionClient) throw new Error('Notion client not initialized');

    const databaseId = type === 'personal' ? 
      this.envConfig.personalDatabaseId : 
      this.envConfig.companyDatabaseId;

    if (!databaseId) {
      console.log(`⚠️  No database ID configured for ${type} contacts`);
      return [];
    }

    console.log(`📋 Fetching ${type} contacts from Notion...`);

    try {
      let allContacts: Contact[] = [];
      let hasMore = true;
      let cursor: string | undefined = undefined;
      let pageCount = 0;

      while (hasMore) {
        pageCount++;
        console.log(`   📄 Fetching page ${pageCount}...`);

        const result = await this.notionClient.callTool({
          name: "API-post-database-query",
          arguments: {
            database_id: databaseId,
            page_size: 100, // Maximum page size
            ...(cursor && { start_cursor: cursor })
          }
        });

        if (result.content && Array.isArray(result.content) && result.content[0]) {
          const content = result.content[0];
          if (typeof content === 'object' && 'text' in content) {
            const response = JSON.parse((content as any).text);
            const pageContacts = this.parseNotionContacts(response.results || [], type);
            allContacts.push(...pageContacts);
            
            hasMore = response.has_more || false;
            cursor = response.next_cursor;
            
            console.log(`   ✅ Page ${pageCount}: ${pageContacts.length} contacts (total: ${allContacts.length})`);
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      console.log(`   🎉 Total ${type} contacts fetched: ${allContacts.length}`);
      return allContacts;
    } catch (error) {
      console.error(`❌ Failed to fetch ${type} contacts from Notion:`, error);
      return [];
    }
  }

  /**
   * Parse Notion contacts from API response
   */
  private parseNotionContacts(results: any[], type: 'personal' | 'company'): Contact[] {
    return results.map(page => {
      const props = page.properties || {};
      
      return {
        id: page.id, // Set the main id field to the Notion page ID
        name: props.Name?.title?.[0]?.text?.content || props.Title?.title?.[0]?.text?.content || "Unknown",
        email: props.Email?.email || "",
        phone: props.Phone?.phone_number || "",
        organization: props.Organization?.rich_text?.[0]?.text?.content || "",
        firstName: props["First Name"]?.rich_text?.[0]?.text?.content || "",
        lastName: props["Last Name"]?.rich_text?.[0]?.text?.content || "",
        lastUpdated: props["Last Updated"]?.date?.start || "",
        contactType: type,
        notionId: page.id,
        lastModified: new Date(),
        source: 'notion' as const
      };
    });
  }

  /**
   * Clean up connections
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up connections...');
    
    if (this.notionClient) {
      await this.notionClient.close();
      this.notionClient = null;
    }
    
    if (this.notionTransport) {
      await this.notionTransport.close();
      this.notionTransport = null;
    }
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const direction = args.find(arg => arg.startsWith('--direction='))?.split('=')[1] as SyncOptions['direction'] || 'notion-only';

  console.log('� Contact Manager Tool');
  console.log('=======================\n');

  const sync = new ContactSync({
    dryRun,
    direction,
    conflictResolution: 'latest',
    batchSize: 10
  });

  try {
    await sync.manage();
  } catch (error) {
    console.error('💥 Contact management failed:', error);
    process.exit(1);
  }
}

export { ContactSync, Contact, SyncOptions };
