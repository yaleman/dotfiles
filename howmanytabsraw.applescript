on run argv
	-- Options
	set doBBEdit to 0
	set popAlert to 0
	set sendToHEC to 1
	set hostName to do shell script "/bin/hostname -s"

	tell application "System Events"
		tell property list file "~/.config/howmanytabs.plist"
			set hecHost to value of property list item "hecHost"
			set hecPort to value of property list item "hecPort"
			set hecToken to value of property list item "hecToken"
		end tell
	end tell

	do shell script "uuidgen"
	set channel to (get result)

	set baseURL to "https://" & hecHost & ":" & hecPort & "/services/collector/raw?channel=" & channel & "&host=" & hostName & "&sourcetype=tabcounter"

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
			--repeat with y from 1 to tabcount

			--Get Tab Name & URL
			--set tabName to name of tab y of window windowNumber
			--set tabURL to URL of tab y of window windowNumber
			--set docText to docText & "<li><a href=" & "\"" & tabURL & "\">" & tabName & "</a></li>" & linefeed as string
			--end result epeat
			--set docText to docText & "</ul>" & linefeed as string

		end repeat
		set docText to docText & "<br />Total tabs: " & tabCountTotal & linefeed as string
	end tell

	if (doBBEdit = 1) then
		--Write Document Text
		tell application "Automator"
			activate
			make new document
			set the text of the front document to docText
		end tell
	end if

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
