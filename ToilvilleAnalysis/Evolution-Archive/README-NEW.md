# Lightning Contact Sync

⚡ **Ultra-fast contact synchronization from Notion to Apple Contacts/iCloud**

## Overview

Lightning Contact Sync intelligently syncs your Notion contact databases to Apple Contacts and iCloud with:

- **Lightning Speed**: First run ~7 minutes, future runs ~30 seconds
- **Smart Caching**: Only processes new/changed contacts
- **Batch Processing**: Handles large contact lists efficiently
- **Robust Error Handling**: Automatically handles Apple Contacts quirks

## Features

- ✅ Syncs from Notion Personal & Company databases to Apple Contacts
- ✅ Intelligent duplicate detection and comparison
- ✅ Incremental sync with smart caching
- ✅ Batch processing to avoid timeouts
- ✅ Safe contact creation with validation
- ✅ Automatic iCloud synchronization

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

3. **Run Sync**
   ```bash
   # Full sync (first run)
   npm run sync
   
   # Dry run (see what would be synced)
   npm run sync:dry
   
   # Test with 5 random contacts
   npm run sync:test
   ```

## Commands

- `npm run sync` - Full contact synchronization
- `npm run sync:dry` - Preview what contacts would be added
- `npm run sync:test` - Test with 5 random contacts
- `npm run sync:force` - Force full re-sync (ignore cache)

## Performance

- **First Run**: ~7 minutes (reads all contacts, creates cache)
- **Subsequent Runs**: ~30 seconds (uses smart caching)
- **Incremental**: Only processes new/changed contacts

## How It Works

1. **Loads Notion Contacts**: Fetches from both Personal and Company databases
2. **Reads Apple Contacts**: Efficiently batches Apple Contacts reading
3. **Smart Comparison**: Fast email/name matching to find new contacts
4. **Safe Addition**: Adds only new contacts to Apple Contacts
5. **Cache Update**: Saves state for lightning-fast future runs

## Requirements

- macOS with Apple Contacts app
- Notion API access with contact databases
- Node.js 16+ and npm

## Configuration

Create `.env` file with:
```
NOTION_API_TOKEN=your_notion_integration_token
PERSONAL_DATABASE_ID=your_personal_contacts_db_id
COMPANY_DATABASE_ID=your_company_contacts_db_id
```

## Development

Test scripts and development tools are in the `dev/` folder.

---

**Note**: This tool adds contacts to Apple Contacts, which automatically sync to iCloud. It does not modify or delete existing contacts.
