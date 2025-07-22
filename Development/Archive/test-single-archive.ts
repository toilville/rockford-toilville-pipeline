#!/usr/bin/env node

/**
 * Test archiving a single Notion contact to verify the method works
 */

import { config } from 'dotenv';
import { ContactSync } from './Contactors/contact-sync';

config();

async function testSingleArchive() {
  console.log('🧪 Testing single contact archive...');
  
  const contactSync = new ContactSync();
  await contactSync.initialize();
  
  // Get the first contact from personal database
  const personalContacts = await contactSync.fetchNotionContacts('personal');
  
  if (personalContacts.length > 0) {
    // Find a duplicate contact to safely test with
    console.log(`Found ${personalContacts.length} personal contacts`);
    
    // Look for a duplicate
    const testContact = personalContacts.find(c => 
      personalContacts.some((other, index, arr) => 
        arr.indexOf(other) !== arr.indexOf(c) && 
        c.email && other.email && 
        c.email.toLowerCase() === other.email.toLowerCase()
      )
    );
    
    if (testContact && testContact.notionId) {
      console.log(`Testing archive on duplicate: ${testContact.name} (${testContact.email})`);
      console.log(`Notion ID: ${testContact.notionId}`);
      
      const client = (contactSync as any).notionClient;
      
      try {
        await client.callTool({
          name: "API-patch-page",
          arguments: {
            page_id: testContact.notionId,
            archived: true
          }
        });
        
        console.log('✅ Archive test successful!');
      } catch (error) {
        console.error('❌ Archive test failed:', error);
      }
    } else {
      console.log('No suitable duplicate contact found for testing');
    }
  }
  
  await contactSync.cleanup();
}

testSingleArchive().catch(console.error);
