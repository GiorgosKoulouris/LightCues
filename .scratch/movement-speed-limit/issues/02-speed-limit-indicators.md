# Speed limit indicators

Status: ready-for-agent
Blocked by: 01

See spec: Implementation Decisions, "Effect editor" and "Scene button badge".

## What to build

- Effect editor: for a movement Effect, "limited to <length> at current Tempo" from the fitting function at the live Tempo. Updates with the Tempo.
- Scene button (Perform and Fallback Panel): a badge while its Scene is active and limited, from the `playback` event, with a tooltip naming the length in use.
- CHANGELOG line.

## Acceptance

- The note shows and clears as the Tempo crosses the limit.
- The badge shows on both Perform and Fallback Panel Scene buttons and clears when no longer limited.
- `npm test` and lint pass. Check in the running app.
