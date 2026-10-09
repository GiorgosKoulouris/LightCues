# Devcontainer

For engine and logic work: models, Scene resolution, frame encoding, Trigger logic, tests, lint.

Not for: running the Electron app, USB DMX Outputs, rtpMIDI, or Windows packaging. Do those on the Windows host with its own `npm install`.

`node_modules` is a named Docker volume, so Linux and Windows native builds stay separate.

`ELECTRON_SKIP_BINARY_DOWNLOAD=1` is set here so the container never downloads Electron. Don't set it on the Windows host. If `npm run dev` there fails with `Electron uninstall`, see [docs/setup.md §9](../docs/setup.md#9-troubleshooting).

## Security scan tools

The Dockerfile installs two scanners for the ad hoc security scan ([ADR 0009](../docs/adr/0009-ad-hoc-security-scan.md)):

- **osv-scanner**: finds known vulnerabilities in `package-lock.json` and the packaged app's `node_modules`, and reports their licenses. Installed as a release binary, checked against its published SHA256.
- **semgrep**: static analysis of `src/`. Installed with pip in a venv at `/opt/semgrep`, so it stays apart from the system Python.

Versions are pinned as the security-scan `ARG`s in the Dockerfile. The scan script reads them and stops if the installed versions differ. After changing a pin, rebuild the container.

How to run a scan and read its report: [docs/security-scan.md](../docs/security-scan.md).
