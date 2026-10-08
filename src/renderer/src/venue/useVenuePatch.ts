import { useCallback, useEffect, useState } from 'react';
import type { EngineEvent, VenueEdit } from '../../../shared/protocol';
import { request } from '../engine-request';

export type VenueState = Omit<Extract<EngineEvent, { type: 'venue' }>, 'type'>;

// The engine's current Venue Patch, kept in step through engine events.
// Changes resolve to the engine's errors; an empty list means done.
export function useVenuePatch() {
  const [venue, setVenue] = useState<VenueState>();

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type !== 'venue') return;
      const { patch, path, folder, unsaved, canUndo, canRedo } = event;
      setVenue({ patch, path, folder, unsaved, canUndo, canRedo });
    });
    window.engine.send({ type: 'getVenue' });
    return unsubscribe;
  }, []);

  const edit = useCallback(
    (change: VenueEdit) =>
      venueRequest((requestId) =>
        window.engine.send({ type: 'editVenue', requestId, edit: change }),
      ),
    [],
  );

  const newVenue = useCallback(() => window.engine.send({ type: 'newVenue' }), []);
  const undo = useCallback(() => window.engine.send({ type: 'undoVenue' }), []);
  const redo = useCallback(() => window.engine.send({ type: 'redoVenue' }), []);

  // Resolves to undefined when the user cancels the dialog.
  const open = useCallback(async (): Promise<string[] | undefined> => {
    const path = await window.dialogs.chooseVenueToOpen(venue?.folder);
    if (path === undefined) return undefined;
    return venueRequest((requestId) => window.engine.send({ type: 'openVenue', requestId, path }));
  }, [venue?.folder]);

  // Saves in place, or asks for a file when there is none or `as` is set.
  const save = useCallback(
    async ({ as = false } = {}): Promise<string[] | undefined> => {
      let path = venue?.path;
      if (as || path === undefined) {
        path = await window.dialogs.chooseVenueToSave(path, venue?.folder);
        if (path === undefined) return undefined;
      }
      const to = path;
      return venueRequest((requestId) =>
        window.engine.send({ type: 'saveVenue', requestId, path: to }),
      );
    },
    [venue?.path, venue?.folder],
  );

  return { venue, edit, newVenue, undo, redo, open, save };
}

async function venueRequest(send: (requestId: number) => void): Promise<string[]> {
  const reply = await request(send);
  if (reply.type !== 'venueDone') throw new Error(`Unexpected engine reply: ${reply.type}`);
  return reply.errors;
}
