#!/usr/bin/env node
"use strict";
/**
 * Apple Contacts Permissions Checker and Fixer
 * Checks and fixes permissions for Apple Contacts access
 */
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const util_1 = require("util");
const exec = (0, util_1.promisify)(require('child_process').exec);
async function checkContactsPermissions() {
    try {
        console.log('🔍 Checking Apple Contacts permissions...');
        // Check TCC database for contacts permissions
        const { stdout } = await exec(`sqlite3 ~/Library/Application\\ Support/com.apple.TCC/TCC.db "SELECT service, client, auth_value FROM access WHERE service='kTCCServiceAddressBook' AND client LIKE '%bun%' OR client LIKE '%node%' OR client LIKE '%apple-mcp%'"`);
        if (stdout.trim()) {
            console.log('📋 Found permissions entries:');
            console.log(stdout.trim());
            // Check if any are authorized (auth_value = 2)
            const lines = stdout.trim().split('\n');
            const hasAuthorized = lines.some((line) => line.includes('|2'));
            if (hasAuthorized) {
                console.log('✅ Contacts permissions are granted');
                return true;
            }
            else {
                console.log('❌ Contacts permissions are denied');
                return false;
            }
        }
        else {
            console.log('⚠️  No contacts permission entries found');
            return false;
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log('⚠️  Could not check permissions (this is normal):', errorMessage);
        return false;
    }
}
async function grantContactsPermissions() {
    console.log('\n🔧 Attempting to grant contacts permissions...');
    try {
        // Method 1: Use bun trigger script
        console.log('📱 Method 1: Using bun trigger script...');
        const bunResult = (0, child_process_1.spawn)('bun', ['trigger-permission.js'], {
            stdio: 'inherit',
            cwd: '/Users/peterswimm/code/rockford-toilville-pipeline-intelligence'
        });
        await new Promise((resolve, reject) => {
            bunResult.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Bun trigger script completed');
                    resolve(undefined);
                }
                else {
                    console.log('⚠️  Bun trigger script failed, trying alternative method');
                    resolve(undefined); // Don't reject, try next method
                }
            });
            bunResult.on('error', (error) => {
                console.log('⚠️  Bun trigger script error:', error.message);
                resolve(undefined); // Don't reject, try next method
            });
        });
        // Method 2: Reset and retry
        console.log('\n📱 Method 2: Resetting TCC database...');
        try {
            await exec('tccutil reset AddressBook');
            console.log('✅ TCC database reset');
            console.log('🔄 Please manually grant contacts permission when prompted');
            console.log('ℹ️  You may need to run the app again to trigger the permission dialog');
        }
        catch (resetError) {
            const errorMessage = resetError instanceof Error ? resetError.message : String(resetError);
            console.log('⚠️  Could not reset TCC database:', errorMessage);
        }
    }
    catch (error) {
        console.log('❌ Failed to grant permissions:', error);
    }
}
async function testAppleContactsAccess() {
    console.log('\n🧪 Testing Apple Contacts access...');
    return new Promise((resolve) => {
        const testProcess = (0, child_process_1.spawn)('/opt/homebrew/bin/apple-mcp', [], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        let output = '';
        let hasError = false;
        testProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        testProcess.stderr.on('data', (data) => {
            const errorOutput = data.toString();
            if (errorOutput.includes('permission') || errorOutput.includes('access')) {
                hasError = true;
            }
        });
        // Send a simple contacts request
        const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'contacts',
                arguments: {}
            }
        };
        testProcess.stdin.write(JSON.stringify(request) + '\n');
        testProcess.stdin.end();
        setTimeout(() => {
            testProcess.kill();
            if (hasError) {
                console.log('❌ Contacts access failed - permissions needed');
                resolve(false);
            }
            else if (output.includes('Found') || output.includes('contacts')) {
                console.log('✅ Contacts access working');
                resolve(true);
            }
            else {
                console.log('⚠️  Contacts access unclear - may need permissions');
                resolve(false);
            }
        }, 3000);
    });
}
async function main() {
    console.log('🍎 Apple Contacts Permissions Manager');
    console.log('=====================================\n');
    // Check current permissions
    const hasPermissions = await checkContactsPermissions();
    if (!hasPermissions) {
        await grantContactsPermissions();
    }
    // Test actual access
    const accessWorks = await testAppleContactsAccess();
    if (accessWorks) {
        console.log('\n🎉 Apple Contacts access is working!');
        console.log('💡 You can now run: npm run sync:dry-run');
    }
    else {
        console.log('\n❌ Apple Contacts access still not working');
        console.log('\n🔧 Manual steps to try:');
        console.log('1. System Settings → Privacy & Security → Contacts');
        console.log('2. Add Terminal or your preferred terminal app');
        console.log('3. Add Node.js or Bun if available');
        console.log('4. Restart your terminal and try again');
        console.log('\n💡 You may also need to run this in a different terminal app');
    }
}
if (require.main === module) {
    main().catch(console.error);
}
