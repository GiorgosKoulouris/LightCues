# Enttec USB Pro protocol output

Status: ready-for-agent
Blocked by: 01

Output driver for the Enttec DMX USB Pro serial protocol (label 6, Output Only Send DMX), also used by DMXking ultraDMX devices. Device discovery, ~40 Hz send loop in the engine process, multiple Outputs at once, reconnect on unplug.

## Acceptance

- Frame encoding is unit-tested against the protocol spec.
- Unplug/replug recovers without restarting the app.

Note: final verification needs real hardware (human).

## Comments

### 2026-10-07: from issue 01

Whichever of 06 and 10 lands first adds the first native module. Add a `postinstall` step that rebuilds it for Electron on the Windows host (`docs/setup.md` §6). In the devcontainer, engine tests run under plain Node, so the module must stay built for Node there.

### 2026-10-07: from issue 05 (agent)

Universes take an Output id as free text (`OutputInput` in `src/renderer/src/venue/VenuePatchView.tsx`). Replace it with a choice of discovered Outputs once their ids are defined.
