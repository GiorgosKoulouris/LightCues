import { describe, expect, it } from 'vitest';
import type { EngineEvent } from '../shared/protocol';
import { emptyShow } from '../shared/show';
import { createEngine } from './engine';
import { saveShowFile } from './show-file';

// An engine over in-memory files and recent-files storage. Creating a second
// engine over the same maps is the next launch.
function launch(files: Map<string, string>, recent: { json?: string }) {
  const events: EngineEvent[] = [];
  let failing = false;
  const diskFiles = {
    read(path: string) {
      const json = files.get(path);
      if (json === undefined) throw new Error('File not found');
      return json;
    },
    write(path: string, json: string) {
      if (failing) throw new Error('Disk full');
      files.set(path, json);
    },
  };
  const engine = createEngine({
    emit: (e) => events.push(e),
    venueFiles: diskFiles,
    showFiles: diskFiles,
    libraryFiles: diskFiles,
    recentFilesStorage: {
      read: () => recent.json,
      write: (json) => void (recent.json = json),
    },
  });
  let nextRequestId = 1;

  // Grants the path first, as main does after a file dialog.
  function run(command: 'openVenue' | 'saveVenue' | 'openShow' | 'saveShow', path: string) {
    engine.grantPath(path);
    engine.handle({ type: command, requestId: nextRequestId++, path });
  }

  return {
    engine,
    events,
    run,
    venue() {
      engine.handle({ type: 'getVenue' });
      const venue = events.findLast((e) => e.type === 'venue');
      if (venue?.type !== 'venue') throw new Error('No venue event');
      return venue;
    },
    show() {
      engine.handle({ type: 'getShow' });
      const show = events.findLast((e) => e.type === 'show');
      if (show?.type !== 'show') throw new Error('No show event');
      return show;
    },
    venuePath() {
      return this.venue().path;
    },
    showPath() {
      return this.show().path;
    },
    profilesFolder() {
      engine.handle({ type: 'listProfiles' });
      const profiles = events.findLast((e) => e.type === 'profiles');
      if (profiles?.type !== 'profiles') throw new Error('No profiles event');
      return profiles.folder;
    },
    failWrites() {
      failing = true;
    },
    reopenErrors() {
      engine.handle({ type: 'getReopenErrors' });
      const reply = events.findLast((e) => e.type === 'reopenErrors');
      return reply?.type === 'reopenErrors' ? reply.errors : undefined;
    },
  };
}

describe('engine recent files', () => {
  it('reopens the Venue Patch and Show last opened or saved', () => {
    const files = new Map<string, string>();
    const recent = {};
    const first = launch(files, recent);
    first.run('saveVenue', 'C:/gigs/club.lcvenue');
    first.run('saveShow', 'C:/shows/tour.lcshow');
    first.run('openVenue', 'C:/gigs/club.lcvenue');

    const next = launch(files, recent);

    expect(next.venuePath()).toBe('C:/gigs/club.lcvenue');
    expect(next.showPath()).toBe('C:/shows/tour.lcshow');
    expect(next.reopenErrors()).toEqual([]);
  });

  it('starts empty when nothing was opened or saved', () => {
    const next = launch(new Map(), {});

    expect(next.venuePath()).toBeUndefined();
    expect(next.showPath()).toBeUndefined();
    expect(next.reopenErrors()).toEqual([]);
  });

  it('reopens each document on its own', () => {
    const files = new Map<string, string>();
    const recent = {};
    launch(files, recent).run('saveShow', 'tour.lcshow');

    const next = launch(files, recent);

    expect(next.venuePath()).toBeUndefined();
    expect(next.showPath()).toBe('tour.lcshow');
  });

  it('forgets a document replaced by New', () => {
    const files = new Map<string, string>();
    const recent = {};
    const first = launch(files, recent);
    first.run('saveVenue', 'club.lcvenue');
    first.run('saveShow', 'tour.lcshow');
    first.engine.handle({ type: 'newVenue' });

    const next = launch(files, recent);

    expect(next.venuePath()).toBeUndefined();
    expect(next.showPath()).toBe('tour.lcshow');
  });

  it('does not remember a file that failed to open', () => {
    const files = new Map<string, string>();
    const recent = {};
    const first = launch(files, recent);
    first.run('saveVenue', 'club.lcvenue');
    first.run('openVenue', 'missing.lcvenue');

    expect(launch(files, recent).venuePath()).toBe('club.lcvenue');
  });

  it('reports a missing or invalid file once, starts that document empty and forgets it', () => {
    const files = new Map<string, string>();
    const recent = {};
    const first = launch(files, recent);
    first.run('saveVenue', 'club.lcvenue');
    first.run('saveShow', 'tour.lcshow');
    files.delete('club.lcvenue');
    files.set('tour.lcshow', '{"version": 99}');

    const next = launch(files, recent);

    expect(next.reopenErrors()).toEqual([
      'The last Venue Patch was not reopened. Could not open club.lcvenue: File not found',
      'The last Show was not reopened. Could not open tour.lcshow: Unsupported Show version: 99',
    ]);
    expect(next.reopenErrors()).toEqual([]);
    expect(next.venuePath()).toBeUndefined();
    expect(next.showPath()).toBeUndefined();

    files.set('club.lcvenue', files.get('tour.lcshow')!);
    expect(launch(files, recent).venuePath()).toBeUndefined();
  });

  it('reopens without activating a Scene', () => {
    const files = new Map([['tour.lcshow', saveShowFile(emptyShow())]]);
    const recent = {};
    launch(files, recent).run('openShow', 'tour.lcshow');

    const next = launch(files, recent);
    next.engine.handle({ type: 'getPlayback' });

    expect(next.events.findLast((e) => e.type === 'playback')).toMatchObject({ active: {} });
  });

  it('starts empty when the saved recent files are unreadable', () => {
    const next = launch(new Map(), { json: 'not json' });

    expect(next.venuePath()).toBeUndefined();
    expect(next.reopenErrors()).toEqual([]);
  });
});

