.DEFAULT: help
.PHONY: help
help:
	@echo "make [target]"
	@echo ""
	@echo "Targets:"
	@egrep "^(.+)\:\ ##\ (.+)" ${MAKEFILE_LIST} | column -t -c 2 -s ':#' | sort

.PHONY:howmanytabs
howmanytabs: ## Build the howmanytabs script
howmanytabs:
	osacompile -o howmanytabsraw howmanytabsraw.applescript

.PHONY: shellcheck
shellcheck: ## Shellcheck all the things
shellcheck:
	find . -type f -not -path './.git/*' -exec file "{}" \; | grep 'shell script' | awk -F':' '{print $$1}' | xargs shellcheck

