#!/usr/bin/env node
"use strict";
/**
 * Test environment variable loading
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
        console.log('📄 Raw .env content:');
        envContent.split('\n').forEach((line, i) => {
            if (line.includes('OPENAPI_MCP_HEADERS')) {
                console.log(`Line ${i + 1}: ${line}`);
            }
        });
        const envVars = envContent.split('\n').reduce((acc, line) => {
            const [key, value] = line.split('=');
            if (key && value) {
                acc[key.trim()] = value.trim();
            }
            return acc;
        }, {});
        console.log('\n🔍 Parsed OPENAPI_MCP_HEADERS:');
        console.log('Raw value:', envVars.OPENAPI_MCP_HEADERS);
        // Test JSON parsing
        try {
            const parsed = JSON.parse(envVars.OPENAPI_MCP_HEADERS || '{}');
            console.log('✅ JSON parsing successful:', parsed);
        }
        catch (error) {
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
