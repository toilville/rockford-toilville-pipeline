#!/usr/bin/env npx tsx

/**
 * Quick Sync Test - Simple version to test the optimization concepts
 */

import { config } from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
config();

interface QuickSyncOptions {
  dryRun?: boolean;
  testAppleMail?: boolean;
  testNotionFilter?: boolean;
}

class QuickSyncTest {
  private options: QuickSyncOptions;

  constructor(options: QuickSyncOptions = {}) {
    this.options = {
      dryRun: true,
      testAppleMail: false,
      testNotionFilter: false,
      ...options
    };
  }

  async runTest(): Promise<void> {
    console.log('🚀 Quick Sync Test - Testing optimization concepts');
    console.log('================================================\n');

    if (this.options.testAppleMail) {
      await this.testAppleMailExtraction();
    }

    if (this.options.testNotionFilter) {
      await this.testNotionFiltering();
    }

    if (!this.options.testAppleMail && !this.options.testNotionFilter) {
      console.log('✅ Running basic connectivity test...');
      await this.testBasicConnectivity();
    }

    console.log('\n🎯 Test completed successfully!');
  }

  private async testBasicConnectivity(): Promise<void> {
    console.log('📡 Testing basic system connectivity...');
    
    try {
      const hasNotionToken = !!process.env.NOTION_API_TOKEN;
      const hasPersonalDB = !!process.env.NOTION_PERSONAL_CONTACTS_DATABASE_ID;
      const hasCompanyDB = !!process.env.NOTION_COMPANY_CONTACTS_DATABASE_ID;
      
      console.log(`   Notion Token: ${hasNotionToken ? '✅' : '❌'}`);
      console.log(`   Personal DB: ${hasPersonalDB ? '✅' : '❌'}`);
      console.log(`   Company DB: ${hasCompanyDB ? '✅' : '❌'}`);
      
      try {
        const result = execSync('osascript -e "tell application \\"Contacts\\" to get name of first person"', {
          encoding: 'utf-8',
          timeout: 5000
        });
        console.log(`   Apple Contacts: ✅ (First contact: ${result.trim()})`);
      } catch (error) {
        console.log(`   Apple Contacts: ❌`);
      }
      
    } catch (error) {
      console.error('❌ Basic connectivity test failed:', error);
    }
  }

  private async testAppleMailExtraction(): Promise<void> {
    console.log('📧 Testing Apple Mail contact extraction...');
    
    try {
      // Test basic inbox access
      console.log('   📮 Testing inbox access...');
      const inboxScript = `
        tell application "Mail"
          try
            set messageCount to count of (every message of inbox)
            return "Inbox messages: " & messageCount
          on error errMsg
            return "Error: " & errMsg
          end try
        end tell
      `;
      
      const inboxResult = execSync(`osascript -e '${inboxScript}'`, {
        encoding: 'utf-8',
        timeout: 10000
      });
      
      console.log(`   📮 ${inboxResult.trim()}`);
      
      // Test sample email extraction
      console.log('   📧 Testing email extraction...');
      const sampleScript = `
        tell application "Mail"
          try
            set sampleMessages to messages 1 thru 3 of inbox
            set sampleEmails to {}
            
            repeat with msg in sampleMessages
              try
                set senderEmail to (extract address from sender of msg)
                set end of sampleEmails to senderEmail
              end try
            end repeat
            
            return "Sample emails: " & (sampleEmails as string)
          on error errMsg
            return "Sample Error: " & errMsg
          end try
        end tell
      `;
      
      const sampleResult = execSync(`osascript -e '${sampleScript}'`, {
        encoding: 'utf-8',
        timeout: 10000
      });
      
      console.log(`   📧 ${sampleResult.trim()}`);
      console.log('   🌟 Note: VIP filtering would use smart mailbox rules in production');
      
    } catch (error) {
      console.error('❌ Apple Mail test failed:', error);
    }
  }

  private async testNotionFiltering(): Promise<void> {
    console.log('💙 Testing Notion date filtering concept...');
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    console.log(`   📅 Would filter for contacts edited after: ${sevenDaysAgo.toISOString()}`);
    console.log('   🔍 Notion API filter would be:');
    console.log('   {');
    console.log('     "filter": {');
    console.log('       "property": "last_edited_time",');
    console.log('       "date": {');
    console.log(`         "after": "${sevenDaysAgo.toISOString()}"`);
    console.log('       }');
    console.log('     }');
    console.log('   }');
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  
  const options: QuickSyncOptions = {
    dryRun: !args.includes('--live'),
    testAppleMail: args.includes('--test-mail'),
    testNotionFilter: args.includes('--test-notion')
  };

  console.log('⚡ Quick Sync Test Options:');
  console.log(`   Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Test Apple Mail: ${options.testAppleMail}`);
  console.log(`   Test Notion Filter: ${options.testNotionFilter}`);
  console.log();

  const tester = new QuickSyncTest(options);
  await tester.runTest();
}

main().catch(error => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
});
