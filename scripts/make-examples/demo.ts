// The example Venue Patch and Show in `examples/`, built with the app's own
// models and file format, so they pass the same validation as a saved file.
// `npm run examples` writes them; a test checks the committed files match.
//
// The Profiles are imported from the Open Fixture Library files in `ofl/`
// (MIT, see examples/README.md).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FixtureProfile, Role } from '../../src/shared/fixture-profile';
import type { Colour, RuleTarget, Scene, Show, Swatch, Trigger } from '../../src/shared/show';
import {
  putFixtures,
  type Mounting,
  type PatchedFixture,
  type VenuePatch,
  type Zone,
  type ZoneColumn,
  type ZoneRow,
  VIRTUAL_OUTPUT,
} from '../../src/shared/venue-patch';
import { importOflFixture } from '../../src/engine/ofl-import';
import { saveShowFile } from '../../src/engine/show-file';
import { saveVenueFile } from '../../src/engine/venue-file';

// OFL file, manufacturer name and the mode the rig uses.
const PROFILES = {
  par: { file: 'showtec/club-par-12-4-rgbw.json', manufacturer: 'Showtec', mode: 'RGBW' },
  head: { file: 'eurolite/led-tmh-9.json', manufacturer: 'Eurolite', mode: '12-channel' },
  blinder: { file: 'showtec/led-blinder-2-cob.json', manufacturer: 'Showtec', mode: '2-channel' },
  bar: { file: 'stairville/led-bar-240-8.json', manufacturer: 'Stairville', mode: '24-channel' },
};
type Kind = keyof typeof PROFILES;

function profile(kind: Kind): FixtureProfile {
  const { file, manufacturer } = PROFILES[kind];
  const json: unknown = JSON.parse(readFileSync(join(import.meta.dirname, 'ofl', file), 'utf8'));
  return importOflFixture(json, manufacturer).profile;
}

// Hung from the truss, the front of the base facing the audience.
const HUNG: Mounting = {
  mount: 'Hung',
  rotation: 0,
  panInvert: false,
  tiltInvert: false,
  panOffset: 0,
  tiltOffset: 0,
};

// An 8 × 6 m stage: a front truss over the audience, moving heads on an
// upstage truss, blinders on the downstage edge and an LED bar on the floor
// upstage. The heads are on Universe 2, the rest on Universe 1. One blinder
// doubles as the Strobe and one head as the Effect Fixture, so every Role is
// in the rig.
export function demoVenue(): VenuePatch {
  const kinds: Record<Kind, FixtureProfile> = {
    par: profile('par'),
    head: profile('head'),
    blinder: profile('blinder'),
    bar: profile('bar'),
  };
  const fixture = (
    kind: Kind,
    fields: Omit<PatchedFixture, 'profileId' | 'mode'>,
  ): PatchedFixture => ({ ...fields, profileId: kinds[kind].id, mode: PROFILES[kind].mode });
  const pars = [-3, -1, 1, 3].map((x, i) =>
    fixture('par', {
      id: `par-${i + 1}`,
      name: `Front PAR ${i + 1}`,
      universe: 1,
      address: 1 + i * 4,
      x,
      y: -1,
      height: 4,
    }),
  );
  const fixtures = [
    ...pars,
    fixture('blinder', {
      id: 'blinder-sr',
      name: 'Blinder SR',
      universe: 1,
      address: 21,
      x: -3.5,
      y: 0.3,
      height: 0.3,
    }),
    fixture('blinder', {
      id: 'blinder-sl',
      name: 'Blinder SL',
      universe: 1,
      address: 23,
      x: 3.5,
      y: 0.3,
      height: 0.3,
      role: 'Strobe',
    }),
    fixture('bar', {
      id: 'bar',
      name: 'LED Bar',
      universe: 1,
      address: 31,
      x: 0,
      y: 5.5,
      height: 0.2,
    }),
    fixture('head', {
      id: 'head-sr',
      name: 'Head SR',
      universe: 2,
      address: 1,
      x: -2,
      y: 5,
      height: 4.5,
      mounting: HUNG,
    }),
    fixture('head', {
      id: 'head-sl',
      name: 'Head SL',
      universe: 2,
      address: 13,
      x: 2,
      y: 5,
      height: 4.5,
      mounting: HUNG,
      role: 'Effect',
    }),
  ];
  const empty: VenuePatch = {
    stage: { width: 8, depth: 6 },
    universes: [
      { number: 1, output: VIRTUAL_OUTPUT },
      { number: 2, output: VIRTUAL_OUTPUT },
    ],
    fixtures: [],
    profiles: [],
  };
  const result = putFixtures(empty, fixtures, (id) =>
    Object.values(kinds).find((p) => p.id === id),
  );
  if ('errors' in result) throw new Error(result.errors.join('\n'));
  return result.patch;
}

