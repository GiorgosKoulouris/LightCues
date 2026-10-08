# Beam lines in the preview

Status: ready-for-agent
Blocked by: 02

See spec, "Live control".

## Acceptance

- The preview's stage plan draws a line from each mover to where its beam lands: the floor (height 0), else the audience plane (y = −(depth + 5)), else a fixed length for beams pointing up.
- The line uses the mover's output colour and fades with its intensity. No line at 0 intensity.
- Computed from the resolved pan/tilt (inverse of the aim maths), so it shows Effects and fades too.
- Works in Monitor, Blind and Focus Check.
- Tests for the landing-point maths.
