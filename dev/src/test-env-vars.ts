#!/usr/bin/env node

/**
 * Test environment variable loading
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
function loadEnvVars() {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        console.log('📄 Raw .env content:');
        envContent.split('\n').forEach((line, i) => {
            if (line.includes('OPENAPI_MCP_HEADERS')) {
                console.log(`Line ${i+1}: ${line}`);
            }
        });
        
        const envVars = envContent.split('\n').reduce((acc, line) => {
            const [key, value] = line.split('=');
            if (key && value) {
                acc[key.trim()] = value.trim();
            }
            return acc;
        }, {} as Record<string, string>);
        
        console.log('\n🔍 Parsed OPENAPI_MCP_HEADERS:');
        console.log('Raw value:', envVars.OPENAPI_MCP_HEADERS);
        
        // Test JSON parsing
        try {
            const parsed = JSON.parse(envVars.OPENAPI_MCP_HEADERS || '{}');
            console.log('✅ JSON parsing successful:', parsed);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('❌ JSON parsing failed:', errorMessage);
        }
        
        // Set environment variables
        Object.entries(envVars).forEach(([key, value]) => {
            process.env[key] = value;
        });
        
        return envVars;
    }
    return {};
}

function main() {
    console.log('🧪 Environment Variable Test\n');
    
    const envVars = loadEnvVars();
    
    console.log('\n🌍 Final environment check:');
    console.log('process.env.OPENAPI_MCP_HEADERS:', process.env.OPENAPI_MCP_HEADERS);
    console.log('process.env.NOTION_API_TOKEN:', process.env.NOTION_API_TOKEN?.substring(0, 15) + '...');
}

main();
