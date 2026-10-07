import type { EngineCommand, EngineEvent, ShowEdit } from '../shared/protocol';
import {
  emptyShow,
  putLayer,
  putScene,
  removeLayer,
  removeScene,
  setBaseLook,
  type Show,
  type ShowResult,
} from '../shared/show';
import { loadShowFile, saveShowFile } from './show-file';

export type ShowCommand = Extract<
  EngineCommand,
  { type: 'getShow' | 'newShow' | 'openShow' | 'saveShow' | 'editShow' }
>;

// Reads and writes .lcshow files by path. Both throw on failure.
export interface ShowFiles {
  read(path: string): string;
  write(path: string, json: string): void;
}

export interface ShowSessionOptions {
  emit: (event: EngineEvent) => void;
  files?: ShowFiles;
  // Called after an edit changed the Show.
  edited?: () => void;
  // Called after the Show is replaced by a new or opened one.
  replaced?: () => void;
}

// The engine's current Show.
export function createShowSession({ emit, files, edited, replaced }: ShowSessionOptions) {
  let show: Show = emptyShow();
  // The file the Show was opened from or last saved to.
  let path: string | undefined;
  let unsaved = false;

  function emitShow(): void {
    emit({ type: 'show', show, ...(path === undefined ? {} : { path }), unsaved });
  }

  function open(from: string): string[] {
    if (!files) return ['Show files are not available'];
    try {
      show = loadShowFile(files.read(from));
    } catch (error) {
      return [`Could not open ${from}: ${(error as Error).message}`];
    }
    path = from;
    unsaved = false;
    emitShow();
    replaced?.();
    return [];
  }

  function save(to = path): string[] {
    if (!files) return ['Show files are not available'];
    if (to === undefined) return ['Choose a file to save the Show to'];
    try {
      files.write(to, saveShowFile(show));
    } catch (error) {
      return [`Could not save ${to}: ${(error as Error).message}`];
    }
    path = to;
    unsaved = false;
    emitShow();
    return [];
  }

  function edit(change: ShowEdit): ShowResult {
    switch (change.type) {
      case 'putScene':
        return putScene(show, change.scene);
      case 'removeScene':
        if (!show.scenes.some((s) => s.id === change.id)) {
          return { errors: [`Scene id "${change.id}" is not in the Show`] };
        }
        return { show: removeScene(show, change.id) };
      case 'putLayer':
        return putLayer(show, change.layer);
      case 'removeLayer':
        if (!show.layers.some((l) => l.id === change.id)) {
          return { errors: [`Layer id "${change.id}" is not in the Show`] };
        }
        return { show: removeLayer(show, change.id) };
      case 'setBaseLook':
        return setBaseLook(show, change.sceneId);
    }
  }

  return {
    show: () => show,
    handle(command: ShowCommand): void {
      switch (command.type) {
        case 'getShow':
          emitShow();
          break;
        case 'newShow':
          show = emptyShow();
          path = undefined;
          unsaved = false;
          emitShow();
          replaced?.();
          break;
        case 'openShow':
          emit({ type: 'showDone', requestId: command.requestId, errors: open(command.path) });
          break;
        case 'saveShow':
          emit({ type: 'showDone', requestId: command.requestId, errors: save(command.path) });
          break;
        case 'editShow': {
          const result = edit(command.edit);
          if ('show' in result) {
            show = result.show;
            unsaved = true;
            emitShow();
            edited?.();
          }
          const errors = 'errors' in result ? result.errors : [];
          emit({ type: 'showDone', requestId: command.requestId, errors });
          break;
        }
      }
    },
  };
}