const zone = (row: ZoneRow, column: ZoneColumn, level: Zone['level']): Zone => ({
  row,
  column,
  level,
});
const roles = (...list: Role[]): RuleTarget => ({ roles: list });
const zones = (...list: Zone[]): RuleTarget => ({ zones: list });
// Both moving heads, by where they hang rather than by Role.
const HEADS = zones(
  zone('Upstage', 'Stage Right', 'Overhead'),
  zone('Upstage', 'Stage Left', 'Overhead'),
);
const swatch = (name: Swatch): Colour => ({ swatch: name });

// Eight Scenes on three Layers, each named for what it shows off. Triggers
// start at C3 (note 48) on channel 1, on white keys.
export function demoShow(): Show {
  const looks = { layer: 'looks', tags: ['look'] };
  const movement = { layer: 'movement', tags: ['movement'] };
  const scenes: Scene[] = [
    {
      id: 'intro',
      name: 'Intro: blue wash',
      ...looks,
      fadeIn: 2,
      rules: [
        { target: roles('Wash'), intensity: 0.4, colour: swatch('Blue') },
        { target: roles('Pixel/Bar'), intensity: 0.3, colour: swatch('Cyan') },
        { target: HEADS, intensity: 0.3, colour: swatch('Blue'), direction: 'Down' },
      ],
    },
    {
      id: 'verse',
      name: 'Verse: warm, amber centre',
      ...looks,
      fadeIn: 1,
      rules: [
        { target: roles('Wash'), intensity: 0.7, colour: swatch('Warm White') },
        // A later Rule overrides an earlier one: the centre PARs go amber.
        {
          target: zones(zone('Front', 'Centre', 'Overhead')),
          intensity: 0.8,
          colour: swatch('Amber'),
        },
        { target: roles('Pixel/Bar'), intensity: 0.4, colour: swatch('Amber') },
        { target: HEADS, intensity: 0.5, colour: swatch('Lavender'), direction: 'Cross' },
      ],
    },
    {
      id: 'chorus',
      name: 'Chorus: full red',
      ...looks,
      fadeIn: 0,
      rules: [
        { target: {}, intensity: 1, colour: swatch('Red') },
        { target: roles('Pixel/Bar'), colour: swatch('Magenta') },
        { target: HEADS, colour: swatch('White'), direction: 'Audience' },
        { target: roles('Blinder', 'Strobe'), intensity: 0 },
      ],
    },
    {
      id: 'blinder-hit',
      name: 'Blinder hit',
      layer: 'hits',
      tags: ['hit'],
      fadeIn: 0,
      rules: [{ target: roles('Blinder', 'Strobe'), intensity: 1, colour: swatch('White') }],
    },
    {
      id: 'circle',
      name: 'Circle movement',
      ...movement,
      fadeIn: 0.5,
      rules: [
        {
          target: HEADS,
          direction: 'Centre',
          effect: { shape: 'Circle', size: 25, length: 4, spread: 'In sync' },
        },
      ],
    },
    {
      id: 'wave',
      name: 'L→R wave',
      ...movement,
      fadeIn: 0.5,
      rules: [
        {
          target: HEADS,
          direction: 'Audience',
          effect: { shape: 'Tilt sweep', size: 12, length: 2, spread: 'Left→Right' },
        },
      ],
    },
    {
      id: 'base-look',
      name: 'Warm white',
      ...looks,
      fadeIn: 1,
      rules: [
        { target: {}, intensity: 0.6, colour: swatch('Warm White') },
        { target: roles('Blinder', 'Strobe'), intensity: 0 },
        { target: HEADS, direction: 'Down' },
      ],
    },
    {
      id: 'outro',
      name: 'Outro: slow fade to blue',
      ...looks,
      fadeIn: 4,
      rules: [
        { target: {}, intensity: 0 },
        { target: roles('Wash'), intensity: 0.2, colour: swatch('Blue') },
      ],
    },
  ];
  const trigger = (note: number, sceneId: string, mode: Trigger['mode']): Trigger => ({
    channel: 1,
    note,
    scene: sceneId,
    mode,
  });
  return {
    layers: [
      { id: 'looks', name: 'Looks' },
      { id: 'movement', name: 'Movement' },
      { id: 'hits', name: 'Hits' },
    ],
    scenes,
    triggers: [
      trigger(48, 'intro', 'go'), // C3
      trigger(50, 'verse', 'go'), // D3
      trigger(52, 'chorus', 'go'), // E3
      trigger(53, 'blinder-hit', 'flash'), // F3, while held
      trigger(55, 'circle', 'go'), // G3
      trigger(57, 'wave', 'go'), // A3
      trigger(59, 'wave', 'release'), // B3, clears the Movement Layer
      trigger(60, 'base-look', 'go'), // C4
      trigger(62, 'outro', 'go'), // D4
    ],
    baseLook: 'base-look',
    panelScenes: ['intro', 'verse', 'chorus', 'blinder-hit', 'circle', 'outro'],
  };
}

// The two files as written to `examples/`: the app's file format, indented so
// changes read well in a diff.
export function demoFiles(): { venue: string; show: string } {
  const indent = (json: string) => `${JSON.stringify(JSON.parse(json), null, 2)}\n`;
  return {
    venue: indent(saveVenueFile(demoVenue())),
    show: indent(saveShowFile(demoShow())),
  };
}
