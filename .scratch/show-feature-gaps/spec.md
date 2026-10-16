# Show feature gaps

Status: needs-triage

Found while building a 45-minute metal show for The Temple rig (4 FOS Smart Beam, 8 FOS Wash LED Quad III, 4 FOS PAR 18x10, 2 ADJ Mini Dekker), driven by DAW MIDI. The show (`temp/The Temple Metal.lcshow`) works within today's features. These are the things it wanted and could not have. Not designed yet: each needs grilling before issues are cut.

## Gaps, by value for a high-energy show

1. **Strobe.** No Rule attribute for it. All four Profiles already parse `strobe` ranges (Quad and Beam Shutter, PAR and Dekker Strobe, Beam Ring Strobe), and the engine only ever sets shutter `open`. Hits fake strobe with Flash Scenes, which needs one MIDI note per flash. Likely shape: a Rule strobe rate, in Hz or synced to Tempo.
2. **Intensity and colour Effects.** Effects are movement only. No intensity chase, pulse on the beat, or colour alternation across a Spread. The DAW has to sequence these note by note.
3. **Gobo, prism, frost.** The Smart Beam's Gobo Wheel is parsed as `wheelSlot` (unused), and Prism 1/2 and Frost are `unsupported`. Beams are always open and unprismed.
4. **Zoom and focus.** The Quad's Zoom and the Beam's Focus are `unsupported`, so beam size can't change per Scene.
5. **Sub-Zone targeting.** Both Dekkers sit in one Zone (Upstage Overhead Centre), and each side's 2 Beams share a Zone. A Rule can't give them different colours, and a Quad's 3 cells can't differ (Profiles have no cell model).
6. **Effect motors and fixture programs.** The Dekker Motor (`unsupported: Rotation`), the Ring and PAR programs, and the Quad Effects/Macros stay at their defaults.

## Triage (2026-10-16)

- 1 and 2: done (strobe, and intensity and colour Effects).
- 3, 4 and 5: still needs-triage.
- 6: wontfix. Built-in programs aren't portable across rigs and don't follow the Tempo. Engine Effects cover them.

## Notes

- Custom hue/saturation colours on the Smart Beam snap to the nearest colour-wheel slot. Its LED ring shows them exactly.
- On this rig every mover is Hung, so Direction **Up** is out of reach. The show leaves it out rather than carrying an approximated aim.
