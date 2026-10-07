FROM mcr.microsoft.com/devcontainers/typescript-node:22-bookworm

# Build deps for native modules:
# - build-essential, python3: node-gyp
# - libasound2-dev: @julusian/midi (RtMidi, ALSA backend)
# - libudev-dev: serialport
RUN apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
       build-essential \
       python3 \
       libasound2-dev \
       libudev-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
