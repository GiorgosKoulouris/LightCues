# Direct tests for Profile validation

Status: ready-for-agent

See spec.

## Problem

`src/engine/validate-profile.ts` checks Profiles from the Profile Editor, OFL and GDTF imports, library import files and Venue Patch files. These can come from strangers. It is tested only through the callers.

## Fix

`src/engine/validate-profile.test.ts` (new). Cover:

- A minimal valid Profile passes. Each required field missing fails with an error that names the field.
- Wrong types for every field: string for number, object for array, `null` everywhere, extra unknown fields (pass or fail, whatever the code does now, stated in the test).
- Modes: empty mode, duplicate channel names, channel count over 512, overlapping fine channels, a Cell channel name that breaks the `"<name> (Cell N)"` pattern.
- Numbers: negative, `NaN`, `Infinity`, non-integers where an integer is expected, pan/tilt ranges of 0 or negative.
- Strings: very long names (e.g. 1 MB), control characters. No crash, a clear error or a pass.
- Objects that try `__proto__`, `constructor` and `prototype` keys: no pollution of `Object.prototype` after validation.

If a test finds a bug, fix it in the same issue and say so in the comments.

## Acceptance

- Coverage of `validate-profile.ts` before and after, in the comments.
- `npm run check` passes.
