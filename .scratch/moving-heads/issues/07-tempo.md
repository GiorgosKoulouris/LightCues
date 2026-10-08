# Tempo: MIDI Clock and Tap Tempo

Status: ready-for-agent

See spec, "Tempo".

## Acceptance

- The engine keeps the Tempo (BPM) and a beat phase. Default 120 BPM.
- MIDI Clock (24 ppqn) on the MIDI Input sets the Tempo, smoothed over a few beats. Start/Continue/Stop are ignored.
- Tap Tempo: a Fallback Panel button and a keyboard shortcut. The average of the last taps sets the Tempo. A tap after a 2 s gap starts over. A tap overrides the clock until the clock's next beat.
- When the clock stops arriving, the last Tempo holds.
- The Fallback Panel shows the current BPM and whether it comes from the clock or taps.
- Tests: clock to BPM, tap averaging and reset, clock loss holds, tap override.
