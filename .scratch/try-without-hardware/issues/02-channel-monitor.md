# DMX channel monitor

Status: ready-for-agent

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
