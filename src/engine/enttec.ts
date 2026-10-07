import { DMX_CHANNELS } from '../shared/venue-patch';

// The Enttec DMX USB Pro serial protocol, also spoken by DMXking ultraDMX
// devices. A message is 0x7E, a label, the data length (LSB first), the data
// and 0xE7.

const START = 0x7e;
const END = 0xe7;
// Output Only Send DMX Packet Request.
const SEND_DMX = 6;
// The null start code of a normal DMX packet.
const DMX_START_CODE = 0;

const MIN_CHANNELS = 24;

// A label 6 message sending `channels` (channel 1 first) out of the DMX port.
// Fewer than 24 channels are padded with zeros, as the device requires.
export function encodeSendDmx(channels: Uint8Array): Uint8Array {
  if (channels.length > DMX_CHANNELS) {
    throw new Error(`A DMX packet holds at most ${DMX_CHANNELS} channels, not ${channels.length}`);
  }
  const length = 1 + Math.max(channels.length, MIN_CHANNELS);
  const message = new Uint8Array(4 + length + 1);
  message.set([START, SEND_DMX, length & 0xff, length >> 8, DMX_START_CODE]);
  message.set(channels, 5);
  message[message.length - 1] = END;
  return message;
}
