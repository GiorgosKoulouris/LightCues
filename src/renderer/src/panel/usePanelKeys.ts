import { useEffect } from 'react';
import type { Show } from '../../../shared/show';
import type { PlaybackState } from '../show/usePlayback';
import { isTextEntry, panelAction, type PanelAction } from './shortcuts';

// Runs the Fallback Panel's keys from any view, except while typing in a text
// field. Separate from the strip, so they still work while it is hidden.
export function usePanelKeys(show: Show | undefined, playback: PlaybackState | undefined): void {
  useEffect(() => {
    if (!show || !playback) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTextEntry(event.target as HTMLElement | null)) return;
      const action = panelAction(event);
      if (!action) return;
      // Keeps a focused list or slider from also taking the key.
      event.preventDefault();
      runPanelAction(action, show, playback);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [show, playback]);
}

export function runPanelAction(action: PanelAction, show: Show, playback: PlaybackState): void {
  switch (action.type) {
    case 'blackout':
      window.engine.send({ type: 'setBlackout', on: !playback.blackout });
      break;
    case 'baseLook':
      window.engine.send({ type: 'goBaseLook' });
      break;
    case 'tapTempo':
      window.engine.send({ type: 'tapTempo' });
      break;
    case 'freeze':
      window.engine.send({ type: 'setFreeze', on: !playback.freeze });
      break;
    case 'scene': {
      const sceneId = show.panelScenes?.[action.index];
      if (sceneId !== undefined) window.engine.send({ type: 'goScene', sceneId });
      break;
    }
    case 'grandMaster': {
      // Rounded, so steps land on whole percentages.
      const level = Math.round((playback.grandMaster + action.step) * 100) / 100;
      window.engine.send({ type: 'setGrandMaster', level });
      break;
    }
  }
}
