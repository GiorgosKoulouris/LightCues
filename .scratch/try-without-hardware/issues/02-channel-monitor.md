# DMX channel monitor

Status: resolved

Blocked by: 01

See spec, "Channel monitor".

## Fix

- `src/shared/protocol.ts`: commands `monitorUniverse { universe }` and `stopMonitor`, and an event `dmxFrame { universe, values: number[] }`.
- `src/engine/`: while a Universe is monitored, emit its sent frame at most every 100 ms, only when it changed. Stop when asked or when the UI port closes. Read the frame from the Outputs' send path, so it is what goes out, for real and virtual Outputs alike.
- `src/renderer/src/venue/ChannelMonitor.tsx` (new) with a CSS module, using the existing tokens: a Universe picker and a 32 × 16 grid. Hover shows channel number, Fixture name and channel name. Zero values are dimmed. Dark only (ADR 0003).
- A toggle in `VenuePatchView` opens and closes it.

## Acceptance

- Engine tests: frames are emitted only while monitored, at most 10/s, only on change. Blind doesn't change what the monitor shows.
- Component test: the grid renders 512 cells, and hover shows the owning Fixture.
- Monitoring adds no delay to Output frames. Check `outputs.test.ts` timing still passes.
- `npm run check` passes.

## Comments

### 2026-10-09: resolved

- Protocol: `monitorUniverse { universe }`, `stopMonitor`, event `dmxFrame { universe, values }`.
- `outputs.ts` keeps a copy of the frame last sent per Universe, real or virtual, as `sentFrame(universe)`. It is dropped while the Output is not sending or the Universe is unmapped. `lastFrame` now reads the same map, for Universes on `virtual`.
- `engine/channel-monitor.ts`: sends the frame at once on `monitorUniverse`, then on change, on a 100 ms timer. `serve.ts` stops it when the UI port closes or a newer one replaces it.
- `ChannelMonitor.tsx`: Universe picker, 32 × 16 grid, zeros dimmed. Hover shows "Channel N · Fixture · channel name" in a readout line above the grid, not a tooltip per cell (512 tooltips is heavy). It says when nothing is sent: no Output, or the Output not sending.
- Toggle in `VenuePatchView`, on both tabs. The monitor closes when the view is left, like the Focus Check.
- CONTEXT.md: "Channel monitor" added, kept apart from Monitor the mode.
- Known: each `monitorUniverse` sends at once, so flicking the picker can pass 10/s. Kept for a responsive picker.
- Tests: `outputs.test.ts` (only while monitored, ≤ 10/s, only on change, Blind, Virtual Output, unplugged Output, switching), `serve.test.ts` (port close, port replaced), `ChannelMonitor.test.tsx`, `VenuePatchView.test.tsx`. Output timing tests unchanged and passing. `npm run check` passes.
