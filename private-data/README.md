# Private Data Directory

⚠️ **IMPORTANT: This directory contains sensitive personal information and should never be committed to version control.**

## Contents
This directory contains backup files, analysis reports, and other data that may include PII (Personally Identifiable Information).

### Subdirectories:
- `backups/` - Apple Contacts backups and import lists
- `analysis/` - Contact analysis results with potentially sensitive data  
- `reports/` - Sync reports that may contain contact details

## Security Notice
- Add `private-data/` to `.gitignore` 
- Do not share these files publicly
- Use anonymized data for testing and development
- Regularly clean up old backup files

## What to Store Here
✅ Apple Contacts backup JSON files  
✅ Contact analysis CSV/JSON files  
✅ Sync reports with contact details  
✅ Personal data exports from LinkedIn/etc  

## What NOT to Store Here
❌ Code files  
❌ Configuration files  
❌ Documentation  
❌ Any files that should be version controlled  

Always use sample/anonymized data for development and testing.
