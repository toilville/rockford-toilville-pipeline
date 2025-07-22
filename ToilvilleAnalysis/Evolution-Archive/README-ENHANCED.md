# Enhanced Bidirectional Contact Sync

⚡ **Full bidirectional contact synchronization with deduplication, updates, and review tasks**

## Overview

Enhanced Contact Sync provides comprehensive bidirectional synchronization between Notion and Apple Contacts with:

- **Bidirectional Sync**: Full two-way synchronization (Notion ↔ Apple)
- **Smart Deduplication**: Finds and resolves duplicate contacts automatically
- **Contact Updates**: Compares and updates existing contacts with changes
- **Review Tasks**: Creates tasks for manual review of all changes
- **Comprehensive Reporting**: Detailed sync reports with all changes tracked

## Enhanced Features

- ✅ **Bidirectional Sync**: Syncs both Notion → Apple AND Apple → Notion
- ✅ **Advanced Deduplication**: Resolves duplicates by email, name, and phone
- ✅ **Contact Updates**: Updates existing contacts with new information
- ✅ **Change Tracking**: Tracks all additions, updates, and merges
- ✅ **Review Task Creation**: Creates tasks for Peter Swimm to review changes
- ✅ **Detailed Reporting**: JSON reports with complete change history
- ✅ **Conflict Resolution**: Smart merging of duplicate contact data

## Quick Start

1. **Setup Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Notion API token and database IDs
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Enhanced Sync**
   ```bash
   # Full bidirectional sync
   npm run enhanced:sync
   
   # Dry run (see what would be synced)
   npm run enhanced:dry
   
   # Test with 10 random contacts
   npm run enhanced:test
   
   # Test with actual execution
   npm run enhanced:test-live
   ```

## Commands

### Enhanced Sync Commands
- `npm run enhanced:sync` - **Full bidirectional sync with deduplication**
- `npm run enhanced:dry` - Preview all changes without executing
- `npm run enhanced:test` - Test with 10 contacts (dry run)
- `npm run enhanced:test-live` - Test with 10 contacts (live execution)

### Lightning Sync Commands (Original)
- `npm run sync` - Fast one-way sync (Notion → Apple only)
- `npm run sync:dry` - Preview lightning sync changes
- `npm run sync:test` - Test lightning sync with 5 contacts
- `npm run sync:force` - Force full re-sync (ignore cache)

## Enhanced Sync Process

### 1. **Load and Deduplicate Notion Contacts**
   - Fetches from Personal and Company databases
   - Identifies duplicate groups by email, name, phone
   - Resolves duplicates by selecting most complete data
   - Result: Clean, deduplicated Notion contact list

### 2. **Load and Deduplicate Apple Contacts**
   - Reads all Apple Contacts efficiently
   - Applies same deduplication logic
   - Result: Clean, deduplicated Apple contact list

### 3. **Bidirectional Comparison**
   - **New contacts for Apple**: Notion contacts not in Apple
   - **New contacts for Notion**: Apple contacts not in Notion  
   - **Updates needed**: Existing contacts with changes

### 4. **Execute Changes**
   - Adds new contacts to Apple Contacts
   - Adds new contacts to Notion databases
   - Updates existing contacts with changes
   - Tracks all changes for review

### 5. **Create Review Tasks**
   - Generates review task for Peter Swimm
   - Includes all changes with before/after details
   - Creates Notion task (if TASKS_DATABASE_ID set)
   - Falls back to markdown file if needed

### 6. **Generate Reports**
   - Saves detailed JSON report with all changes
   - Includes performance metrics and statistics
   - Provides audit trail for all sync operations

## Performance

- **Enhanced Sync**: ~10-15 minutes (full bidirectional with deduplication)
- **Lightning Sync**: ~30 seconds (cached, one-way only)
- **Test Mode**: ~1 minute (10 contacts sample)

## Configuration

Create `.env` file with:
```bash
# Notion API Configuration
NOTION_API_TOKEN=your_notion_integration_token
OPENAPI_MCP_HEADERS={"Authorization":"Bearer your_token","Notion-Version":"2022-06-28"}

# Contact Database IDs
NOTION_PERSONAL_CONTACTS_DATABASE_ID=your_personal_db_id
NOTION_COMPANY_CONTACTS_DATABASE_ID=your_company_db_id

# Optional: Tasks Database for Review Tasks
TASKS_DATABASE_ID=your_tasks_db_id
```

## Sync Results Example

```
📊 Enhanced Sync Results:
   📈 Total processed: 634 contacts
   🔄 Apple changes: 545 contacts added
   💙 Notion changes: 89 contacts added  
   🧹 Duplicates resolved: 675 duplicates
   📋 Review tasks created: 1 task
   ⏱️  Total time: 11.1 minutes
```

## Review Task Example

The enhanced sync creates detailed review tasks like:

```markdown
# Contact Sync Review - 634 Changes (7/20/2025)

## Contact Sync Summary
**Total Changes:** 634
**Duplicates Resolved:** 675
**Timestamp:** 7/20/2025, 10:30:00 AM

### Apple Contacts Changes (545)
- **ADDED**: John Smith (john@example.com)
  - New contact from Notion
- **UPDATED**: Jane Doe (jane@example.com)  
  - Phone: "555-1234" → "555-5678"
  
### Notion Changes (89)
- **ADDED**: Bob Wilson (bob@apple.com)
  - New contact from Apple
```

## Requirements

- macOS with Apple Contacts app
- Notion API access with contact databases
- Node.js 16+ and npm
- Optional: Notion tasks database for review tasks

## Development

Test scripts and development tools are in the `dev/` folder.

---

**Note**: Enhanced sync provides full bidirectional synchronization with deduplication and review tasks. Use lightning sync for fast one-way updates.
