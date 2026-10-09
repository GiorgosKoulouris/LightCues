import { describe, expect, it } from 'vitest';
import { createStateRequests } from './state-requests';

describe('createStateRequests', () => {
  it('keeps the last state request of each kind, and no other commands', () => {
    const requests = createStateRequests();

    requests.sent({ type: 'getShow' });
    requests.sent({ type: 'setBlackout', on: true });
    requests.sent({ type: 'getVenue' });
    requests.sent({ type: 'getShow' });
    requests.sent({ type: 'tapTempo' });

    expect(requests.all()).toEqual([{ type: 'getShow' }, { type: 'getVenue' }]);
  });

  it('keeps the last of a preview start or stop', () => {
    const requests = createStateRequests();

    requests.sent({ type: 'startPreview' });
    requests.sent({ type: 'stopPreview' });
    expect(requests.all()).toEqual([{ type: 'stopPreview' }]);

    requests.sent({ type: 'startPreview' });
    expect(requests.all()).toEqual([{ type: 'startPreview' }]);
  });
});
