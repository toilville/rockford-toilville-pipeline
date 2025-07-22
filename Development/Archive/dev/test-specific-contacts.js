#!/usr/bin/env node

// Test specific contact names mentioned by the user
const contacts = [
  // Anthony Costello variations
  { id: '1', name: 'Anthony Costello', email: 'anthony@example.com', firstName: 'Anthony', lastName: 'Costello' },
  { id: '2', name: 'Tony Costello', email: 'tony@example.com', firstName: 'Tony', lastName: 'Costello' },
  { id: '3', name: 'Anthony Costello', email: 'anthony.costello@work.com', firstName: 'Anthony', lastName: 'Costello' },
  
  // Avi Cohen variations
  { id: '4', name: 'Avi Cohen', email: 'avi@example.com', firstName: 'Avi', lastName: 'Cohen' },
  { id: '5', name: 'Avi Cohen', email: '', firstName: 'Avi', lastName: 'Cohen', phone: '555-1234' },
  { id: '6', name: 'A Cohen', email: 'avi@example.com', firstName: 'A', lastName: 'Cohen' },
  
  // Balun variations
  { id: '7', name: 'Balun', email: 'balun@example.com', firstName: 'Balun', lastName: '' },
  { id: '8', name: 'Balun', email: '', firstName: 'Balun', lastName: '', phone: '555-5678' },
  { id: '9', name: 'Balun Smith', email: 'balun@example.com', firstName: 'Balun', lastName: 'Smith' },
  
  // Blanche Devereaux variations  
  { id: '10', name: 'Blanche Devereaux', email: 'blanche@example.com', firstName: 'Blanche', lastName: 'Devereaux' },
  { id: '11', name: 'Blanche', email: 'blanche@example.com', firstName: 'Blanche', lastName: '' },
  { id: '12', name: 'B Devereaux', email: 'b.dev@example.com', firstName: 'B', lastName: 'Devereaux' },
  
  // Dan McLay variations
  { id: '13', name: 'Dan McLay', email: 'dan@example.com', firstName: 'Dan', lastName: 'McLay' },
  { id: '14', name: 'Daniel McLay', email: 'daniel@example.com', firstName: 'Daniel', lastName: 'McLay' },
  { id: '15', name: 'Dan McLay', email: 'dan.mclay@work.com', firstName: 'Dan', lastName: 'McLay' }
];

// Simplified duplicate detection logic from the analysis tool
function normalizeName(name) {
  return name.toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace
}

function getNameParts(contact) {
  let firstName = contact.firstName || '';
  let lastName = contact.lastName || '';

  // If firstName/lastName are empty, try to parse from full name
  if (!firstName && !lastName && contact.name) {
    const nameParts = contact.name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      firstName = nameParts[0];
      lastName = nameParts[nameParts.length - 1];
    } else if (nameParts.length === 1) {
      firstName = nameParts[0];
    }
  }

  return { firstName, lastName };
}

function isNicknameOf(name1, name2, nicknameMap) {
  const nicknames = nicknameMap.get(name2.toLowerCase());
  return nicknames ? nicknames.includes(name1.toLowerCase()) : false;
}

function areNicknameVariations(contact1, contact2) {
  const nicknameMap = new Map([
    ['anthony', ['tony', 'ant']],
    ['daniel', ['dan', 'danny']],
    ['robert', ['rob', 'bob', 'bobby']],
    ['william', ['will', 'bill', 'billy']],
    ['michael', ['mike', 'mick']],
    ['christopher', ['chris']],
    ['elizabeth', ['liz', 'beth', 'betty']],
    ['jennifer', ['jen', 'jenny']],
    ['richard', ['rick', 'rich', 'dick']],
    ['thomas', ['tom', 'tommy']],
    ['matthew', ['matt']],
    ['jonathan', ['jon', 'john']],
    ['benjamin', ['ben', 'benny']],
    ['alexander', ['alex', 'al']],
    ['nicholas', ['nick']],
    ['joshua', ['josh']],
    ['andrew', ['andy', 'drew']],
    ['kenneth', ['ken', 'kenny']],
    ['joseph', ['joe', 'joey']],
    ['charles', ['charlie', 'chuck']],
    ['david', ['dave', 'davy']],
    ['james', ['jim', 'jimmy', 'jamie']],
    ['timothy', ['tim', 'timmy']]
  ]);

  const name1Parts = getNameParts(contact1);
  const name2Parts = getNameParts(contact2);

  // Check if they have the same last name
  if (name1Parts.lastName && name2Parts.lastName) {
    const lastName1 = normalizeName(name1Parts.lastName);
    const lastName2 = normalizeName(name2Parts.lastName);
    
    if (lastName1 === lastName2) {
      const firstName1 = normalizeName(name1Parts.firstName || '');
      const firstName2 = normalizeName(name2Parts.firstName || '');
      
      if (firstName1 && firstName2) {
        return isNicknameOf(firstName1, firstName2, nicknameMap) ||
               isNicknameOf(firstName2, firstName1, nicknameMap);
      }
    }
  }

  return false;
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
  
  // Check if one name contains the other
  return name1.includes(name2) || name2.includes(name1);
}

