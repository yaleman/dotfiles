on run argv
	-- Options
	set popAlert to 0
	set sendToHEC to 0
	set hostName to do shell script "/bin/hostname -s"
	
	tell application "System Events"
		tell property list file "~/.config/howmanytabs.plist"
			set hecHost to value of property list item "hecHost"
			set hecPort to value of property list item "hecPort"
			set hecToken to value of property list item "hecToken"
		end tell
	end tell
	
	-- getting a uuid so we don't mess up channels	
	do shell script "uuidgen"
	set channel to (get result)
	
	set baseURL to "https://" & hecHost & ":" & hecPort & "/services/collector/raw?channel=" & channel & "&host=" & hostName
	
	-- write the csv headers
	-- File path for the CSV
	set filePath to (path to home folder as text) & ".cache:howmanytabs.json"
	
	-- Create/Open the file and write the headers
	set fileRef to open for access file filePath with write permission
	--	write "window_id,tab_id,tab_name,tab_url" & return to fileRef
	
	
	tell application "Safari"
		-- Script running variables
		set windowCount to number of windows
		set tabCountTotal to 0
		set docText to ""
		
		--Repeat for Every Window
		repeat with windowNumber from 1 to windowCount
			set tabcount to number of tabs in window windowNumber
			set tabCountTotal to tabCountTotal + tabcount
			
			set docText to docText & "Tab count: " & tabcount & linefeed as string
			--set docText to docText & "<ul>" & linefeed as string
			--Repeat for Every Tab in Current Window
			repeat with tabNumber from 1 to tabcount
				--Get Tab Name & URL
				set tabName to name of tab tabNumber of window windowNumber
				
				-- this allows us to remove quote marks
				set AppleScript's text item delimiters to "\""
				set tabName to text items of tabName
				set AppleScript's text item delimiters to "" -- Reset the text item delimiters back to defaults
				
				
				
				set tabURL to URL of tab tabNumber of window windowNumber
				--set docText to docText & "<li><a href=" & "\"" & tabURL & "\">" & tabName & "</a></li>" & linefeed as string
				
				set fileLine to "{ \"window_number\": " & (windowNumber as string) & ", \"tab_number\" : " & (tabNumber as string) & ", \"tab_name\" : \"" & (tabName as string) & "\", \"tab_url\": \"" & (tabURL as string) & "\" }" & return
				write fileLine to fileRef starting at eof
				
			end repeat
			--set docText to docText & "</ul>" & linefeed as string
			
		end repeat
		set docText to docText & "<br />Total tabs: " & tabCountTotal & linefeed as string
	end tell
	
	close access fileRef
	
	
	if (sendToHEC = 1) then
		--do shell script
		hostName
		--\"host\":\"" & hostName & "\",
		set dataValue to "{\"browser\" : \"safari\", \"tabs\":" & tabCountTotal & ", \"windows\":" & windowCount & "}"
		set authHeader to "Authorization: Splunk " & hecToken
		
		set outputValue to do shell script "/usr/bin/curl -s -v -H " & quoted form of authHeader & " --data " & quoted form of dataValue & " " & quoted form of baseURL
		outputValue
		
		
	end if
	
	if (popAlert = 1) then
		tell application "Script Editor"
			activate
		end tell
		display alert "Total tabs: " & tabCountTotal
	end if
	
end run
