"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotionSetupClient = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const child_process_1 = require("child_process");
/**
 * Notion MCP Setup Client
 * Sets up Notion database for contact synchronization
 */
class NotionSetupClient {
    constructor() {
        this.client = null;
        this.transport = null;
    }
    async connect() {
        try {
            console.log('Connecting to Notion MCP server...');
            // Start the Notion MCP server process
            const serverProcess = (0, child_process_1.spawn)('node', [
                'notion-mcp-server/build/src/init-server.js'
            ], {
                stdio: ['pipe', 'pipe', 'inherit'],
                cwd: '/Users/peterswimm/code/rockford-toilville-pipeline-intelligence'
            });
            this.transport = new stdio_js_1.StdioClientTransport({
                command: 'node',
                args: ['notion-mcp-server/bin/cli.mjs']
            });
            this.client = new index_js_1.Client({
                name: 'notion-setup-client',
                version: '1.0.0'
            }, {
                capabilities: {}
            });
            await this.client.connect(this.transport);
            console.log('Connected to Notion MCP server successfully');
        }
        catch (error) {
            console.error('Failed to connect to Notion MCP server:', error);
            throw error;
        }
    }
    async listTools() {
        if (!this.client) {
            throw new Error('Client not connected');
        }
        try {
            const result = await this.client.listTools();
            console.log('Available Notion tools:');
            result.tools.forEach((tool, index) => {
                console.log(`${index + 1}. ${tool.name}: ${tool.description}`);
            });
        }
        catch (error) {
            console.error('Error listing tools:', error);
            throw error;
        }
    }
    async createContactsDatabase(parentPageId) {
        if (!this.client) {
            throw new Error('Client not connected');
        }
        try {
            console.log('Creating contacts database in Notion...');
            const result = await this.client.callTool({
                name: 'API-create-a-database',
                arguments: {
                    parent: {
                        type: 'page_id',
                        page_id: parentPageId
                    },
                    title: [
                        {
                            type: 'text',
                            text: {
                                content: 'Apple Contacts Sync'
                            }
                        }
                    ],
                    properties: {
                        'Name': {
                            title: {}
                        },
                        'Email': {
                            email: {}
                        },
                        'Phone': {
                            phone_number: {}
                        },
                        'Organization': {
                            rich_text: {}
                        },
                        'First Name': {
                            rich_text: {}
                        },
                        'Last Name': {
                            rich_text: {}
                        },
                        'Apple ID': {
                            rich_text: {}
                        },
                        'Last Updated': {
                            date: {}
                        },
                        'Sync Status': {
                            select: {
                                options: [
                                    {
                                        name: 'Synced',
                                        color: 'green'
                                    },
                                    {
                                        name: 'Pending',
                                        color: 'yellow'
                                    },
                                    {
                                        name: 'Error',
                                        color: 'red'
                                    }
                                ]
                            }
                        }
                    }
                }
            });
            if (result.content && Array.isArray(result.content) && result.content[0]) {
                const content = result.content[0];
                if (typeof content === 'object' && 'text' in content) {
                    const response = JSON.parse(content.text);
                    console.log('Contacts database created successfully:', response.id);
                    return response.id;
                }
            }
            console.log('Database creation result:', result);
            return null;
        }
        catch (error) {
            console.error('Error creating contacts database:', error);
            throw error;
        }
    }
    async searchPages(query) {
        if (!this.client) {
            throw new Error('Client not connected');
        }
        try {
            console.log('Searching Notion pages...');
            const result = await this.client.callTool({
                name: 'API-post-search',
                arguments: {
                    query: query || '',
                    filter: {
                        property: 'object',
                        value: 'page'
                    }
                }
            });
            if (result.content && Array.isArray(result.content) && result.content[0]) {
                const content = result.content[0];
                if (typeof content === 'object' && 'text' in content) {
                    const response = JSON.parse(content.text);
                    console.log('Found pages:', response.results?.length || 0);
                    if (response.results) {
                        response.results.forEach((page, index) => {
                            const title = page.properties?.title?.title?.[0]?.text?.content ||
                                page.properties?.Name?.title?.[0]?.text?.content ||
                                'Untitled';
                            console.log(`${index + 1}. ${title} (ID: ${page.id})`);
                        });
                    }
                }
            }
        }
        catch (error) {
            console.error('Error searching pages:', error);
            throw error;
        }
    }
    async disconnect() {
        if (this.transport) {
            await this.transport.close();
            this.transport = null;
        }
        if (this.client) {
            this.client = null;
        }
        console.log('Disconnected from Notion MCP server');
    }
}
exports.NotionSetupClient = NotionSetupClient;
// CLI interface for setup
async function main() {
    const setupClient = new NotionSetupClient();
    try {
        await setupClient.connect();
        await setupClient.listTools();
        await setupClient.searchPages();
        // You'll need to provide a parent page ID for the database
        // Run this first to see available pages, then use one of their IDs
        console.log('\nTo create the contacts database, you need to:');
        console.log('1. Choose a parent page ID from the list above');
        console.log('2. Run: await setupClient.createContactsDatabase("your-page-id-here")');
    }
    catch (error) {
        console.error('Setup failed:', error);
    }
    finally {
        await setupClient.disconnect();
    }
}
if (require.main === module) {
    main().catch(console.error);
}
