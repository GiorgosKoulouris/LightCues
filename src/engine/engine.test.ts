import { describe, expect, it } from 'vitest';
import type { FixtureProfile } from '../shared/fixture-profile';
import type { EngineCommand, EngineEvent, VenueEdit } from '../shared/protocol';
import { fixtureZone, type PatchedFixture, type VenuePatch } from '../shared/venue-patch';
import { createEngine } from './engine';

describe('engine', () => {
  it('replies to a ping with a pong carrying the same id', () => {
    const events: EngineEvent[] = [];
    let now = 1000;
    const engine = createEngine({ emit: (e) => events.push(e), now: () => now });

    now = 1250;
    engine.handle({ type: 'ping', id: 7 });

    expect(events).toEqual([{ type: 'pong', id: 7, uptimeMs: 250 }]);
  });
});

const dimmer: FixtureProfile = {
  id: 'acme/dimmer',
  manufacturer: 'Acme',
  model: 'Dimmer',
  defaultRole: 'Wash',
  modes: [
    {
      name: '1ch',
      channels: [
        {
          kind: 'control',
          name: 'Dimmer',
          defaultValue: 0,
          ranges: [{ from: 0, to: 255, capability: { type: 'intensity' } }],
        },
      ],
    },
  ],
};

function fixture(overrides: Partial<PatchedFixture> = {}): PatchedFixture {
  return {
    id: 'f1',
    name: 'Dimmer 1',
    profileId: 'acme/dimmer',
    mode: '1ch',
    universe: 1,
    address: 1,
    x: 0,
    y: 1,
    height: 0,
    ...overrides,
  };
}

// An engine whose Profile Library holds `dimmer`.
// `files` stands in for the disk, by path.
function venueEngine(files = new Map<string, string>()) {
  const events: EngineEvent[] = [];
  const venueFiles = {
    read(path: string) {
      const json = files.get(path);
      if (json === undefined) throw new Error(`ENOENT: ${path}`);
      return json;
    },
    write: (path: string, json: string) => void files.set(path, json),
  };
  const engine = createEngine({ emit: (e) => events.push(e), venueFiles });
  engine.handle({ type: 'saveProfile', requestId: 0, profile: dimmer });
  let nextRequestId = 1;

  // Sends a command and returns the engine's reply to it.
  function request(command: (requestId: number) => EngineCommand): string[] {
    const requestId = nextRequestId++;
    engine.handle(command(requestId));
    const reply = events.find((e) => e.type === 'venueDone' && e.requestId === requestId);
    if (reply?.type !== 'venueDone') throw new Error('No reply');
    return reply.errors;
  }

  return {
    edit: (edit: VenueEdit) => request((requestId) => ({ type: 'editVenue', requestId, edit })),
    save: (path?: string) => request((requestId) => ({ type: 'saveVenue', requestId, path })),
    open: (path: string) => request((requestId) => ({ type: 'openVenue', requestId, path })),
    // The last Venue Patch state the engine sent.
    venue() {
      const venue = events.findLast((e) => e.type === 'venue');
      if (venue?.type !== 'venue') throw new Error('No venue event');
      return venue;
    },
    patch: (): VenuePatch => {
      engine.handle({ type: 'getVenue' });
      const venue = events.findLast((e) => e.type === 'venue');
      if (venue?.type !== 'venue') throw new Error('No venue event');
      return venue.patch;
    },
    engine,
    events,
    request,
  };
}

