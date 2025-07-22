#!/usr/bin/env node

/**
 * Debug the Notion token issue
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnvVars() {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        console.log('Raw .env file content:');
        console.log(envContent);
        console.log('------------------------');
        
        const envVars = envContent.split('\n').reduce((acc, line) => {
            const [key, value] = line.split('=');
            if (key && value) {
                acc[key.trim()] = value.trim();
            }
            return acc;
        }, {});
        
        console.log('Parsed environment variables:');
        Object.entries(envVars).forEach(([key, value]) => {
            if (key === 'NOTION_API_TOKEN') {
                console.log(`${key}: ${value.substring(0, 10)}...`);
            } else {
                console.log(`${key}: ${value}`);
            }
        });
        
        // Set environment variables
        Object.entries(envVars).forEach(([key, value]) => {
            process.env[key] = value;
        });
    } else {
        console.log('No .env file found');
    }
}

function main() {
    console.log('Notion Token Debug');
    console.log('==================');
    
    loadEnvVars();
    
    console.log('\nFinal environment state:');
    const token = process.env.NOTION_API_TOKEN;
    
    if (token) {
        console.log(`NOTION_API_TOKEN found: ${token.substring(0, 10)}...`);
        console.log(`Token length: ${token.length}`);
        console.log(`Token format: ${token.substring(0, 4)}...`);
        
        // Check if it's the expected format
        if (token.startsWith('ntn_')) {
            console.log('Token has correct ntn_ prefix');
        } else if (token.startsWith('secret_')) {
            console.log('Token has secret_ prefix (old format?)');
        } else {
            console.log('Token has unexpected format');
        }
    } else {
        console.log('No NOTION_API_TOKEN found in environment');
    }
    
    console.log('\nAll environment variables containing "NOTION":');
    Object.entries(process.env).forEach(([key, value]) => {
        if (key.includes('NOTION') && value) {
            console.log(`${key}: ${value.substring(0, 10)}...`);
        }
    });
}

main();