describe('engine recent folders', () => {
  it('sends the folder of the last file opened or saved, per document', () => {
    const files = new Map<string, string>();
    const first = launch(files, {});
    expect(first.venue().folder).toBeUndefined();

    first.run('saveVenue', 'C:/gigs/club.lcvenue');
    first.run('saveShow', 'C:/shows/tour.lcshow');

    expect(first.venue().folder).toBe('C:/gigs');
    expect(first.show().folder).toBe('C:/shows');
  });

  it('keeps the folder between launches, after New and after a failed reopen', () => {
    const files = new Map<string, string>();
    const recent = {};
    const first = launch(files, recent);
    first.run('saveVenue', 'C:/gigs/club.lcvenue');
    first.run('saveShow', 'C:/shows/tour.lcshow');
    first.engine.handle({ type: 'newShow' });
    files.delete('C:/gigs/club.lcvenue');

    const next = launch(files, recent);

    expect(next.venue()).toMatchObject({ folder: 'C:/gigs' });
    expect(next.venue().path).toBeUndefined();
    expect(next.show()).toMatchObject({ folder: 'C:/shows' });
    expect(launch(files, recent).venue().folder).toBe('C:/gigs');
  });
});

describe('engine library folder', () => {
  it('sends the folder of the last library export with the Profiles, kept between launches', () => {
    const files = new Map<string, string>();
    const recent = {};
    const first = launch(files, recent);
    expect(first.profilesFolder()).toBeUndefined();

    first.engine.grantPath('C:/backup/Profiles.lclibrary');
    first.engine.handle({
      type: 'exportLibrary',
      requestId: 1,
      path: 'C:/backup/Profiles.lclibrary',
    });

    expect(first.profilesFolder()).toBe('C:/backup');
    expect(launch(files, recent).profilesFolder()).toBe('C:/backup');
  });

  it('keeps the folder when an export fails', () => {
    const files = new Map<string, string>();
    const recent = {};
    const first = launch(files, recent);
    first.engine.grantPath('C:/backup/Profiles.lclibrary');
    first.engine.handle({
      type: 'exportLibrary',
      requestId: 1,
      path: 'C:/backup/Profiles.lclibrary',
    });
    first.failWrites();
    first.engine.grantPath('D:/full/Profiles.lclibrary');
    first.engine.handle({
      type: 'exportLibrary',
      requestId: 2,
      path: 'D:/full/Profiles.lclibrary',
    });

    expect(first.profilesFolder()).toBe('C:/backup');
  });
});

describe('engine examples', () => {
  it('opens an example as new: no path, not remembered, Save asks where', () => {
    const files = new Map<string, string>();
    const recent = {};
    const first = launch(files, recent);
    first.run('saveVenue', 'C:/gigs/club.lcvenue');
    first.run('saveShow', 'C:/shows/tour.lcshow');
    const examples = 'C:/LightCues/resources/examples/demo';
    files.set(`${examples}.lcvenue`, files.get('C:/gigs/club.lcvenue')!);
    files.set(`${examples}.lcshow`, files.get('C:/shows/tour.lcshow')!);
    for (const [type, path] of [
      ['openVenue', `${examples}.lcvenue`],
      ['openShow', `${examples}.lcshow`],
    ] as const) {
      first.engine.grantPath(path);
      first.engine.handle({ type, requestId: 100, path, asNew: true });
    }

    expect(first.venue()).toMatchObject({ unsaved: false, canUndo: false });
    expect(first.venuePath()).toBeUndefined();
    expect(first.showPath()).toBeUndefined();
    first.engine.handle({ type: 'saveShow', requestId: 101 });
    expect(first.events.findLast((e) => e.type === 'showDone')).toMatchObject({
      errors: ['Choose a file to save the Show to'],
    });

    const next = launch(files, recent);
    expect(next.venuePath()).toBeUndefined();
    expect(next.showPath()).toBeUndefined();
  });
});
