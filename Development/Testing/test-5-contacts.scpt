tell application "Contacts"
  -- Test adding 5 sample contacts to Apple Contacts
  set testContacts to {¬
    {firstName:"Test", lastName:"Contact1", emailAddress:"test1@example.com"}, ¬
    {firstName:"Test", lastName:"Contact2", emailAddress:"test2@example.com"}, ¬
    {firstName:"Test", lastName:"Contact3", emailAddress:"test3@example.com"}, ¬
    {firstName:"Test", lastName:"Contact4", emailAddress:"test4@example.com"}, ¬
    {firstName:"Test", lastName:"Contact5", emailAddress:"test5@example.com"}¬
  }
  
  set addedContacts to {}
  
  repeat with contactInfo in testContacts
    try
      -- Create new person
      set newPerson to make new person with properties {¬
        first name:(firstName of contactInfo), ¬
        last name:(lastName of contactInfo)¬
      }
      
      -- Add email if provided
      if (emailAddress of contactInfo) is not "" then
        make new email at end of emails of newPerson with properties {value:(emailAddress of contactInfo)}
      end if
      
      set addedContacts to addedContacts & {(firstName of contactInfo) & " " & (lastName of contactInfo)}
      
    on error errMsg
      set addedContacts to addedContacts & {"ERROR: " & errMsg}
    end try
  end repeat
  
  -- Save changes
  save
  
  return "Added contacts: " & (addedContacts as string)
end tell
