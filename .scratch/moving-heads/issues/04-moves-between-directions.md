# Moves between Directions

Status: resolved
Blocked by: 02

See spec, "Combining and timing".

## Acceptance

- When a Layer crossfades, pan/tilt interpolates over the Scene's `fadeIn`, from the aim shown at activation to the new one. The interpolation uses degrees, not raw DMX, so coarse/fine stay consistent.
- The new aim's pan solution is the one nearest the pan shown at activation (no long swings). Playback keeps what it needs for this, since resolution alone has no history.
- A mover whose resolved intensity is 0 at activation snaps to its new aim at once.
- Clearing a Layer drops its aims at once. Movers fall back to the next Layer's aim or the Default Direction, without a fade.
- Tests: fade midpoint, nearest pan across a 540° range, snap when dark, Flash release restoring the previous aim.

## Comments

### 2026-10-08: implemented

- `src/engine/scene-resolution.ts`: `ActiveScene.shown` holds what each moving Fixture showed at activation, by Fixture id: `ShownAim` (pan and tilt in channel degrees, the Direction resolved then, and `dark`). `activate` now takes the Venue Patch and the Grand Master to record it.
- The latest activation that changed a Fixture's Direction times its move. That is the latest entry whose `shown.direction` differs from the Direction now resolved. Its `shown` pan goes to `aimAt` as `currentPan`. Pan and tilt then interpolate in degrees over its Scene's `fadeIn`, so coarse and fine stay consistent. This applies on a clear Layer too.
- With no such activation, the pan nearest the latest activation's `shown` pan is used, or else the range centre. The Default Direction therefore keeps the pan shown too.
- A crossfading Layer no longer holds the old Direction until the fade ends. The new Scene's Direction, or else the next Layer's or the Default Direction, applies from activation, and the Fixture moves there over the fade.
- Dark means resolved intensity 0 at activation, after the Grand Master. Blackout at activation therefore snaps.
- A cleared Layer's entry, and its `shown`, are gone. The next Layer's aim applies at once, with that Layer's own `shown` pan.
- A Flash release puts back the previous entry with its `shown`. The same solution returns at once.
- `src/shared/aim.ts`: `aimDmx(channels, { pan, tilt })` sets DMX from channel degrees. `aimAt` uses it. New type `AimAngles`.
- `src/engine/playback.ts`: `go()` activates with the Venue Patch and the resolved Grand Master. The Base Look activates over all Layers, so its move starts from what was shown, and then keeps only its own Layer.
- Tests:
  - `scene-resolution.test.ts`: fade midpoint in degrees; nearest pan across 540° (Cross → Out picks 162°, not -18°); range centre without history; snap when dark; snap at Grand Master 0; clear back to the next Layer.
  - `playback.test.ts` (new): the move through Playback; Flash release restoring the previous aim.
  - `aim.test.ts`: `aimDmx`.
- Changed behaviour: Down after Cross now keeps the shown pan, since pan does not change Down. A test was updated for this.
- Review follow-up: the jump at the end of a crossfade into a Scene with no Direction is now a move. The Default Direction keeps the pan shown. Tests: "moves to the Direction left when a Layer crossfades into a Scene without one", "keeps the pan shown at the Default Direction".
- `npm run check` green. Not tried in the running app or on a real rig.
- Open gaps found in review, not fixed:
  - A clear is not an activation, so nothing is recorded at the clear. The pan after a clear comes from the latest activation left. If another Layer is mid-fade and its activation recorded a different Direction, the fallback moves over that fade instead of snapping.
  - Blackout at activation counts as dark, so the Fixture snaps. The spec does not say either way.
  - `shown` is in channel degrees from the Venue Patch at activation. If position, Mounting or Profile change during a fade, the move starts from stale degrees.
