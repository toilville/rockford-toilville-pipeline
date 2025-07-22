tell application "Contacts"
  -- Remove the test contacts we just added
  set testNames to {"Test Contact1", "Test Contact2", "Test Contact3", "Test Contact4", "Test Contact5"}
  set deletedCount to 0
  
  repeat with testName in testNames
    try
      set testPerson to first person whose name is testName
      delete testPerson
      set deletedCount to deletedCount + 1
    on error
      -- Contact not found, skip
    end try
  end repeat
  
  save
  
  return "Deleted " & deletedCount & " test contacts"
end tell
