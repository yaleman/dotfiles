FROM golang:1.26.0-bookworm AS cmctl-builder

RUN CGO_ENABLED=0 go install github.com/cert-manager/cmctl/v2@v2.5.0

FROM python:3.13.14-slim-bookworm AS python-builder

WORKDIR /app

RUN pip install --no-cache-dir uv==0.12.1

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY src ./src
RUN uv sync --locked --no-dev --no-editable

FROM python:3.13.14-slim-bookworm

ENV HOME=/tmp \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY --from=cmctl-builder /go/bin/cmctl /usr/local/bin/cmctl
COPY --from=python-builder /app/.venv ./.venv

USER 65532:65532

ENTRYPOINT ["python", "-m", "omada_certificate_updater"]
