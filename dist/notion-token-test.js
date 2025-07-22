#!/usr/bin/env node
"use strict";
/**
 * Debug the Notion token issue
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Load environment variables from .env file
function loadEnvVars() {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        console.log('📄 Raw .env file content:');
        console.log(envContent);
        console.log('------------------------');
        const envVars = envContent.split('\n').reduce((acc, line) => {
            const [key, value] = line.split('=');
            if (key && value) {
                acc[key.trim()] = value.trim();
            }
            return acc;
        }, {});
        console.log('🔍 Parsed environment variables:');
        Object.entries(envVars).forEach(([key, value]) => {
            if (key === 'NOTION_API_TOKEN') {
                console.log(`${key}: ${value.substring(0, 10)}...`);
            }
            else {
                console.log(`${key}: ${value}`);
            }
        });
        // Set environment variables
        Object.entries(envVars).forEach(([key, value]) => {
            process.env[key] = value;
        });
    }
    else {
        console.log('❌ No .env file found');
    }
}
function main() {
    console.log('🔍 Notion Token Debug');
    console.log('====================');
    loadEnvVars();
    console.log('🎯 Final environment state:');
    const token = process.env.NOTION_API_TOKEN;
    if (token) {
        console.log(`✅ NOTION_API_TOKEN found: ${token.substring(0, 10)}...`);
        console.log(`� Token length: ${token.length}`);
        console.log(`🔤 Token format: ${token.substring(0, 4)}...`);
        // Check if it's the expected format
        if (token.startsWith('ntn_')) {
            console.log('✅ Token has correct ntn_ prefix');
        }
        else if (token.startsWith('secret_')) {
            console.log('⚠️  Token has secret_ prefix (old format?)');
        }
        else {
            console.log('❓ Token has unexpected format');
        }
    }
    else {
        console.log('❌ No NOTION_API_TOKEN found in environment');
    }
    console.log('💡 All environment variables containing "NOTION":');
    Object.entries(process.env).forEach(([key, value]) => {
        if (key.includes('NOTION') && value) {
            console.log(`${key}: ${value.substring(0, 10)}...`);
        }
    });
}
main();
