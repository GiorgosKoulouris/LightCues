# Fixture Profile model and OFL import

Status: ready-for-agent
Blocked by: 01

Define the internal Fixture Profile model: manufacturer, model, modes, channels, capabilities (intensity, RGB/RGBW/RGBAW, colour wheel slots, pan/tilt, strobe), default Role. Import Open Fixture Library JSON into an app-level library.

## Acceptance

- Importing OFL fixtures covering dimmer-only, RGB, RGBW, colour wheel and moving head maps capabilities correctly.
- Unsupported OFL features are reported, not silently dropped.
