#!/usr/bin/env node

/**
 * Debug tool to test duplicate detection logic with specific names
 */

// Simulate the duplicate detection logic
function normalizeName(name) {
  return name.toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace
}

function namesMatch(contact1, contact2) {
  // Check if first+last name combinations match
  const name1Full = `${contact1.firstName || ''} ${contact1.lastName || ''}`.trim();
  const name2Full = `${contact2.firstName || ''} ${contact2.lastName || ''}`.trim();
  
  if (name1Full && name2Full && name1Full.length > 2) {
    return normalizeName(name1Full) === normalizeName(name2Full);
  }
  
  // Check if one's full name matches the other's first+last
  if (contact1.name && name2Full) {
    return normalizeName(contact1.name) === normalizeName(name2Full);
  }
  
  if (contact2.name && name1Full) {
    return normalizeName(contact2.name) === normalizeName(name1Full);
  }
  
  return false;
}

function hasSimilarNames(contact1, contact2) {
  const name1 = normalizeName(contact1.name || '');
  const name2 = normalizeName(contact2.name || '');
  
  if (!name1 || !name2 || name1.length < 3 || name2.length < 3) {
    return false;
  }
  
  // Check if one name contains the other (e.g., "John Smith" vs "John")
  return name1.includes(name2) || name2.includes(name1);
}

function areContactsDuplicate(contact1, contact2) {
  console.log(`\n🔍 Comparing:`);
  console.log(`   Contact 1: "${contact1.name}" (${contact1.firstName} ${contact1.lastName}) - ${contact1.email} - ${contact1.phone} - ${contact1.organization || ''}`);
  console.log(`   Contact 2: "${contact2.name}" (${contact2.firstName} ${contact2.lastName}) - ${contact2.email} - ${contact2.phone} - ${contact2.organization || ''}`);
  
  // Calculate similarity score based on matching properties
  const score = calculateSimilarityScore(contact1, contact2);
  console.log(`   📊 Similarity score: ${score.total}/${score.maxPossible} (${Math.round(score.percentage)}%)`);
  console.log(`   📝 Score breakdown: ${score.breakdown.join(', ')}`);
  
  // Strong matches (any single strong indicator = duplicate)
  if (score.strongMatches.length > 0) {
    console.log(`   ✅ DUPLICATE: Strong match - ${score.strongMatches.join(', ')}`);
    return true;
  }
  
  // Majority rule: if 60% or more properties match, consider duplicate
  if (score.percentage >= 60) {
    console.log(`   ✅ DUPLICATE: Majority match (${Math.round(score.percentage)}% similarity)`);
    return true;
  }
  
  // Special case: if names match and at least one other property matches
  if (score.nameMatch && score.total >= 4) {
    console.log(`   ✅ DUPLICATE: Name match + supporting evidence`);
    return true;
  }

  console.log(`   ❌ NOT DUPLICATE: Insufficient similarity (${Math.round(score.percentage)}%)`);
  return false;
}

