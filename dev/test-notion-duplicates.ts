#!/usr/bin/env node

/**
 * Notion Duplicate Detection Test
 * 
 * This test focuses specifically on:
 * 1. Fetching contacts from Notion (with pagination)
 * 2. Running enhanced duplicate detection logic with scoring
 * 3. Analyzing bizdev contacts specifically
 * 4. Testing specific contact examples
 * 5. Stopping before Apple Contacts integration
 */

import { config } from 'dotenv';
import { ContactSync, Contact } from './src/contact-sync';

// Load environment variables
config();

interface DuplicateGroup {
  contacts: Contact[];
  analysis: string;
}

class NotionDuplicateTest {
  private contactSync: ContactSync;

  constructor() {
    this.contactSync = new ContactSync();
  }

  async run(): Promise<void> {
    console.log('🔍 Notion Duplicate Detection Test');
    console.log('==================================\n');

    try {
      await this.contactSync.initialize();

      // Step 1: Fetch all Notion contacts
      console.log('📊 Step 1: Fetching Notion contacts...');
      const personalContacts = await this.contactSync.fetchNotionContacts('personal');
      const companyContacts = await this.contactSync.fetchNotionContacts('company');
      
      console.log(`   📊 Raw data: ${personalContacts.length} personal, ${companyContacts.length} company contacts`);
      
      const allContacts = [...personalContacts, ...companyContacts];
      console.log(`   Total contacts: ${allContacts.length}`);

      // Step 2: Analyze bizdev contacts first
      console.log('\n🔍 Step 2: Analyzing bizdev contacts...');
      const bizdevContacts = allContacts.filter(contact => 
        this.isBizdevContact(contact)
      );
      
      console.log(`   Found ${bizdevContacts.length} potential bizdev contacts`);
      console.log(`   Bizdev breakdown: ${bizdevContacts.filter(c => c.contactType === 'personal' || !c.contactType).length} from personal, ${bizdevContacts.filter(c => c.contactType === 'company').length} from company`);
      
      if (bizdevContacts.length > 0) {
        const bizdevDuplicates = this.findDuplicateGroups(bizdevContacts);
        console.log(`   📊 Bizdev duplicate groups: ${bizdevDuplicates.length}`);
        
        // Show detailed analysis for first 3 bizdev duplicate groups
        for (const [index, group] of bizdevDuplicates.slice(0, 3).entries()) {
          const analysis = this.analyzeMergeNeeds(group.contacts);
          console.log(`     └─ Group ${index + 1}: ${group.contacts.length} contacts - ${analysis}`);
        }
        
        if (bizdevDuplicates.length > 3) {
          console.log(`     └─ ... and ${bizdevDuplicates.length - 3} more bizdev duplicate groups`);
        }
      }

      // Step 3: Analyze all contacts for duplicates
      console.log('\n🔍 Step 3: Full duplicate analysis...');
      const duplicateGroups = this.findDuplicateGroups(allContacts);
      console.log(`   Found ${duplicateGroups.length} total duplicate groups`);

      // Show sample of overall duplicates
      if (duplicateGroups.length > 0) {
        console.log('\n📋 Sample duplicate groups:');
        for (const [index, group] of duplicateGroups.slice(0, 5).entries()) {
          const analysis = this.analyzeMergeNeeds(group.contacts);
          console.log(`   ${index + 1}. Group of ${group.contacts.length}: ${analysis}`);
        }
        
        if (duplicateGroups.length > 5) {
          console.log(`   ... and ${duplicateGroups.length - 5} more duplicate groups`);
        }
      }

      // Step 4: Test specific names mentioned by user
      console.log('\n🎯 Step 4: Testing specific contact names...');
      const testNames = ['Anthony Costello', 'Avi Cohen', 'Balun', 'Blanche Devereaux', 'Dan McLay'];
      
      for (const testName of testNames) {
        const matchingContacts = allContacts.filter(contact => 
          contact.name && contact.name.toLowerCase().includes(testName.toLowerCase())
        );
        
        if (matchingContacts.length > 0) {
          console.log(`   "${testName}": Found ${matchingContacts.length} matching contacts`);
          
          if (matchingContacts.length > 1) {
            // Test if they're detected as duplicates
            const isDuplicate = this.areContactsDuplicate(matchingContacts[0], matchingContacts[1]);
            console.log(`      🎯 Result: ${isDuplicate ? '✅ DUPLICATE DETECTED' : '❌ NOT DUPLICATE'}`);
          }
        } else {
          console.log(`   "${testName}": No matches found`);
        }
      }

      // Final summary
      this.printSummary(allContacts.length, bizdevContacts.length, duplicateGroups.length);

    } catch (error) {
      console.error('❌ Error during test:', error);
      throw error;
    } finally {
      await this.contactSync.cleanup();
    }
  }

