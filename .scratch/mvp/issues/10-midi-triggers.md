# MIDI input and Triggers

Status: ready-for-agent
Blocked by: 07, 08

MIDI input in the engine process (@julusian/midi). Select the input port (rtpMIDI sessions appear as normal ports). Map channel + note to a Scene with mode Go (activate, stays on), Flash (active while held) or Release (clear the Layer). MIDI learn for mapping. On port loss: hold the current look and raise a warning.

## Acceptance

- Trigger behaviour is unit-tested with synthetic MIDI messages.
- Port loss and return are surfaced in the UI.

## Comments

### 2026-10-07: from issue 01

Whichever of 06 and 10 lands first adds the first native module. Add a `postinstall` step that rebuilds it for Electron on the Windows host (`docs/setup.md` §6). In the devcontainer, engine tests run under plain Node, so the module must stay built for Node there.
