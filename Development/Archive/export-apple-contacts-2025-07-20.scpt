
      tell application "Contacts"
        set contactsList to {}
        set totalContacts to count of every person
        
        repeat with i from 1 to totalContacts
          set aPerson to person i
          set contactName to ""
          set contactEmail to ""
          
          try
            set contactName to name of aPerson
          end try
          
          try
            if (count of emails of aPerson) > 0 then
              set contactEmail to value of first email of aPerson
            end if
          end try
          
          if contactName is not "" or contactEmail is not "" then
            set contactRecord to contactName & "|||" & contactEmail
            set contactsList to contactsList & {contactRecord}
          end if
          
          -- Progress indicator for large contact lists
          if i mod 100 = 0 then
            log "Processed " & i & " of " & totalContacts & " contacts"
          end if
        end repeat
        
        return contactsList
      end tell
    