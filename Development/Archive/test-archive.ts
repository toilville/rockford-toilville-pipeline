#!/usr/bin/env node

/**
 * Test script to verify the correct Notion MCP method for archiving pages
 */

import { config } from 'dotenv';
import { ContactSync } from './Contactors/contact-sync';

config();

async function testArchive() {
  console.log('🧪 Testing Notion archive methods...');
  
  const contactSync = new ContactSync();
  await contactSync.initialize();
  
  const client = (contactSync as any).notionClient;
  
  // List available tools
  if (client && client.listTools) {
    console.log('\n📋 Available Notion MCP tools:');
    const tools = await client.listTools();
    const pageTools = tools.tools.filter((tool: any) => 
      tool.name.includes('page') || tool.name.includes('patch'));
    pageTools.forEach((tool: any) => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
  }
  
  await contactSync.cleanup();
}

testArchive().catch(console.error);