function areContactsDuplicate(contact1, contact2) {
  // Same email = definitely duplicate
  if (contact1.email && contact2.email && 
      contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
    return true;
  }
  
  // Same phone = definitely duplicate
  if (contact1.phone && contact2.phone) {
    const phone1 = contact1.phone.replace(/\D/g, '');
    const phone2 = contact2.phone.replace(/\D/g, '');
    if (phone1 === phone2 && phone1.length > 6) {
      return true;
    }
  }

  // Same name = potential duplicate
  if (contact1.name && contact2.name) {
    const name1 = normalizeName(contact1.name);
    const name2 = normalizeName(contact2.name);
    
    if (name1 === name2 && name1.length > 2) {
      return true;
    }
    
    // Check for nickname variations
    if (areNicknameVariations(contact1, contact2)) {
      return true;
    }
    
    // Check first+last name combinations
    if (namesMatch(contact1, contact2)) {
      return true;
    }
  }

  // Similar names with shared contact info
  if (hasSimilarNames(contact1, contact2)) {
    if (contact1.email && contact2.email && 
        contact1.email.toLowerCase() === contact2.email.toLowerCase()) {
      return true;
    }
    if (contact1.phone && contact2.phone) {
      const phone1 = contact1.phone.replace(/\D/g, '');
      const phone2 = contact2.phone.replace(/\D/g, '');
      if (phone1 === phone2 && phone1.length > 6) {
        return true;
      }
    }
  }

  return false;
}

function findDuplicateGroups(contacts) {
  const groups = [];
  const processed = new Set();

  for (const contact of contacts) {
    if (processed.has(contact.id)) continue;

    const duplicates = contacts.filter(other => 
      other.id !== contact.id &&
      !processed.has(other.id) &&
      areContactsDuplicate(contact, other)
    );

    if (duplicates.length > 0) {
      const group = [contact, ...duplicates];
      groups.push(group);
      group.forEach(c => processed.add(c.id));
    }
  }

  return groups;
}

// Test the logic
console.log('🔍 Testing Duplicate Detection Logic on Specific Contacts');
console.log('======================================================\n');

const duplicateGroups = findDuplicateGroups(contacts);

console.log(`📊 Found ${duplicateGroups.length} duplicate groups:\n`);

duplicateGroups.forEach((group, index) => {
  console.log(`Group ${index + 1} (${group.length} contacts):`);
  group.forEach(contact => {
    console.log(`  • ID ${contact.id}: "${contact.name}" (${contact.firstName} ${contact.lastName}) - ${contact.email || 'no email'} - ${contact.phone || 'no phone'}`);
  });
  console.log('');
});

// Test specific pairwise comparisons
console.log('\n🔬 Specific Pairwise Tests:');
console.log('===========================');

const testPairs = [
  ['Anthony Costello', 'Tony Costello'],
  ['Avi Cohen', 'A Cohen'],
  ['Balun', 'Balun Smith'],
  ['Blanche Devereaux', 'Blanche'],
  ['Dan McLay', 'Daniel McLay']
];

testPairs.forEach(([name1, name2]) => {
  const contact1 = contacts.find(c => c.name === name1);
  const contact2 = contacts.find(c => c.name === name2);
  
  if (contact1 && contact2) {
    const isDuplicate = areContactsDuplicate(contact1, contact2);
    console.log(`${name1} vs ${name2}: ${isDuplicate ? '✅ DUPLICATE' : '❌ NOT DUPLICATE'}`);
  }
});
