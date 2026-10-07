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
      if (event.type === 'show')
        setShow({ show: event.show, path: event.path, unsaved: event.unsaved });
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

  // Resolves to undefined when the user cancels the dialog.
  const open = useCallback(async (): Promise<string[] | undefined> => {
    const path = await window.dialogs.chooseShowToOpen();
    if (path === undefined) return undefined;
    return showRequest((requestId) => window.engine.send({ type: 'openShow', requestId, path }));
  }, []);

  // Saves in place, or asks for a file when there is none or `as` is set.
  const save = useCallback(
    async ({ as = false } = {}): Promise<string[] | undefined> => {
      let path = show?.path;
      if (as || path === undefined) {
        path = await window.dialogs.chooseShowToSave(path);
        if (path === undefined) return undefined;
      }
      const to = path;
      return showRequest((requestId) =>
        window.engine.send({ type: 'saveShow', requestId, path: to }),
      );
    },
    [show?.path],
  );

  return { show, edit, newShow, open, save };
}

async function showRequest(send: (requestId: number) => void): Promise<string[]> {
  const reply = await request(send);
  if (reply.type !== 'showDone') throw new Error(`Unexpected engine reply: ${reply.type}`);
  return reply.errors;
}
