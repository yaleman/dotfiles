# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Development Commands

### Python Development

- **Type checking**: `uv run mypy --strict *.py`
- **Linting**: `uv run ruff check *.py`
- **Formatting**: `uv run ruff fmt *.py`
- **Testing**: `uv run pytest`
- **Complete Python workflow**: `just python` (runs mypy, ruff check, and
  pytest)

### Shell Script Validation

- **Shellcheck all scripts**: `make shellcheck`
- **Spell checking**: `just codespell`

### Build Tasks

- **Build howmanytabs AppleScript**: `make howmanytabs`

## Repository Architecture

This is a comprehensive dotfiles repository that manages personal development
environment configuration and automation for macOS.

### Core Components

#### Package Management

- `Brewfile`: Complete package manifest (200+ formulae, 80+ casks, 20+ Mac App
  Store apps)
- `default-python-packages`: Standard Python packages for new environments
- `brew-backup` and `mas-backup` scripts for maintaining package lists

#### Configuration Management

- `setup_dotfiles.py`: Creates symlinks between public/private dotfile
  directories
- `direnvrc`: Poetry integration for automatic virtual environment management
- `duti/`: File type associations and default application settings

#### Development Tools

- Git utilities: `git-pull-all`, `git-fix-my-fork`, `git-file-size-diff`
- Python toolchain uses `uv` package manager with strict typing
- Shell scripts validated with shellcheck

#### Specialized Scripts

- Media processing: HandBrake automation (`handbrake-it.sh`,
  `handbrakeitall.sh`)
- PDF utilities: Password removal and manipulation
- System monitoring: Browser tab counting (`howmanytabs.sh`)
- Security tools: ScoutSuite automation (`scoutsuite-docker.sh`)

### Project Configuration

- **Python**: Modern toolchain with uv, ruff (120 char line length), mypy
  --strict, pytest
- **Dependencies**: Click, Loguru, Pycryptodome, Pydantic, PyPDF2, requests
- **Quality standards**: All Python code must pass strict type checking and
  linting before completion

### Key Scripts

- `setup_dotfiles.py`: Main configuration deployment script
- `trade_tools_watcher.py`: Automated monitoring tool
- `parse_cf_zone_data.py`: CloudFlare zone data processing
- Media processing scripts for video encoding automation