describe('engine Venue Patch', () => {
  it('starts with an empty patch that is not saved to a file', () => {
    const events: EngineEvent[] = [];
    const engine = createEngine({ emit: (e) => events.push(e) });

    engine.handle({ type: 'getVenue' });

    expect(events).toEqual([
      {
        type: 'venue',
        patch: {
          stage: { width: 10, depth: 8 },
          universes: [{ number: 1 }],
          fixtures: [],
          profiles: [],
        },
        unsaved: false,
      },
    ]);
  });

  it('patches a Fixture with a copy of its Profile from the library', () => {
    const { edit, venue } = venueEngine();

    expect(edit({ type: 'putFixture', fixture: fixture() })).toEqual([]);

    expect(venue().patch.fixtures).toEqual([fixture()]);
    expect(venue().patch.profiles).toEqual([dimmer]);
    expect(venue().unsaved).toBe(true);
  });

  it('rejects an edit that leaves the patch invalid, without changing it', () => {
    const { edit, patch, events } = venueEngine();
    edit({ type: 'putFixture', fixture: fixture() });
    const before = patch();
    const sent = events.length;

    expect(edit({ type: 'putFixture', fixture: fixture({ id: 'f2', name: 'Dimmer 2' }) })).toEqual([
      '"Dimmer 2" (1.1–1.1) overlaps "Dimmer 1" (1.1–1.1)',
    ]);
    expect(events.slice(sent).some((e) => e.type === 'venue')).toBe(false);
    expect(patch()).toEqual(before);
  });

  it('rejects a Fixture whose Profile is in neither the patch nor the library', () => {
    const { edit } = venueEngine();

    expect(edit({ type: 'putFixture', fixture: fixture({ profileId: 'acme/gone' }) })).toEqual([
      '"Dimmer 1": Profile "acme/gone" is not in the patch',
    ]);
  });

  it('moves a Fixture, and its suggested Zone follows', () => {
    const { edit, patch } = venueEngine();
    edit({ type: 'putFixture', fixture: fixture({ x: 0, y: 1 }) });

    expect(edit({ type: 'moveFixture', id: 'f1', position: { x: -4, y: -1, height: 5 } })).toEqual(
      [],
    );

    const moved = patch();
    expect(fixtureZone(moved, moved.fixtures[0]!)).toEqual({
      row: 'Front',
      column: 'Stage Right',
      level: 'Overhead',
    });
  });

  it('adds a Universe mapped to an Output, and removes it with its Fixtures', () => {
    const { edit, patch } = venueEngine();

    expect(edit({ type: 'putUniverse', universe: { number: 2, output: 'usb-1' } })).toEqual([]);
    edit({ type: 'putFixture', fixture: fixture({ universe: 2 }) });
    expect(patch().universes).toEqual([{ number: 1 }, { number: 2, output: 'usb-1' }]);

    expect(edit({ type: 'removeUniverse', number: 2 })).toEqual([]);
    expect(patch()).toMatchObject({ universes: [{ number: 1 }], fixtures: [], profiles: [] });
  });

  it('sets the stage bounds and removes a Fixture', () => {
    const { edit, patch } = venueEngine();
    edit({ type: 'putFixture', fixture: fixture() });

    expect(edit({ type: 'setStage', stage: { width: 14, depth: 10 } })).toEqual([]);
    expect(edit({ type: 'removeFixture', id: 'f1' })).toEqual([]);

    expect(patch()).toMatchObject({ stage: { width: 14, depth: 10 }, fixtures: [] });
  });

  it('saves the patch to a file that another engine opens, without its library', () => {
    const files = new Map<string, string>();
    const first = venueEngine(files);
    first.edit({ type: 'putFixture', fixture: fixture() });

    expect(first.save('C:/gigs/club.lcvenue')).toEqual([]);
    expect(first.venue()).toMatchObject({ path: 'C:/gigs/club.lcvenue', unsaved: false });

    const events: EngineEvent[] = [];
    const second = createEngine({
      emit: (e) => events.push(e),
      venueFiles: { read: (path) => files.get(path) ?? '', write: () => {} },
    });
    second.handle({ type: 'openVenue', requestId: 1, path: 'C:/gigs/club.lcvenue' });

    expect(events).toEqual([
      { type: 'venue', patch: first.patch(), path: 'C:/gigs/club.lcvenue', unsaved: false },
      { type: 'venueDone', requestId: 1, errors: [] },
    ]);
  });

  it('saves to the file it was opened from when no path is given', () => {
    const files = new Map<string, string>();
    const first = venueEngine(files);
    first.save('club.lcvenue');
    const { open, edit, save, venue } = venueEngine(files);
    open('club.lcvenue');
    edit({ type: 'putFixture', fixture: fixture() });

    expect(save()).toEqual([]);

    expect(venue()).toMatchObject({ path: 'club.lcvenue', unsaved: false });
    expect(JSON.parse(files.get('club.lcvenue')!)).toMatchObject({ fixtures: [fixture()] });
  });

  it('asks for a file when saving a patch that has none', () => {
    expect(venueEngine().save()).toEqual(['Choose a file to save the Venue Patch to']);
  });

  it('keeps the current patch when a file does not open', () => {
    const files = new Map([['bad.lcvenue', '{"version": 99}']]);
    const { open, edit, patch } = venueEngine(files);
    edit({ type: 'putFixture', fixture: fixture() });
    const before = patch();

    expect(open('bad.lcvenue')).toEqual([
      'Could not open bad.lcvenue: Unsupported Venue Patch version: 99',
    ]);
    expect(open('missing.lcvenue')).toEqual([
      'Could not open missing.lcvenue: ENOENT: missing.lcvenue',
    ]);
    expect(patch()).toEqual(before);
  });

  it('starts a new patch, forgetting the file', () => {
    const { engine, edit, save, venue } = venueEngine();
    edit({ type: 'putFixture', fixture: fixture() });
    save('club.lcvenue');

    engine.handle({ type: 'newVenue' });

    expect(venue()).toEqual({
      type: 'venue',
      patch: {
        stage: { width: 10, depth: 8 },
        universes: [{ number: 1 }],
        fixtures: [],
        profiles: [],
      },
      unsaved: false,
    });
  });

  it('rejects removing a Universe or Fixture that is not in the patch, leaving it saved', () => {
    const { edit, venue, engine } = venueEngine();
    engine.handle({ type: 'getVenue' });

    expect(edit({ type: 'removeUniverse', number: 7 })).toEqual(['Universe 7 is not in the patch']);
    expect(edit({ type: 'removeFixture', id: 'nope' })).toEqual([
      'Fixture id "nope" is not in the patch',
    ]);
    expect(venue().unsaved).toBe(false);
  });

  it('adds a Universe by number without replacing one already there', () => {
    const { edit, patch } = venueEngine();
    edit({ type: 'putUniverse', universe: { number: 1, output: 'usb-1' } });

    expect(edit({ type: 'addUniverse', universe: { number: 4 } })).toEqual([]);
    expect(edit({ type: 'addUniverse', universe: { number: 1 } })).toEqual([
      'Universe 1 is already in the patch',
    ]);

    expect(patch().universes).toEqual([{ number: 1, output: 'usb-1' }, { number: 4 }]);
  });
});
