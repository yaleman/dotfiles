.PHONY:
howmanytabs:
	osacompile -o howmanytabsraw howmanytabsraw.applescript

shellcheck:
	find . -type f -not -path './.git/*' -exec file "{}" \; | grep 'shell script' | awk -F':' '{print $$1}' | xargs shellcheck

