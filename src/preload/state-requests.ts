import { STATE_REQUESTS, type EngineCommand } from '../shared/protocol';

// The state requests the renderer sent: the last of each kind, the last
// preview start or stop, and the last house look preview. A restarted engine
// gets them again, so every view hears its state from it.
export function createStateRequests() {
  const requested = new Map<string, EngineCommand>();
  return {
    sent(command: EngineCommand): void {
      if (command.type === 'startPreview' || command.type === 'stopPreview') {
        requested.set('preview', command);
      } else if (command.type === 'previewHouseLook' || STATE_REQUESTS.includes(command.type)) {
        requested.set(command.type, command);
      }
    },
    all: (): EngineCommand[] => [...requested.values()],
  };
}
