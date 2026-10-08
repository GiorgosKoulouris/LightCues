# Plain CSS tokens and Radix primitives, dark only

The renderer is styled with plain CSS: design tokens as custom properties, one CSS module per component. Radix primitives are used only for widgets that are hard to get right (Dialog, Popover, Menu, Tooltip). The theme is dark only, because the app is used in dark venues where a bright screen ruins night vision and shows from the stage. Tokens keep a light theme possible later. Fonts and icons are bundled, because the app must work offline.

## Considered Options

- Tailwind: fast to write, but adds a build layer and long class strings for little gain in a small, single-theme app.
- Full component library (Mantine, MUI): visual lock-in and heavy restyling to reach a dark, low-glare look.
