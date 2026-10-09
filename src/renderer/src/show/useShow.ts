import { useCallback, useEffect, useState } from 'react';
import type { EngineEvent, ShowEdit } from '../../../shared/protocol';
import { request } from '../engine-request';

export type ShowState = Omit<Extract<EngineEvent, { type: 'show' }>, 'type'>;

// The engine's current Show, kept in step through engine events. Changes
// resolve to the engine's errors; an empty list means done.
export function useShow() {
  const [show, setShow] = useState<ShowState>();

  useEffect(() => {
    const unsubscribe = window.engine.onEvent((event) => {
      if (event.type !== 'show') return;
      const { show, path, folder, unsaved, canUndo, canRedo } = event;
      setShow({ show, path, folder, unsaved, canUndo, canRedo });
    });
    window.engine.send({ type: 'getShow' });
    return unsubscribe;
  }, []);

  const edit = useCallback(
    (change: ShowEdit) =>
      showRequest((requestId) => window.engine.send({ type: 'editShow', requestId, edit: change })),
    [],
  );

  const newShow = useCallback(() => window.engine.send({ type: 'newShow' }), []);
  const undo = useCallback(() => window.engine.send({ type: 'undoShow' }), []);
  const redo = useCallback(() => window.engine.send({ type: 'redoShow' }), []);

  // Resolves to undefined when the user cancels the dialog.
  const open = useCallback(async (): Promise<string[] | undefined> => {
    const path = await window.dialogs.chooseShowToOpen(show?.folder);
    if (path === undefined) return undefined;
    return showRequest((requestId) => window.engine.send({ type: 'openShow', requestId, path }));
  }, [show?.folder]);

  // Opens a granted file as a new, unsaved Show, as for the example.
  const openAsNew = useCallback(
    (path: string) =>
      showRequest((requestId) =>
        window.engine.send({ type: 'openShow', requestId, path, asNew: true }),
      ),
    [],
  );

  // Saves in place, or asks for a file when there is none or `as` is set.
  const save = useCallback(
    async ({ as = false } = {}): Promise<string[] | undefined> => {
      let path = show?.path;
      if (as || path === undefined) {
        path = await window.dialogs.chooseShowToSave(path, show?.folder);
        if (path === undefined) return undefined;
      }
      const to = path;
      return showRequest((requestId) =>
        window.engine.send({ type: 'saveShow', requestId, path: to }),
      );
    },
    [show?.path, show?.folder],
  );

  return { show, edit, newShow, undo, redo, open, openAsNew, save };
}

async function showRequest(send: (requestId: number) => void): Promise<string[]> {
  const reply = await request(send);
  if (reply.type !== 'showDone') throw new Error(`Unexpected engine reply: ${reply.type}`);
  return reply.errors;
}
