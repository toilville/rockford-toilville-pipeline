# Development Scripts Documentation

## Overview
This directory contains development, testing, and utility scripts for the Rockford - Toilville Pipeline Intelligence platform.

## Directory Structure

### 📁 Testing/
Scripts used for testing functionality during development.


**test-5-contacts.scpt**
- Purpose: AppleScript to add 5 test contacts to Apple Contacts for testing sync functionality
- Dependencies: Apple Contacts
- Last Used: 2025-07-20


**cleanup-test-contacts.scpt**
- Purpose: AppleScript to remove test contacts from Apple Contacts after testing
- Dependencies: Apple Contacts
- Last Used: 2025-07-20


**test-notion-duplicates.ts**
- Purpose: TypeScript script to test duplicate detection logic in Notion database
- Dependencies: Notion API, @types/node
- Last Used: 2025-07-20


**test-specific-contacts.js**
- Purpose: JavaScript utility to test specific contact records during development
- Dependencies: Node.js
- Last Used: 2025-07-20


**test-duplicate-logic.js**
- Purpose: JavaScript script to validate duplicate detection algorithms
- Dependencies: Node.js
- Last Used: Unknown
- ⚠️ DEPRECATED


### 📁 Utils/
Utility scripts for data processing and development tasks.


**batched-apple-reader.ts**
- Purpose: TypeScript utility for reading Apple Contacts in batches to avoid memory issues
- Dependencies: Apple Contacts, TypeScript
- Last Used: 2025-07-20


**safe-apple-sync.ts**
- Purpose: Safe version of Apple sync with validation and rollback capabilities
- Dependencies: Apple Contacts, TypeScript
- Last Used: Unknown
- ⚠️ DEPRECATED

**debug-token.js**
- Purpose: JavaScript utility for debugging Notion API token issues
- Dependencies: Node.js, Notion API
- Last Used: 2025-07-20



### 📁 Scripts/
General development scripts and tools.



### 📁 Archive/
Deprecated or superseded scripts kept for reference.


**test-archive.ts**
- Purpose: Archived test script - functionality moved to ContactIntelligence/Testing/
- Dependencies: 
- Last Used: Unknown
- ⚠️ ARCHIVED/DEPRECATED

**test-single-archive.ts**
- Purpose: Archived single contact test - superseded by comprehensive testing suite
- Dependencies: 
- Last Used: Unknown
- ⚠️ ARCHIVED/DEPRECATED

**add-contacts-to-apple-2025-07-20.scpt**
- Purpose: Dated AppleScript for adding contacts - used during 2025-07-20 development session
- Dependencies: Apple Contacts
- Last Used: 2025-07-20
- ⚠️ ARCHIVED/DEPRECATED

**export-apple-contacts-2025-07-20.scpt**
- Purpose: Dated AppleScript for exporting contacts - used for backup during deduplication
- Dependencies: Apple Contacts
- Last Used: 2025-07-20
- ⚠️ ARCHIVED/DEPRECATED


## Script Validation

All scripts have been validated to ensure:
- Dependencies are documented
- File paths are correctly updated
- Functionality remains intact after reorganization
- Log outputs are redirected to proper logs/ directory

## Usage Notes

- Testing scripts should only be run in development environments
- Utility scripts may require environment variables (see .env.example)
- Archive scripts are kept for reference but may not work with current platform version
- All scripts now output logs to logs/current/ with automatic 7-day retention

## Maintenance

This documentation is automatically updated when scripts are reorganized.
Last updated: 2025-07-21
