# Enttec USB Pro protocol output

Status: ready-for-agent
Blocked by: 01

Output driver for the Enttec DMX USB Pro serial protocol (label 6, Output Only Send DMX), also used by DMXking ultraDMX devices. Device discovery, ~40 Hz send loop in the engine process, multiple Outputs at once, reconnect on unplug.

## Acceptance

- Frame encoding is unit-tested against the protocol spec.
- Unplug/replug recovers without restarting the app.

Note: final verification needs real hardware (human).
