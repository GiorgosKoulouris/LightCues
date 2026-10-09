# Smaller Perform Scene buttons

Status: resolved

See spec, "Perform Scene buttons".

## Acceptance

- Perform Scene buttons are at least 160 px wide and 52 px tall, with lg text. Long names still wrap over two lines rather than being cut.
- Blackout, Base Look, Grand Master, Tap Tempo and Freeze keep their current size.
- The active state stays glanceable: filled as well as outlined.
- Each Layer header keeps a Clear button, made small (`md`) to match.
- Check by eye in the running app with many Scenes on one Layer.

## Comments

### 2026-10-09: implemented (agent)

- `PerformView.module.css`: new `--scene-width: 160px` and `--scene-height: 52px`. Scene buttons use `min-height: var(--scene-height)`. The `--text-xl` override is gone, so the `lg` Button sets `--text-lg`. Wrapping (`white-space: normal`, `overflow-wrap: anywhere`) and the filled active state are unchanged.
- The top controls still use `--perform-height` (64 px) and `--text-xl`. Their size is unchanged.
- `PerformView`: the Layer header's Clear is now `md`. `ClearLayerButton` loses its `size` prop. Nothing else passed it.

Tests: none added. jsdom does no layout, so there is no seam for sizes. The existing Perform tests cover Clear. Typecheck, lint, format and the full suite (625 tests) pass.

Review (standards and spec): no violations. Three stale comments were fixed.

Not checked: the running app. Electron can't run in the dev container. Left for a human:
- Many Scenes on one Layer: buttons are 160 × 52 px or larger, and long names wrap.
- An active Scene reads as filled and outlined, including under hover. `.secondary:hover` and `.scenes .scene[aria-pressed='true']` have equal specificity, so the fill depends on CSS load order. Button's CSS loads first today.
- The small Clear sits well beside the `lg` Layer heading.

Set to `resolved` once this is checked.
