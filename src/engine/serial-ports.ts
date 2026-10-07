import { SerialPort } from 'serialport';
import type { SerialPorts } from './outputs';

// The DMX USB Pro is a USB device behind a virtual COM port, so the baud rate
// does not set the DMX rate. This is the rate Enttec's examples use.
const BAUD_RATE = 57600;

// The machine's serial ports, through the `serialport` package.
export const nodeSerialPorts: SerialPorts = {
  list: () => SerialPort.list(),
  open(path, onLost) {
    const port = new SerialPort({ path, baudRate: BAUD_RATE, autoOpen: false });
    let closing = false;
    return new Promise((resolve, reject) => {
      port.open((error) => {
        if (error) return reject(error);
        port.on('close', () => {
          if (!closing) onLost();
        });
        // Write errors reach `write`'s callback; this keeps others from
        // crashing the engine.
        port.on('error', (error) => console.error(`Serial port ${path}:`, error));
        resolve({
          write: (data, done) => void port.write(data, (error) => done(error ?? undefined)),
          close() {
            closing = true;
            if (port.isOpen) port.close();
          },
        });
      });
    });
  },
};
