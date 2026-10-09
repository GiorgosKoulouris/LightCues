FROM mcr.microsoft.com/devcontainers/typescript-node:22-bookworm

# Build deps for native modules:
# - build-essential, python3: node-gyp
# - libasound2-dev: @julusian/midi (RtMidi, ALSA backend)
# - libudev-dev: serialport
# - python3-venv: semgrep venv (security scan)
RUN apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
       build-essential \
       python3 \
       python3-venv \
       libasound2-dev \
       libudev-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Security scan tools (ADR 0009). Pinned versions live in these ARGs only.
# The scan script (npm run security:scan) reads them from this file.
ARG OSV_SCANNER_VERSION=2.6.0
ARG OSV_SCANNER_SHA256_AMD64=ca69b3d3cd08f889a49dc0a383122f71cc528b83803671df5fd874d97485b108
ARG OSV_SCANNER_SHA256_ARM64=2c71403eb443d05891c4f268c3ad771cf4f16e5443463fd7851ef8f454d3c7e4
ARG SEMGREP_VERSION=1.179.0

# osv-scanner: release binary, checked against the published SHA256.
RUN arch="$(dpkg --print-architecture)" \
    && case "$arch" in \
         amd64) sha="$OSV_SCANNER_SHA256_AMD64" ;; \
         arm64) sha="$OSV_SCANNER_SHA256_ARM64" ;; \
         *) echo "osv-scanner: unsupported arch $arch" >&2; exit 1 ;; \
       esac \
    && curl -fsSL -o /usr/local/bin/osv-scanner \
       "https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/osv-scanner_linux_${arch}" \
    && echo "${sha}  /usr/local/bin/osv-scanner" | sha256sum -c - \
    && chmod 0755 /usr/local/bin/osv-scanner

# semgrep: pinned, in its own venv, linked onto PATH.
RUN python3 -m venv /opt/semgrep \
    && /opt/semgrep/bin/pip install --no-cache-dir "semgrep==${SEMGREP_VERSION}" \
    && ln -s /opt/semgrep/bin/semgrep /usr/local/bin/semgrep
