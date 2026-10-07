# Enttec USB Pro protocol output

Status: resolved
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

### 2026-10-07: implemented on `dev` (agent, devcontainer)

Done:

- Frame encoding (`src/engine/enttec.ts`): `encodeSendDmx` builds a label 6 message: 0x7E, 6, length LSB/MSB, start code 0, 24–512 channels (fewer are zero-padded), 0xE7.
- Outputs (`src/engine/outputs.ts`, wired in `engine.ts`):
  - Discovery lists serial ports every second. Ports with the FTDI vendor id `0403` are Outputs.
  - An Output's id is its USB serial number, or its port path when it has none. A device keeps its id when Windows gives it a new COM port.
  - Only Outputs a Universe maps to are opened. Each mapped Universe's frame goes to its Output every 25 ms. Several Outputs run at once.
  - While a write is pending, frames are skipped. If a write has not completed after one second, the Output counts as failed.
  - Unplug, open or write errors mark the Output `failed` (or `missing` once it is gone). The next scan reopens it when it is found again, with no restart.
- Frames are blackout for now. The engine passes `frame: (universe) => Uint8Array` to `createOutputs`; issue 08 replaces it.
- Protocol: `listOutputs`, and `outputs { outputs: OutputStatus[] }` on request and after every change. States: `unused`, `connecting`, `sending`, `failed` (with `error`), `missing` (mapped but not plugged in).
- `src/engine/serial-ports.ts` is the only file that loads `serialport`. `engine-process.ts` passes it in. Tests use fakes.
- UI: the free-text Output id is now a choice of discovered Outputs. A mapped Output that is unplugged stays listed. A Status column shows Connecting / Sending / Failed / Not connected.

Native module: no `postinstall` rebuild. `@serialport/bindings-cpp` ships N-API prebuilds (win32-x64 included), which load in both Node and Electron. `docs/setup.md` §6 is updated.

Acceptance:

- Frame encoding is unit-tested against the protocol: `enttec.test.ts`.
- Unplug/replug recovers without a restart: tested with fake serial ports in `outputs.test.ts`, which also covers failed opens, failed and stuck writes, and unmapping. Not tried on hardware.

`npm test`, `typecheck`, `lint`, `format:check` and `build` pass.

Still open:

- Check on the Windows host with real hardware (human):
  - Enttec DMX USB Pro and DMXking ultraDMX are discovered and output DMX.
  - Unplug/replug recovers.
  - The serial number appears as the id.
  - The actual frame rate. Windows timers tick every ~15.6 ms, so a 25 ms interval may run at ~32 Hz.
- Discovery accepts every FTDI device, including generic USB-serial adapters and the Enttec Open DMX USB, which does not speak this protocol. A DMXking device with its own vendor id would be missed. If that matters, query the device (label 10, serial number) before treating it as an Output.
- The Output choice also lists Outputs used by another Universe. Picking one is rejected by patch validation.
- Unmapping and remapping an Output while its port is still opening can fail once (the port is busy). The next scan recovers it.
- `serialport`'s Linux `list()` spawns `udevadm`, which the devcontainer lacks. It crashes the process there, so the real adapter only runs on the Windows host.
