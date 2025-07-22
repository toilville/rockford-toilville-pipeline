#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_client_js_1 = require("../notion/api-client.js");
async function inspectDatabases() {
    const client = new api_client_js_1.NotionApiClient();
    try {
        console.log('🔍 Inspecting Notion Database Schemas...\n');
        // Get both databases
        const personalDb = await client.notion.databases.retrieve({
            database_id: client.personalContactsDbId
        });
        const companyDb = await client.notion.databases.retrieve({
            database_id: client.companyContactsDbId
        });
        console.log('📋 Personal Contacts Database Properties:');
        console.log('===============================================');
        Object.entries(personalDb.properties).forEach(([name, prop]) => {
            console.log(`  • ${name}: ${prop.type}`);
        });
        console.log('\n🏢 Company Contacts Database Properties:');
        console.log('===============================================');
        Object.entries(companyDb.properties).forEach(([name, prop]) => {
            console.log(`  • ${name}: ${prop.type}`);
        });
    }
    catch (error) {
        console.error('❌ Error inspecting databases:', error);
    }
}
inspectDatabases();
