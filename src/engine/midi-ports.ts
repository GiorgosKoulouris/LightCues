import { Input } from '@julusian/midi';
import type { MidiPorts } from './midi-input';

// The machine's MIDI input ports, through the `@julusian/midi` package
// (RtMidi). Passes notes and MIDI Clock. rtpMIDI sessions appear as normal ports.
export const nodeMidiPorts: MidiPorts = {
  list: () => Input.getPortNames(),
  open(name, onMessage) {
    const input = new Input();
    // Keeps MIDI Clock, which RtMidi drops by default.
    input.ignoreTypes(true, false, true);
    input.on('message', (_deltaTime, message) => onMessage(message));
    input.openPortByName(name);
    if (!input.isPortOpen()) {
      input.destroy();
      throw new Error(`MIDI input "${name}" did not open`);
    }
    return {
      close() {
        input.closePort();
        input.destroy();
      },
    };
  },
};
