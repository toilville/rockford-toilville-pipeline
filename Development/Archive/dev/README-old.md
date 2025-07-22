# Apple Contacts ↔ Notion Sync - Post Mortem

A comprehensive contact synchronization system that connects Apple Contacts with Notion databases using the Model Context Protocol (MCP).

## � Project Status: ARCHIVED

**This project has been discontinued due to Apple MCP limitations. See [Post Mortem](#-post-mortem) below for details and alternative approaches.**

## 📊 What We Accomplished

✅ **Successful Integrations:**
- Apple MCP Server connection and contact reading
- Notion MCP Server integration with ntn_ token format
- Bidirectional sync architecture design
- Complete TypeScript implementation
- VS Code MCP configuration
- Environment setup with proper authentication

✅ **Technical Achievements:**
- Retrieved 190+ contacts from Apple Contacts
- Successfully accessed Notion databases (131 existing contacts)
- Built comprehensive contact parsing and matching logic
- Implemented validation workflow for new contacts
- Created dry-run testing capabilities

## 🔥 Post Mortem

### What Went Wrong

**Apple MCP Server Limitations:**
- **Read-Only**: Cannot create, update, or delete Apple contacts
- **Timeout Issues**: Consistently times out with 190+ contacts (60-second limit)
- **No Batch Support**: Must fetch all contacts at once, no pagination
- **Performance**: Cannot handle medium-sized contact lists efficiently

**Architectural Mismatch:**
- MCP designed for AI tool calls, not bulk data synchronization
- Apple MCP optimized for single contact lookups, not mass operations
- Notion MCP works well but limited by Apple MCP constraints

### What We Learned

1. **MCP is excellent for**: AI-driven individual operations, search queries, single record operations
2. **MCP is poor for**: Bulk data processing, ETL operations, large dataset synchronization
3. **Apple Contacts integration requires**: Direct AppleScript, Contacts framework, or SQLite access

## 🚀 Recommended Alternative Approaches

### Option 1: AppleScript + Notion API (Recommended)
```bash
# New project: apple-contacts-notion-sync-v2
mkdir apple-contacts-notion-sync-v2
cd apple-contacts-notion-sync-v2
```

**Tech Stack:**
- **Apple Contacts**: Native AppleScript or Swift Contacts framework
- **Notion**: Direct REST API calls (not MCP)
- **Language**: Node.js with node-osascript or Swift CLI tool
- **Architecture**: ETL pipeline with proper batch processing

**Benefits:**
- Full read/write access to Apple Contacts
- No MCP timeout limitations
- Proper batch processing
- Direct API control
- Can handle thousands of contacts

### Option 2: CSV Export/Import Bridge
```bash
# Manual but reliable approach
1. Export Apple Contacts → CSV
2. Process CSV with Node.js/Python
3. Bulk import to Notion via API
4. Set up periodic sync jobs
```

### Option 3: Shortcuts.app Automation
```bash
# iOS/macOS Shortcuts for semi-automated sync
1. Create Shortcuts for contact export
2. Process with cloud functions
3. Sync to Notion via webhooks
```

### Option 4: Third-Party Integration Platform
- **Zapier/Make.com**: Pre-built connectors
- **n8n**: Self-hosted workflow automation
- **Pipedream**: Event-driven integrations

## 🛠️ Implementation Guide for Option 1

### Project Structure
```
apple-contacts-notion-sync-v2/
├── src/
│   ├── apple/
│   │   ├── contacts-reader.ts    # AppleScript bridge
│   │   ├── contacts-writer.ts    # Contact creation/updates
│   │   └── contacts-types.ts     # Type definitions
│   ├── notion/
│   │   ├── api-client.ts         # Direct REST API
│   │   ├── database-manager.ts   # Database operations
│   │   └── sync-engine.ts        # Sync logic
│   ├── sync/
│   │   ├── contact-matcher.ts    # Duplicate detection
│   │   ├── conflict-resolver.ts  # Merge strategies
│   │   └── sync-orchestrator.ts  # Main sync logic
│   └── cli/
│       ├── discover.ts           # Find new contacts
│       ├── sync.ts              # Run sync
│       └── validate.ts          # Peter's validation workflow
├── scripts/
│   ├── apple-contacts.scpt      # AppleScript helpers
│   └── export-contacts.sh       # Batch operations
└── config/
    ├── databases.json           # Notion database schemas
    └── sync-rules.json          # Business logic rules
```

### Key Technologies
```json
{
  "dependencies": {
    "@notionhq/client": "^2.2.3",
    "node-osascript": "^2.1.0",
    "csv-parser": "^3.0.0",
    "commander": "^9.4.1"
  }
}
```

### AppleScript Bridge Example
```typescript
import osascript from 'node-osascript';

export async function getAllContacts(): Promise<Contact[]> {
  const script = `
    tell application "Contacts"
      set contactList to {}
      repeat with person in every person
        set contactList to contactList & {name of person, value of email of person}
      end repeat
      return contactList
    end tell
  `;
  
  const result = await osascript.execute(script);
  return parseContactData(result);
}
```

## 🎯 Success Metrics for V2

- ✅ Handle 1000+ contacts without timeout
- ✅ Full bidirectional sync (Apple ↔ Notion)
- ✅ Sub-5-minute sync times
- ✅ Conflict resolution with user prompts
- ✅ Peter's validation workflow for new contacts
- ✅ Automated duplicate detection and merging
- ✅ Sales pipeline integration

## 📚 Lessons for Future MCP Projects

**Use MCP for:**
- Individual record lookups
- AI-driven data queries
- Single-operation workflows
- Development and testing
- Interactive AI experiences

**Avoid MCP for:**
- Bulk data processing
- ETL pipelines
- Large dataset operations
- Time-critical synchronization
- Production data integration

## 🔗 Resources

- [Apple Contacts AppleScript Reference](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/)
- [Notion API Documentation](https://developers.notion.com/reference/intro)
- [Node.js Contacts Framework](https://github.com/node-contacts/node-contacts)
- [Swift Contacts Framework](https://developer.apple.com/documentation/contacts)

---

**Project Timeline:** July 2025  
**Final Status:** Archived due to Apple MCP limitations  
**Recommendation:** Proceed with Option 1 (AppleScript + Direct Notion API)
npm run sync
```

## 🔧 Configuration

### MCP Servers Configuration

The project uses two MCP servers configured in `.vscode/mcp.json`:

```json
{
  "servers": {
    "apple-mcp": {
      "type": "stdio",
      "command": "/opt/homebrew/bin/apple-mcp",
      "args": []
    },
    "notion-mcp": {
      "type": "stdio", 
      "command": "node",
      "args": ["notion-mcp-server/bin/cli.mjs"]
    }
  }
}
```

### Environment Variables

Create a `.env` file (see `.env.example`):

```bash
NOTION_API_TOKEN=secret_xxxxxxxxxx
NOTION_CONTACTS_DATABASE_ID=optional_database_id
SYNC_INTERVAL_MINUTES=60
DRY_RUN=false
```

## 📚 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build TypeScript project |
| `npm run setup` | Run setup wizard |
| `npm run sync` | Full contact synchronization |
| `npm run sync:dry-run` | Test sync without changes |
| `npm run notion:test` | Test Notion MCP connection |
| `npm run notion:setup` | Setup Notion database |
| `npm start` | Test Apple MCP connection |

## 🏗️ Architecture

### Components

1. **Apple MCP Client** (`src/apple-mcp-client.ts`)
   - Connects to Apple MCP server
   - Fetches contacts from Apple Contacts app
   - Handles Apple-specific data formats

2. **Contact Sync Engine** (`src/contact-sync.ts`)
   - Main synchronization logic
   - Bidirectional sync between Apple and Notion
   - Conflict resolution and error handling

3. **Notion Setup** (`src/notion-setup.ts`)
   - Creates and configures Notion database
   - Sets up proper schema for contacts

4. **Setup Wizard** (`src/setup-wizard.ts`)
   - Automated setup and testing
   - Provides guided configuration

### Data Flow

```
Apple Contacts ←→ Apple MCP Server ←→ Contact Sync Engine ←→ Notion MCP Server ←→ Notion Database
```

## 🔍 Troubleshooting

### Apple Contacts Permissions

If Apple contacts aren't accessible:

```bash
# Reset contacts permissions
tccutil reset AddressBook

# Grant permissions via trigger script
bun trigger-permission.js
```

### Notion API Issues

1. **Invalid Token**: Verify your integration token
2. **Page Access**: Ensure your integration has access to the target page
3. **Database Schema**: Check that the database has the correct properties

### MCP Connection Issues

1. **Apple MCP**: Ensure it's installed via Homebrew
2. **Notion MCP**: Verify the server builds successfully
3. **VS Code**: Reload window after changing MCP configuration

## 📊 Database Schema

The Notion contacts database includes:

| Property | Type | Description |
|----------|------|-------------|
| Name | Title | Full contact name |
| Email | Email | Primary email address |
| Phone | Phone | Primary phone number |
| Organization | Rich Text | Company/organization |
| First Name | Rich Text | Given name |
| Last Name | Rich Text | Family name |
| Apple ID | Rich Text | Unique identifier from Apple |
| Last Updated | Date | Last sync timestamp |
| Sync Status | Select | Sync status (Synced/Pending/Error) |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- [Apple MCP Server](https://github.com/dhravya/apple-mcp) by @dhravya
- [Notion MCP Server](https://github.com/makenotion/notion-mcp-server) by @makenotion
- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic

---

For more detailed examples and advanced usage, see the [Model Context Protocol documentation](https://modelcontextprotocol.io/llms-full.txt).