  private findDuplicateGroups(contacts: Contact[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    console.log(`   🔍 Checking ${contacts.length} contacts for duplicates...`);

    for (const contact of contacts) {
      if (processed.has(contact.id || '')) continue;

      const duplicates = contacts.filter(other => 
        other.id !== contact.id &&
        !processed.has(other.id || '') &&
        this.areContactsDuplicate(contact, other)
      );

      if (duplicates.length > 0) {
        const groupContacts = [contact, ...duplicates];
        const analysis = this.analyzeMergeNeeds(groupContacts);
        
        groups.push({
          contacts: groupContacts,
          analysis
        });
        
        groupContacts.forEach(c => processed.add(c.id || ''));
      }
    }

    console.log(`   📊 Found ${groups.length} duplicate groups`);
    return groups;
  }

  private areContactsDuplicate(contact1: Contact, contact2: Contact): boolean {
    // Calculate similarity score based on matching properties
    const score = this.calculateSimilarityScore(contact1, contact2);
    
    // Strong matches (any single strong indicator = duplicate)
    if (score.strongMatches.length > 0) {
      return true;
    }
    
    // Majority rule: if 60% or more properties match, consider duplicate
    if (score.percentage >= 60) {
      return true;
    }
    
    // Special case: if names match and at least one other property matches
    if (score.nameMatch && score.total >= 4) {
      return true;
    }

    return false;
  }

  private calculateSimilarityScore(contact1: Contact, contact2: Contact): {
    total: number;
    maxPossible: number;
    percentage: number;
    breakdown: string[];
    strongMatches: string[];
    nameMatch: boolean;
  } {
    let score = 0;
    let maxPossible = 0;
    const breakdown: string[] = [];
    const strongMatches: string[] = [];
    let nameMatch = false;
    
    // Email match (weight: 3, strong indicator)
    if (contact1.email && contact2.email) {
      maxPossible += 3;
      if (contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
        score += 3;
        breakdown.push('same email (+3)');
        strongMatches.push('same email');
      } else {
        breakdown.push('different email (+0)');
      }
    } else if (contact1.email || contact2.email) {
      maxPossible += 1; // Partial credit if only one has email
      breakdown.push('missing email (+0)');
    }
    
    // Phone match (weight: 3, strong indicator)
    if (contact1.phone && contact2.phone) {
      maxPossible += 3;
      const phone1 = contact1.phone.replace(/\D/g, '');
      const phone2 = contact2.phone.replace(/\D/g, '');
      if (phone1 === phone2 && phone1.length > 6) {
        score += 3;
        breakdown.push('same phone (+3)');
        strongMatches.push('same phone');
      } else {
        breakdown.push('different phone (+0)');
      }
    } else if (contact1.phone || contact2.phone) {
      maxPossible += 1; // Partial credit if only one has phone
      breakdown.push('missing phone (+0)');
    }
    
    // Name matching (weight: 2-4 depending on type)
    if (contact1.name && contact2.name) {
      maxPossible += 4;
      const name1 = this.normalizeName(contact1.name);
      const name2 = this.normalizeName(contact2.name);
      
      if (name1 === name2 && name1.length > 2) {
        score += 4;
        breakdown.push('exact name (+4)');
        nameMatch = true;
        strongMatches.push('exact name');
      } else if (this.areNicknameVariations(contact1, contact2)) {
        score += 3;
        breakdown.push('nickname variation (+3)');
        nameMatch = true;
      } else if (this.namesMatch(contact1, contact2)) {
        score += 3;
        breakdown.push('first+last match (+3)');
        nameMatch = true;
      } else if (this.hasSimilarNames(contact1, contact2)) {
        score += 2;
        breakdown.push('similar names (+2)');
        nameMatch = true;
      } else {
        breakdown.push('different names (+0)');
      }
    } else {
      maxPossible += 2;
      breakdown.push('missing name (+0)');
    }
    
    // Organization match (weight: 2)
    if (contact1.organization && contact2.organization) {
      maxPossible += 2;
      const org1 = this.normalizeName(contact1.organization);
      const org2 = this.normalizeName(contact2.organization);
      if (org1 === org2 && org1.length > 2) {
        score += 2;
        breakdown.push('same organization (+2)');
      } else {
        breakdown.push('different organization (+0)');
      }
    } else if (contact1.organization || contact2.organization) {
      maxPossible += 1;
      breakdown.push('missing organization (+0)');
    }
    
    // First name match (weight: 1)
    if (contact1.firstName && contact2.firstName) {
      maxPossible += 1;
      const firstName1 = this.normalizeName(contact1.firstName);
      const firstName2 = this.normalizeName(contact2.firstName);
      if (firstName1 === firstName2) {
        score += 1;
        breakdown.push('same firstName (+1)');
      } else {
        breakdown.push('different firstName (+0)');
      }
    } else if (contact1.firstName || contact2.firstName) {
      maxPossible += 0.5;
      breakdown.push('missing firstName (+0)');
    }
    
    // Last name match (weight: 2)
    if (contact1.lastName && contact2.lastName) {
      maxPossible += 2;
      const lastName1 = this.normalizeName(contact1.lastName);
      const lastName2 = this.normalizeName(contact2.lastName);
      if (lastName1 === lastName2) {
        score += 2;
        breakdown.push('same lastName (+2)');
      } else {
        breakdown.push('different lastName (+0)');
      }
    } else if (contact1.lastName || contact2.lastName) {
      maxPossible += 1;
      breakdown.push('missing lastName (+0)');
    }
    
    const percentage = maxPossible > 0 ? (score / maxPossible) * 100 : 0;
    
    return {
      total: score,
      maxPossible: maxPossible,
      percentage: percentage,
      breakdown: breakdown,
      strongMatches: strongMatches,
      nameMatch: nameMatch
    };
  }

  private normalizeName(name: string): string {
    return name.toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  private namesMatch(contact1: Contact, contact2: Contact): boolean {
    // Check if first+last name combinations match
    const name1Full = `${contact1.firstName || ''} ${contact1.lastName || ''}`.trim();
    const name2Full = `${contact2.firstName || ''} ${contact2.lastName || ''}`.trim();
    
    if (name1Full && name2Full && name1Full.length > 2) {
      return this.normalizeName(name1Full) === this.normalizeName(name2Full);
    }
    
    // Check if one's full name matches the other's first+last
    if (contact1.name && name2Full) {
      return this.normalizeName(contact1.name) === this.normalizeName(name2Full);
    }
    
    if (contact2.name && name1Full) {
      return this.normalizeName(contact2.name) === this.normalizeName(name1Full);
    }
    
    return false;
  }

  private hasSimilarNames(contact1: Contact, contact2: Contact): boolean {
    const name1 = this.normalizeName(contact1.name || '');
    const name2 = this.normalizeName(contact2.name || '');
    
    if (!name1 || !name2 || name1.length < 3 || name2.length < 3) {
      return false;
    }
    
    // Check if one name contains the other (e.g., "John Smith" vs "John")
    return name1.includes(name2) || name2.includes(name1);
  }

  private areNicknameVariations(contact1: Contact, contact2: Contact): boolean {
    // Common nickname mappings
    const nicknameMap = new Map([
      ['anthony', ['tony', 'ant']],
      ['robert', ['rob', 'bob', 'bobby']],
      ['william', ['will', 'bill', 'billy']],
      ['michael', ['mike', 'mick']],
      ['christopher', ['chris']],
      ['elizabeth', ['liz', 'beth', 'betty']],
      ['jennifer', ['jen', 'jenny']],
      ['katherine', ['kate', 'katie', 'kathy']],
      ['patricia', ['pat', 'patty']],
      ['richard', ['rick', 'rich', 'dick']],
      ['thomas', ['tom', 'tommy']],
      ['daniel', ['dan', 'danny']],
      ['matthew', ['matt']],
      ['jonathan', ['jon', 'john']],
      ['benjamin', ['ben', 'benny']],
      ['alexander', ['alex', 'al']],
      ['nicholas', ['nick']],
      ['rebecca', ['becca', 'becky']],
      ['stephanie', ['steph']],
      ['samantha', ['sam']],
      ['michelle', ['shell']],
      ['amanda', ['mandy']],
      ['joshua', ['josh']],
      ['andrew', ['andy', 'drew']],
      ['kenneth', ['ken', 'kenny']],
      ['joseph', ['joe', 'joey']],
      ['charles', ['charlie', 'chuck']],
      ['david', ['dave', 'davy']],
      ['james', ['jim', 'jimmy', 'jamie']],
      ['timothy', ['tim', 'timmy']],
      ['gregory', ['greg']],
      ['ronald', ['ron', 'ronnie']]
    ]);

    // Get name components for both contacts
    const name1Parts = this.getNameParts(contact1);
    const name2Parts = this.getNameParts(contact2);

    // Check if they have the same last name
    if (name1Parts.lastName && name2Parts.lastName) {
      const lastName1 = this.normalizeName(name1Parts.lastName);
      const lastName2 = this.normalizeName(name2Parts.lastName);
      
      if (lastName1 === lastName2) {
        // Same last name, check if first names are nickname variations
        const firstName1 = this.normalizeName(name1Parts.firstName || '');
        const firstName2 = this.normalizeName(name2Parts.firstName || '');
        
        if (firstName1 && firstName2) {
          // Check both directions: is firstName1 a nickname of firstName2, or vice versa
          return this.isNicknameOf(firstName1, firstName2, nicknameMap) ||
                 this.isNicknameOf(firstName2, firstName1, nicknameMap);
        }
      }
    }

    return false;
  }

  private getNameParts(contact: Contact): { firstName: string; lastName: string } {
    // Try to extract first and last name from various fields
    let firstName = contact.firstName || '';
    let lastName = contact.lastName || '';

    // If firstName/lastName are empty, try to parse from full name
    if (!firstName && !lastName && contact.name) {
      const nameParts = contact.name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts[nameParts.length - 1]; // Last word as last name
      } else if (nameParts.length === 1) {
        firstName = nameParts[0];
      }
    }

    return { firstName, lastName };
  }

  private isNicknameOf(name1: string, name2: string, nicknameMap: Map<string, string[]>): boolean {
    // Check if name1 is a nickname of name2
    const nicknames = nicknameMap.get(name2.toLowerCase());
    return nicknames ? nicknames.includes(name1.toLowerCase()) : false;
  }

  private analyzeMergeNeeds(group: Contact[]): string {
    const emails = group.filter(c => c.email).map(c => c.email!.toLowerCase());
    const phones = group.filter(c => c.phone).map(c => c.phone!);
    const names = group.map(c => c.name || 'Unknown');
    
    const uniqueEmails = [...new Set(emails)];
    const uniquePhones = [...new Set(phones.map(p => p.replace(/\D/g, '')))];
    const uniqueNames = [...new Set(names.map(n => this.normalizeName(n)))];
    
    const issues: string[] = [];
    
    if (uniqueNames.length > 1) {
      issues.push(`different names (${uniqueNames.join(', ')})`);
    } else {
      issues.push(`same name "${names[0]}"`);
    }
    
    if (uniqueEmails.length > 1) {
      issues.push(`different emails (${uniqueEmails.join(', ')})`);
    } else if (uniqueEmails.length === 1) {
      issues.push(`same email`);
    } else {
      issues.push(`missing emails`);
    }
    
    if (uniquePhones.length > 1) {
      issues.push(`different phones`);
    } else if (uniquePhones.length === 1) {
      issues.push(`same phone`);
    } else {
      issues.push(`missing phones`);
    }
    
    return issues.join(', ');
  }

  private isBizdevContact(contact: Contact): boolean {
    // Identify potential bizdev contacts by organization patterns and characteristics
    const org = (contact.organization || '').toLowerCase();
    const name = (contact.name || '').toLowerCase();
    
    // Common business/startup patterns
    const businessPatterns = [
      'inc', 'llc', 'corp', 'ltd', 'co.', 'company',
      'startup', 'ventures', 'capital', 'partners',
      'consulting', 'solutions', 'services', 'group',
      'technologies', 'tech', 'labs', 'media',
      'agency', 'studio', 'firm', 'enterprises'
    ];
    
    // Check if organization has business patterns
    const hasBusinessOrg = businessPatterns.some(pattern => org.includes(pattern));
    
    // Check if they have organization but incomplete personal info
    const hasOrgButIncompletePersonal = contact.organization && 
      (!contact.firstName || !contact.lastName);
    
    // Check if name contains business indicators
    const nameHasBusinessIndicators = businessPatterns.some(pattern => name.includes(pattern));
    
    return hasBusinessOrg || hasOrgButIncompletePersonal || nameHasBusinessIndicators;
  }

  private printSummary(totalContacts: number, bizdevContacts: number, duplicateGroups: number): void {
    console.log('\n🎉 Notion Duplicate Detection Test Complete!');
    console.log('===========================================');
    console.log(`📊 Total Notion contacts analyzed: ${totalContacts}`);
    console.log(`👔 Bizdev contacts identified: ${bizdevContacts}`);
    console.log(`🔄 Duplicate groups found: ${duplicateGroups}`);
    
    // Calculate expected duplicates based on "double contacts" benchmark
    const expectedUniqueContacts = Math.round(totalContacts / 2);
    const expectedDuplicateGroups = totalContacts - expectedUniqueContacts;
    
    console.log(`\n📈 Benchmark Analysis:`);
    console.log(`   Expected ~${expectedUniqueContacts} unique contacts (if contacts are doubled)`);
    console.log(`   Expected ~${expectedDuplicateGroups} duplicate groups`);
    console.log(`   Actual duplicate groups found: ${duplicateGroups}`);
    
    if (duplicateGroups === 0) {
      console.log('\n⚠️ No duplicates found! This suggests the logic is too strict.');
      console.log('💡 If contacts are doubled as suspected, the detection logic needs adjustment.');
      console.log('� Try lowering the similarity threshold or improving the scoring algorithm.');
    } else if (duplicateGroups < expectedDuplicateGroups * 0.5) {
      console.log('\n⚠️ Found fewer duplicates than expected based on "double contacts" benchmark.');
      console.log('💡 The detection logic may still be too strict.');
    } else {
      console.log('\n✅ Duplicate detection appears to be working as expected!');
      console.log('\n📋 Next Steps:');
      console.log('1. Review the duplicate groups above');
      console.log('2. Verify the logic is correctly identifying duplicates');
      console.log('3. Run the full analysis with Apple Contacts integration if satisfied');
    }
  }
}

// Main execution
async function main() {
  const test = new NotionDuplicateTest();
  
  try {
    await test.run();
    process.exit(0);
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { NotionDuplicateTest };
