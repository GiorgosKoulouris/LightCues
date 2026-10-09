import type { DocumentSnapshot, EngineCommand, EngineEvent, ShowEdit } from '../shared/protocol';
import {
  emptyShow,
  findTrigger,
  putLayer,
  putScene,
  putTrigger,
  removeLayer,
  removeScene,
  removeTrigger,
  setBaseLook,
  setDefaultColour,
  setDefaultDirection,
  setPanelScenes,
  type Rule,
  type Show,
  type ShowResult,
} from '../shared/show';
import { createHistory } from './history';
import { NOT_CHOSEN } from './path-grants';
import type { RecentFile } from './recent-files';
import { loadShowFile, saveShowFile } from './show-file';

export type ShowCommand = Extract<
  EngineCommand,
  { type: 'getShow' | 'newShow' | 'openShow' | 'saveShow' | 'editShow' | 'undoShow' | 'redoShow' }
>;

// Reads and writes .lcshow files by path. Both throw on failure.
export interface ShowFiles {
  read(path: string): string;
  write(path: string, json: string): void;
}

export interface ShowSessionOptions {
  emit: (event: EngineEvent) => void;
  // Times edits, so quick ones to the same thing undo as one.
  now: () => number;
  files?: ShowFiles;
  // Kept up to date with the file the Show was opened from or last saved to.
  recent?: RecentFile;
  // Whether a path may be read or written. The current file always may: it
  // was granted to be opened or saved.
  granted: (path: string) => boolean;
  // Called after an edit, undo or redo changed the Show.
  edited?: () => void;
  // Called after the Show is replaced by a new or opened one.
  replaced?: () => void;
}

// The engine's current Show.
export function createShowSession({
  emit,
  now,
  files,
  recent,
  granted,
  edited,
  replaced,
}: ShowSessionOptions) {
  const history = createHistory(emptyShow(), { now });
  // The file the Show was opened from or last saved to.
  let path: string | undefined;

  function emitShow(): void {
    emit({
      type: 'show',
      show: history.current(),
      ...(path === undefined ? {} : { path }),
      ...folder(),
      ...history.state(),
    });
  }

  // The folder file dialogs start in, when one is known.
  function folder(): { folder?: string } {
    const known = recent?.folder();
    return known === undefined ? {} : { folder: known };
  }

  function open(from: string): string[] {
    if (!files) return ['Show files are not available'];
    if (!granted(from)) return [`Could not open ${from}: ${NOT_CHOSEN}`];
    try {
      history.reset(loadShowFile(files.read(from)));
    } catch (error) {
      return [`Could not open ${from}: ${(error as Error).message}`];
    }
    path = from;
    recent?.set(path);
    emitShow();
    replaced?.();
    return [];
  }

  function save(to = path): string[] {
    if (!files) return ['Show files are not available'];
    if (to === undefined) return ['Choose a file to save the Show to'];
    if (!granted(to)) return [`Could not save ${to}: ${NOT_CHOSEN}`];
    try {
      files.write(to, saveShowFile(history.current()));
    } catch (error) {
      return [`Could not save ${to}: ${(error as Error).message}`];
    }
    path = to;
    recent?.set(path);
    history.markSaved();
    emitShow();
    return [];
  }

  function edit(change: ShowEdit): ShowResult {
    const show = history.current();
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
      case 'setDefaultColour':
        return setDefaultColour(show, change.colour);
      case 'setDefaultDirection':
        return setDefaultDirection(show, change.direction);
      case 'setPanelScenes':
        return setPanelScenes(show, change.sceneIds);
      case 'putTrigger':
        return putTrigger(show, change.trigger);
      case 'removeTrigger': {
        const { channel, note } = change.note;
        if (!findTrigger(show, change.note)) {
          return { errors: [`No Trigger is mapped to channel ${channel}, note ${note}`] };
        }
        return { show: removeTrigger(show, change.note) };
      }
    }
  }

  // Undo or redo, when there is a step to take.
  function step(taken: boolean): void {
    if (!taken) return;
    emitShow();
    edited?.();
  }

  return {
    show: () => history.current(),
    // Opens a file. An empty list of errors means it opened.
    open,
    snapshot: (): DocumentSnapshot<Show> => ({
      document: history.current(),
      ...(path === undefined ? {} : { path }),
      unsaved: history.state().unsaved,
    }),
    // Brings back the Show of an engine that stopped, without its history.
    restore(snapshot: DocumentSnapshot<Show>): void {
      history.restore(snapshot.document, snapshot.unsaved);
      path = snapshot.path;
      emitShow();
    },
    handle(command: ShowCommand): void {
      switch (command.type) {
        case 'getShow':
          emitShow();
          break;
        case 'newShow':
          history.reset(emptyShow());
          path = undefined;
          recent?.set(undefined);
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
            history.edit(result.show, mergeKey(history.current(), command.edit));
            emitShow();
            edited?.();
          }
          const errors = 'errors' in result ? result.errors : [];
          emit({ type: 'showDone', requestId: command.requestId, errors });
          break;
        }
        case 'undoShow':
          step(history.undo());
          break;
        case 'redoShow':
          step(history.redo());
          break;
      }
    },
  };
}

// What an edit changes, for merging quick edits into one undo step: an
// existing Scene, Layer or Trigger, or the Default Colour. Adding and
// removing never merge, nor do adding, removing or reordering Rules.
function mergeKey(show: Show, change: ShowEdit): string | undefined {
  switch (change.type) {
    case 'putScene': {
      const { id, rules } = change.scene;
      const before = show.scenes.find((s) => s.id === id);
      return before && changesOneRuleAtMost(before.rules, rules) ? `scene ${id}` : undefined;
    }
    case 'putLayer': {
      const { id } = change.layer;
      return show.layers.some((l) => l.id === id) ? `layer ${id}` : undefined;
    }
    case 'putTrigger': {
      const { channel, note } = change.trigger;
      return findTrigger(show, { channel, note }) ? `trigger ${channel} ${note}` : undefined;
    }
    case 'setDefaultColour':
      return 'defaultColour';
    default:
      return undefined;
  }
}

// True when `after` is `before` with at most one Rule edited in place.
function changesOneRuleAtMost(before: Rule[], after: Rule[]): boolean {
  if (before.length !== after.length) return false;
  const changed = after.filter((rule, i) => JSON.stringify(rule) !== JSON.stringify(before[i]));
  return changed.length <= 1;
}