function calculateSimilarityScore(contact1, contact2) {
  let score = 0;
  let maxPossible = 0;
  const breakdown = [];
  const strongMatches = [];
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
    const name1 = normalizeName(contact1.name);
    const name2 = normalizeName(contact2.name);
    
    if (name1 === name2 && name1.length > 2) {
      score += 4;
      breakdown.push('exact name (+4)');
      nameMatch = true;
      strongMatches.push('exact name');
    } else if (areNicknameVariations(contact1, contact2)) {
      score += 3;
      breakdown.push('nickname variation (+3)');
      nameMatch = true;
    } else if (namesMatch(contact1, contact2)) {
      score += 3;
      breakdown.push('first+last match (+3)');
      nameMatch = true;
    } else if (hasSimilarNames(contact1, contact2)) {
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
    const org1 = normalizeName(contact1.organization);
    const org2 = normalizeName(contact2.organization);
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
    const firstName1 = normalizeName(contact1.firstName);
    const firstName2 = normalizeName(contact2.firstName);
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
    const lastName1 = normalizeName(contact1.lastName);
    const lastName2 = normalizeName(contact2.lastName);
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

function areNicknameVariations(contact1, contact2) {
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
  const name1Parts = getNameParts(contact1);
  const name2Parts = getNameParts(contact2);

  console.log(`   🔍 Name parts: "${name1Parts.firstName} ${name1Parts.lastName}" vs "${name2Parts.firstName} ${name2Parts.lastName}"`);

  // Check if they have the same last name
  if (name1Parts.lastName && name2Parts.lastName) {
    const lastName1 = normalizeName(name1Parts.lastName);
    const lastName2 = normalizeName(name2Parts.lastName);
    
    if (lastName1 === lastName2) {
      console.log(`   ✅ Same last name: "${lastName1}"`);
      // Same last name, check if first names are nickname variations
      const firstName1 = normalizeName(name1Parts.firstName || '');
      const firstName2 = normalizeName(name2Parts.firstName || '');
      
      if (firstName1 && firstName2) {
        // Check both directions: is firstName1 a nickname of firstName2, or vice versa
        const isNickname = isNicknameOf(firstName1, firstName2, nicknameMap) ||
               isNicknameOf(firstName2, firstName1, nicknameMap);
        
        if (isNickname) {
          console.log(`   ✅ Nickname match: "${firstName1}" ↔ "${firstName2}"`);
        } else {
          console.log(`   ❌ Not nicknames: "${firstName1}" vs "${firstName2}"`);
        }
        
        return isNickname;
      }
    }
  }

  return false;
}

function getNameParts(contact) {
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

function isNicknameOf(name1, name2, nicknameMap) {
  // Check if name1 is a nickname of name2
  const nicknames = nicknameMap.get(name2.toLowerCase());
  return nicknames ? nicknames.includes(name1.toLowerCase()) : false;
}

// Test cases for Anthony Costello
const testCases = [
  {
    name: "Anthony Costello Scenario 1 - Same Name, Different Emails",
    contacts: [
      {
        name: "Anthony Costello",
        firstName: "Anthony",
        lastName: "Costello", 
        email: "anthony@example.com",
        phone: "+1234567890",
        organization: "TechCorp"
      },
      {
        name: "Anthony Costello",
        firstName: "",
        lastName: "",
        email: "anthony.costello@company.com", 
        phone: "",
        organization: ""
      }
    ]
  },
  {
    name: "Anthony Costello Scenario 2 - Nickname Variation",
    contacts: [
      {
        name: "Anthony Costello",
        firstName: "Anthony",
        lastName: "Costello",
        email: "anthony@example.com",
        phone: "",
        organization: "TechCorp"
      },
      {
        name: "Tony Costello", 
        firstName: "Tony",
        lastName: "Costello",
        email: "",
        phone: "+1234567890",
        organization: "TechCorp"
      }
    ]
  },
  {
    name: "Anthony Costello Scenario 3 - Partial Match",
    contacts: [
      {
        name: "Anthony Costello",
        firstName: "",
        lastName: "", 
        email: "",
        phone: "",
        organization: ""
      },
      {
        name: "Anthony",
        firstName: "Anthony",
        lastName: "Costello",
        email: "anthony@example.com",
        phone: "",
        organization: ""
      }
    ]
  },
  {
    name: "Majority Match Example - Different Names, Same Email + Phone",
    contacts: [
      {
        name: "John Smith",
        firstName: "John",
        lastName: "Smith",
        email: "contact@example.com",
        phone: "+1555123456",
        organization: "ABC Inc"
      },
      {
        name: "J. Smith",
        firstName: "J",
        lastName: "Smith",
        email: "contact@example.com",
        phone: "+1555123456",
        organization: "ABC Inc"
      }
    ]
  },
  {
    name: "Edge Case - Same Organization + Phone, Different Names",
    contacts: [
      {
        name: "Sarah Johnson",
        firstName: "Sarah",
        lastName: "Johnson",
        email: "",
        phone: "+1555987654",
        organization: "StartupXYZ"
      },
      {
        name: "S. Johnson",
        firstName: "S",
        lastName: "Johnson",
        email: "sarah.j@startupxyz.com",
        phone: "+1555987654",
        organization: "StartupXYZ"
      }
    ]
  },
  {
    name: "False Positive Test - Different People, Same Last Name",
    contacts: [
      {
        name: "Michael Brown",
        firstName: "Michael",
        lastName: "Brown",
        email: "mike@techcorp.com",
        phone: "+1555111111",
        organization: "TechCorp"
      },
      {
        name: "Jennifer Brown",
        firstName: "Jennifer",
        lastName: "Brown",
        email: "jen@designco.com",
        phone: "+1555222222",
        organization: "DesignCo"
      }
    ]
  }
];

console.log('🧪 Testing Duplicate Detection Logic\n');
console.log('=====================================');

for (const testCase of testCases) {
  console.log(`\n📋 ${testCase.name}:`);
  console.log('=====================================');
  
  const [contact1, contact2] = testCase.contacts;
  const isDuplicate = areContactsDuplicate(contact1, contact2);
  
  console.log(`\n🎯 Result: ${isDuplicate ? '✅ DUPLICATE' : '❌ NOT DUPLICATE'}`);
  console.log('-------------------------------------');
}
