python:
    uv run mypy --strict *.py
    uv run ruff check *.py
    uv run pytest

codespell:
    uvx codespell